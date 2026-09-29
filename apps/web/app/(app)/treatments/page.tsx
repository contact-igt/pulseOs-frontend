"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, FilterBar, FilterSelect, MetricStrip, OverflowMenu, Skeleton,
  Table, TableBody, TableHead, TableShell, Td, Th, Toolbar, Tr,
  formatInr, fmtDate, TREATMENT_STATUS_LABEL, TREATMENT_STATUS_TONE,
} from "@pulseos/ui";
import { withFrom } from "@/components/shell/BackLink";
import { hasPermission } from "@pulseos/types";
import type { TreatmentFilters, TreatmentRow, TreatmentStatus } from "@pulseos/types";

const STATUS_LABEL = TREATMENT_STATUS_LABEL;
const STATUS_TONE = TREATMENT_STATUS_TONE;

// Two selects per row on a phone (so labels are never cut to "All s"), natural width from sm up.
const FILTER_CLASS = "basis-[calc(50%-0.25rem)]! sm:basis-auto!";

const ALL_STATUSES:TreatmentStatus[] = ["ADVISED", "DECISION_PENDING", "ACCEPTED", "SCHEDULED", "COMPLETED", "DECLINED", "CANCELLED"];
const PIPELINE_STATUSES: TreatmentStatus[] = ["ADVISED", "DECISION_PENDING", "ACCEPTED", "SCHEDULED", "COMPLETED"];

// One clear forward action per status (rendered as a real button) plus any
// rare/secondary transitions tucked into an overflow menu — never a wall of
// 3 buttons in one row (the Table Action Rule).
const NEXT_STEPS: Partial<Record<TreatmentStatus, { primary: { status: TreatmentStatus; label: string }; secondary: { status: TreatmentStatus; label: string; danger?: boolean }[] }>> = {
  ADVISED: {
    primary: { status: "ACCEPTED", label: "Accept" },
    secondary: [
      { status: "DECISION_PENDING", label: "Awaiting decision" },
      { status: "DECLINED", label: "Decline", danger: true },
    ],
  },
  DECISION_PENDING: {
    primary: { status: "ACCEPTED", label: "Accept" },
    secondary: [{ status: "DECLINED", label: "Decline", danger: true }],
  },
  ACCEPTED: { primary: { status: "SCHEDULED", label: "Schedule" }, secondary: [] },
  SCHEDULED: { primary: { status: "COMPLETED", label: "Complete" }, secondary: [] },
};

