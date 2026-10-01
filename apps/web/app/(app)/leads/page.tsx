"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@pulseos/api-client";
import {
  Badge, Button, Card, EmptyState, ErrorState, MetricStrip, Skeleton, Table, TableBody, TableHead, Tabs, Td, Th, Toolbar, Tr, ViewSwitcher,
  fmtDate, relativeTime, urgencyLabel,
} from "@pulseos/ui";
import { hasPermission, type LeadRow, type LeadStatus } from "@pulseos/types";
import { Columns3, Table2, UserRoundCog } from "lucide-react";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import { withFrom } from "@/components/shell/BackLink";
import { AssignOwnerDialog } from "@/components/journey/AssignOwnerDialog";
import { OwnerScopeControl, useOwnerScope } from "@/components/journey/OwnerScopeControl";
import { invalidateJourneyQueries } from "@/components/journey/invalidate";
import { useViewState } from "@/lib/useViewState";
import { replaceUrlParams } from "@/lib/urlParams";
import { LeadsStageBoard } from "@/components/leads/LeadsStageBoard";
import { useHospitalTimeZone } from "@/lib/useHospitalTimeZone";

const VIEWS = ["table", "board"] as const;
type LeadsView = (typeof VIEWS)[number];
const VIEW_OPTIONS = [
  { key: "table" as const, label: "Table", icon: <Table2 size={14} />, controls: "leads-view-panel" },
  { key: "board" as const, label: "Board", icon: <Columns3 size={14} />, controls: "leads-view-panel" },
];
// Leads has no day-bound data; the hook only needs a zone for its (unused) date default.

const STATUS_TABS: { key: LeadStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "uncontacted", label: "Uncontacted" },
  { key: "follow_up_due", label: "Follow-up Due" },
  { key: "appointment_booked", label: "Appointment Booked" },
  { key: "no_response", label: "No Response" },
  { key: "converted", label: "Converted" },
  { key: "lost", label: "Lost" },
];

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  uncontacted: "Uncontacted",
  follow_up_due: "Follow-up due",
  appointment_booked: "Appointment booked",
  no_response: "No response",
  converted: "Converted",
  lost: "Lost",
};

const STATUS_TONE: Record<LeadStatus, "neutral" | "warning" | "danger" | "primary"> = {
  new: "primary",
  uncontacted: "neutral",
  follow_up_due: "warning",
  appointment_booked: "primary",
  no_response: "danger",
  converted: "primary",
  lost: "neutral",
};

/** What the open assignment dialog is for: one row, or the current bulk selection. */
type Assigning = { kind: "one"; row: LeadRow } | { kind: "bulk" } | null;