export default function TreatmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<TreatmentStatus | "">("");
  const [service, setService] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [confirming, setConfirming] = useState<{ row: TreatmentRow; status: TreatmentStatus; label: string } | null>(null);

  // service / doctor / owner / procedure are applied by the API; the state
  // filter is applied to the same result client-side so the pipeline counts
  // above the table always describe the other four filters, not the state.
  const serverFilters: TreatmentFilters = {
    ...(service ? { service } : {}),
    ...(doctorId ? { doctorId } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(procedureId ? { treatmentDefinitionId: procedureId } : {}),
  };
  const treatments = useQuery({
    queryKey: ["treatments", serverFilters],
    queryFn: () => api.treatments(serverFilters),
  });

  // Unfiltered list only feeds the option lists (which services / procedures actually have treatments).
  const allTreatments = useQuery({ queryKey: ["treatments", "all"], queryFn: () => api.treatments({}) });
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: api.lookups });
  const catalog = useQuery({ queryKey: ["treatment-catalog"], queryFn: () => api.treatmentCatalog() });

  const services = useMemo(() => [...new Set((allTreatments.data ?? []).map((t) => t.service).filter((s): s is string => !!s))].sort(), [allTreatments.data]);
  const procedures = useMemo(() => {
    const inScope = (allTreatments.data ?? []).filter((t) => !service || t.service === service);
    const usedIds = new Set(inScope.map((t) => t.treatmentDefinitionId).filter((id): id is string => !!id));
    return (catalog.data ?? []).filter((d) => usedIds.has(d.id));
  }, [allTreatments.data, catalog.data, service]);

  const rows = useMemo(() => (treatments.data ?? []).filter((t) => !status || t.status === status), [treatments.data, status]);
  const pipelineCounts = useMemo(
    () => (treatments.data ?? []).reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status] ?? 0) + 1 }), {} as Partial<Record<TreatmentStatus, number>>),
    [treatments.data],
  );
  const totalValue = rows.reduce((sum, t) => sum + t.estimatedValue, 0);
  const filtersActive = !!(status || service || doctorId || ownerId || procedureId);

  function clearFilters() {
    setStatus("");
    setService("");
    setDoctorId("");
    setOwnerId("");
    setProcedureId("");
  }

  // MANAGE_TREATMENT gates the status-transition endpoint server-side
  // (Doctor has VIEW_TREATMENT but advises via RECORD_CONSULTATION_OUTCOME,
  // not by driving the funnel here) — mirrored here only to avoid showing
  // dead controls, never as the actual authorization boundary.
  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  const canManage = !!session.data && hasPermission(session.data.user.role, "MANAGE_TREATMENT");

  async function transition(row: TreatmentRow, next: TreatmentStatus) {
    await api.updateTreatmentStatus(row.id, next);
    queryClient.invalidateQueries({ queryKey: ["treatments"] });
    // A treatment reaching e.g. COMPLETED also advances the underlying
    // Journey's stage server-side — keep the dashboard's revenue/decision
    // KPIs and Patient 360/Journeys' stage badges from going stale.
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["journeys"] });
    queryClient.invalidateQueries({ queryKey: ["journey"] });
    queryClient.invalidateQueries({ queryKey: ["patients"] });
    queryClient.invalidateQueries({ queryKey: ["patient360"] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-testid="treatments-page">
      <Toolbar
        actions={
          treatments.data && (
            <span className="text-xs text-ink-2" data-testid="treatments-summary">
              {rows.length} treatment{rows.length === 1 ? "" : "s"} · {formatInr(totalValue)} est. value
            </span>
          )
        }
      >
        <FilterBar data-testid="treatment-filters">
          <FilterSelect className={FILTER_CLASS} aria-label="Service" value={service} onChange={(e) => { setService(e.target.value); setProcedureId(""); }} data-testid="treatment-filter-service">
            <option value="">All services</option>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
          <FilterSelect className={FILTER_CLASS} aria-label="Procedure" value={procedureId} onChange={(e) => setProcedureId(e.target.value)} data-testid="treatment-filter-procedure">
            <option value="">All procedures</option>
            {procedures.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </FilterSelect>
          <FilterSelect className={FILTER_CLASS} aria-label="State" value={status} onChange={(e) => setStatus(e.target.value as TreatmentStatus | "")} data-testid="treatment-filter-state">
            <option value="">All states</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </FilterSelect>
          <FilterSelect className={FILTER_CLASS} aria-label="Doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} data-testid="treatment-filter-doctor">
            <option value="">All doctors</option>
            {(lookups.data?.doctors ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </FilterSelect>
          <FilterSelect className={FILTER_CLASS} aria-label="Owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} data-testid="treatment-filter-owner">
            <option value="">All owners</option>
            {(lookups.data?.owners ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </FilterSelect>
          {filtersActive && (
            <Button size="sm" variant="ghost" onClick={clearFilters} data-testid="treatment-filters-clear">
              Clear filters
            </Button>
          )}
        </FilterBar>
      </Toolbar>

      {treatments.data && (
        <MetricStrip
          testId="treatment-pipeline-strip"
          anchorKey={status || undefined}
          cells={PIPELINE_STATUSES.map((s) => ({
            key: s,
            label: STATUS_LABEL[s],
            value: pipelineCounts[s] ?? 0,
            // Clicking the active state again clears it.
            onClick: () => setStatus(status === s ? "" : s),
            testId: `treatment-pipeline-${s}`,
          }))}
        />
      )}

      <TableShell maxHeight="40rem">
        {treatments.isLoading && <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>}
        {treatments.isError && <ErrorState message="Could not load treatments." />}
        {treatments.data && rows.length === 0 && (
          <EmptyState
            message="No treatments match these filters."
            hint="Treatments appear here when a consultation outcome advises one."
            action={filtersActive ? <Button size="sm" onClick={clearFilters}>Clear filters</Button> : undefined}
          />
        )}
        {rows.length > 0 && (
          <Table className="min-w-[1000px]">
            <TableHead sticky>
              <tr>
                <Th leading>Patient</Th>
                <Th>Journey / service</Th>
                <Th>Treatment</Th>
                <Th align="right">Value</Th>
                <Th>Doctor</Th>
                <Th>Owner</Th>
                <Th>State</Th>
                <Th>Next action</Th>
                <Th>Actions</Th>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const steps = NEXT_STEPS[row.status];
                return (
                  <Tr key={row.id} onClick={() => router.push(withFrom(`/journeys/${row.journeyId}`, "treatments"))} data-testid={`treatment-row-${row.id}`}>
                    <Td leading nowrap>
                      <Link
                        href={withFrom(`/patients/${row.patientId}`, "treatments")}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-ink hover:text-primary-700 hover:underline"
                      >
                        {row.patientName}
                      </Link>
                    </Td>
                    <Td nowrap>
                      <Link
                        href={withFrom(`/journeys/${row.journeyId}`, "treatments")}
                        onClick={(e) => e.stopPropagation()}
                        className="text-ink-2 hover:text-primary-700 hover:underline"
                        data-testid={`treatment-journey-link-${row.id}`}
                      >
                        {row.service ?? "Journey"}
                      </Link>
                    </Td>
                    <Td className="text-ink" nowrap>{row.treatmentLabel}</Td>
                    <Td align="right" className="text-ink">{formatInr(row.estimatedValue)}</Td>
                    <Td className="text-ink-2" nowrap>{row.doctorName ?? "—"}</Td>
                    <Td className="text-ink-2" nowrap>{row.ownerName ?? "—"}</Td>
                    <Td nowrap>
                      <span className="flex flex-col items-start gap-0.5">
                        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                        {row.plannedDate && <span className="text-[11px] text-ink-2">Planned {fmtDate(row.plannedDate)}</span>}
                      </span>
                    </Td>
                    <Td className="text-ink-2" nowrap>{fmtDate(row.nextActionDueAt)}</Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      {canManage && steps && (
                        <div className="flex items-center gap-1">
                          <Button size="sm" onClick={() => transition(row, steps.primary.status)} data-testid={`treatment-${row.id}-${steps.primary.status}`}>
                            {steps.primary.label}
                          </Button>
                          <OverflowMenu
                            testId={`treatment-${row.id}-more`}
                            items={steps.secondary.map((s) => ({
                              key: s.status,
                              label: s.label,
                              danger: s.danger,
                              onClick: () => (s.danger ? setConfirming({ row, status: s.status, label: s.label }) : transition(row, s.status)),
                            }))}
                          />
                        </div>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableShell>

      <ConfirmDialog
        open={!!confirming}
        title={confirming ? `${confirming.label} this treatment?` : ""}
        description={
          confirming
            ? `${confirming.row.patientName}'s "${confirming.row.treatmentLabel}" (${formatInr(confirming.row.estimatedValue)}) moves out of the active pipeline and off every conversion count. This can't be undone from here — a declined treatment isn't re-offered automatically.`
            : ""
        }
        confirmLabel={confirming?.label ?? "Confirm"}
        onConfirm={() => {
          if (confirming) transition(confirming.row, confirming.status);
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