export default function LeadsPage() {
  const timeZone = useHospitalTimeZone();
  const router = useRouter();
  const queryClient = useQueryClient();
  const quickCreate = useQuickCreate();
  const searchParams = useSearchParams();
  // Status lives in the URL (?status=) like owner and view, so reload, back/forward and shared links keep it.
  const rawStatus = searchParams.get("status");
  const statusFilter: LeadStatus | "all" = STATUS_TABS.find((t) => t.key === rawStatus)?.key ?? "all";
  const setStatusFilter = useCallback((next: LeadStatus | "all") => void replaceUrlParams({ status: next === "all" ? undefined : next }), []);
  const { view, setView } = useViewState<LeadsView>({ views: VIEWS, defaultView: "table", timeZone });
  const [owner, setOwner] = useOwnerScope();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState<Assigning>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const session = useQuery({ queryKey: ["session"], queryFn: api.session, retry: false });
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: api.lookups, staleTime: 60_000 });
  const summary = useQuery({ queryKey: ["leads-summary"], queryFn: api.leadsSummary });
  const leads = useQuery({
    queryKey: ["leads", statusFilter, owner],
    queryFn: () => api.leads({ ...(statusFilter === "all" ? {} : { status: statusFilter }), ...(owner ? { owner } : {}) }),
  });

  const canAssign = session.data ? hasPermission(session.data.user.role, "MANAGE_JOURNEYS") : false;
  const owners = lookups.data?.owners ?? [];
  const rows = useMemo(() => leads.data ?? [], [leads.data]);
  // Selection only ever counts rows still on screen (filters can hide selected rows).
  const selectedIds = useMemo(() => rows.filter((r) => selected.has(r.id)).map((r) => r.id), [rows, selected]);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ownerName = (id: string | null) => (id ? owners.find((o) => o.id === id)?.name ?? "the selected owner" : "Unassigned");

  async function submitAssignment(ownerId: string | null) {
    if (!assigning) return;
    if (assigning.kind === "one") {
      await api.assignJourneyOwner(assigning.row.id, ownerId);
      setNotice(null);
    } else {
      const result = await api.assignJourneyOwnerBulk(selectedIds, ownerId);
      setSelected(new Set());
      setNotice(`${result.updatedCount} journey${result.updatedCount === 1 ? "" : "s"} assigned to ${ownerName(ownerId)}.`);
    }
    invalidateJourneyQueries(queryClient);
    setAssigning(null);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4" data-testid="leads-page">
      <Toolbar
        actions={
          <Button variant="primary" onClick={() => quickCreate.openAddLead()} data-testid="add-lead-button">
            + Add Lead
          </Button>
        }
      >
        <Tabs
          ariaLabel="Lead status"
          value={statusFilter}
          onChange={(k) => setStatusFilter(k as LeadStatus | "all")}
          items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label, testId: `leads-tab-${t.key}` }))}
        />
      </Toolbar>

      {summary.data && (
        <MetricStrip
          testId="leads-kpi-strip"
          cells={[
            { key: "new", label: "New Today", value: summary.data.newToday },
            { key: "uncontacted", label: "Uncontacted", value: summary.data.uncontacted },
            { key: "follow_ups_due", label: "Follow-ups Due", value: summary.data.followUpsDue },
            { key: "appointments_booked", label: "Appointments Booked", value: summary.data.appointmentsBooked },
            { key: "no_response", label: "No Response", value: summary.data.noResponse },
            { key: "converted", label: "Converted", value: summary.data.converted },
          ]}
        />
      )}

      <Toolbar actions={<ViewSwitcher ariaLabel="Leads view" value={view} onChange={setView} options={VIEW_OPTIONS} />}>
        <OwnerScopeControl
          value={owner}
          onChange={(next) => {
            setOwner(next);
            setSelected(new Set());
          }}
          owners={owners}
        />
      </Toolbar>

      {view === "table" && canAssign && selectedIds.length > 0 && (
        <Card tone="info" className="flex flex-wrap items-center gap-3 px-4 py-2" data-testid="bulk-bar" role="region" aria-label="Bulk actions">
          <span className="text-sm font-medium text-ink">{selectedIds.length} selected</span>
          <Button variant="primary" size="sm" onClick={() => { setNotice(null); setAssigning({ kind: "bulk" }); }} data-testid="bulk-assign">
            Assign to…
          </Button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-ink-2 hover:text-ink" data-testid="bulk-clear">
            Clear
          </button>
        </Card>
      )}
      {notice && (
        <p role="status" className="px-1 text-xs text-primary-700" data-testid="assign-notice">
          {notice}
        </p>
      )}

      {view === "board" && rows.length > 0 && (
        <div id="leads-view-panel" role="tabpanel" aria-label="Board">
          <LeadsStageBoard rows={rows} onOpen={(lead) => router.push(withFrom(`/journeys/${lead.id}`, "leads"))} />
        </div>
      )}

      <Card className={`overflow-x-auto p-0 ${view === "board" && rows.length > 0 ? "hidden" : ""}`} id={view === "table" ? "leads-view-panel" : undefined}>
        {leads.isLoading && <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>}
        {leads.isError && <div className="p-4"><ErrorState message="Could not load leads." /></div>}
        {leads.data && leads.data.length === 0 && (
          <div className="p-8">
            <EmptyState message="No leads match these filters." />
            <div className="mt-3 flex justify-center">
              <button type="button" onClick={() => quickCreate.openAddLead()} className="text-xs font-medium text-primary-600 hover:underline">
                + Add Lead
              </button>
            </div>
          </div>
        )}
        {rows.length > 0 && view === "table" && (
          <Table className="min-w-[960px]">
            <TableHead>
              <tr>
                {canAssign && (
                  <Th leading className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                      aria-label="Select all leads"
                      data-testid="lead-select-all"
                    />
                  </Th>
                )}
                <Th leading={!canAssign}>Patient</Th>
                <Th>Journey</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th>Owner</Th>
                <Th>Last Interaction</Th>
                <Th>Next Action</Th>
                <Th>Enquiry</Th>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((lead: LeadRow) => {
                const due = lead.nextActionDueAt ? urgencyLabel(lead.nextActionDueAt) : null;
                return (
                  <Tr key={lead.id} onClick={() => router.push(withFrom(`/journeys/${lead.id}`, "leads"))} data-testid={`lead-row-${lead.id}`} data-stage={lead.stage}>
                    {canAssign && (
                      <Td leading className="w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={() => toggle(lead.id)}
                          aria-label={`Select ${lead.patientName}`}
                          data-testid={`lead-select-${lead.id}`}
                        />
                      </Td>
                    )}
                    <Td leading={!canAssign}>
                      <Link
                        href={withFrom(`/journeys/${lead.id}`, "leads")}
                        onClick={(e) => e.stopPropagation()}
                        className="block font-medium text-ink hover:text-primary-700 hover:underline"
                      >
                        {lead.patientName}
                      </Link>
                      <span className="block text-[11px] text-ink-2">{lead.phone}</span>
                    </Td>
                    <Td className="text-ink-2">{lead.specialtyLabel ?? "—"}</Td>
                    <Td className="text-ink-2">
                      <span className="block">{lead.source}</span>
                      {lead.campaignName && <span className="block max-w-[10rem] truncate text-[11px] text-neutral-500">{lead.campaignName}</span>}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[lead.leadStatus]}>{STATUS_LABEL[lead.leadStatus]}</Badge>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <span className={lead.ownerName ? "text-ink" : "text-ink-2"} data-testid={`lead-owner-${lead.id}`}>
                          {lead.ownerName ?? "Unassigned"}
                        </span>
                        {canAssign && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotice(null);
                              setAssigning({ kind: "one", row: lead });
                            }}
                            aria-label={`${lead.ownerName ? "Change" : "Assign"} owner for ${lead.patientName}`}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-chip text-primary-700 hover:bg-primary-50"
                            data-testid={`assign-owner-${lead.id}`}
                          >
                            <UserRoundCog size={14} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </Td>
                    <Td className="text-ink-2">{relativeTime(lead.lastInteractionAt)}</Td>
                    <Td>
                      {due ? (
                        <>
                          <span className={`block ${due.overdue ? "font-medium text-danger-700" : "text-ink-2"}`}>{due.text}</span>
                          <span className="block text-[11px] text-neutral-500">{fmtDate(lead.nextActionDueAt)}</span>
                        </>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </Td>
                    <Td className="text-ink-2">
                      <span className="block">{fmtDate(lead.createdAt)}</span>
                      <span className="block text-[11px] text-neutral-500">{relativeTime(lead.createdAt)}</span>
                    </Td>
                  </Tr>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {assigning && canAssign && (
        <AssignOwnerDialog
          open
          subject={assigning.kind === "one" ? assigning.row.patientName : `${selectedIds.length} journey${selectedIds.length === 1 ? "" : "s"}`}
          owners={owners}
          initialOwnerId={assigning.kind === "one" ? assigning.row.ownerId : null}
          onClose={() => setAssigning(null)}
          onSubmit={submitAssignment}
        />
      )}
    </div>
  );
}
