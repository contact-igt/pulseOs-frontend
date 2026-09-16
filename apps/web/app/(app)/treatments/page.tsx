"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import {
  Badge, Button, Card, ConfirmDialog, ErrorState, OverflowMenu, PageHeader, SectionHeading, Skeleton, Table, TableBody, TableHead, Td, Th, Tr,
  formatInr, fmtDate, TREATMENT_STATUS_LABEL, TREATMENT_STATUS_TONE,
} from "@pulseos/ui";
import { withFrom } from "@/components/shell/BackLink";
import { hasPermission } from "@pulseos/types";
import type { TreatmentRow, TreatmentStatus } from "@pulseos/types";

const STATUS_LABEL = TREATMENT_STATUS_LABEL;
const STATUS_TONE = TREATMENT_STATUS_TONE;

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
  const [confirming, setConfirming] = useState<{ row: TreatmentRow; status: TreatmentStatus; label: string } | null>(null);

  const treatments = useQuery({
    queryKey: ["treatments", status],
    queryFn: () => api.treatments(status ? { status } : {}),
  });

  // MANAGE_TREATMENT gates the status-transition endpoint server-side
  // (Doctor has VIEW_TREATMENT but advises via RECORD_CONSULTATION_OUTCOME,
  // not by driving the funnel here) — mirrored here only to avoid showing
  // dead controls, never as the actual authorization boundary.
  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  const canManage = !!session.data && hasPermission(session.data.user.role, "MANAGE_TREATMENT");

  async function transition(row: TreatmentRow, next: TreatmentStatus) {
    await api.updateTreatmentStatus(row.id, next);
    queryClient.invalidateQueries({ queryKey: ["treatments"] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-testid="treatments-page">
      <PageHeader title="Treatments" subtitle="Operational conversion tracking, not an EMR." />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
        <select value={status} onChange={(e) => setStatus(e.target.value as TreatmentStatus | "")} className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700">
          <option value="">All statuses</option>
          {(["ADVISED", "DECISION_PENDING", "ACCEPTED", "SCHEDULED", "COMPLETED", "DECLINED", "CANCELLED"] as TreatmentStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden p-4">
        <SectionHeading title="Treatment Opportunities" subtitle={treatments.data ? `${treatments.data.length}` : undefined} />
        {treatments.isLoading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>}
        {treatments.isError && <ErrorState message="Could not load treatments." />}
        {treatments.data && treatments.data.length === 0 && <p className="py-8 text-center text-sm text-neutral-400">No treatment opportunities match this filter.</p>}
        {treatments.data && treatments.data.length > 0 && (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHead>
                <tr>
                  <Th>Patient</Th>
                  <Th>Doctor</Th>
                  <Th>Treatment</Th>
                  <Th align="right">Est. Value</Th>
                  <Th>Status</Th>
                  <Th>Owner</Th>
                  <Th>Next Action</Th>
                  <Th>Last Contact</Th>
                  <Th>Planned Date</Th>
                  <Th>Actions</Th>
                </tr>
              </TableHead>
              <TableBody>
                {treatments.data.map((row) => (
                  <Tr key={row.id}>
                    <Td className="cursor-pointer text-slate-900" onClick={() => router.push(withFrom(`/patients/${row.patientId}`, "treatments"))}>{row.patientName}</Td>
                    <Td className="text-neutral-600">{row.doctorName ?? "—"}</Td>
                    <Td className="text-neutral-600">{row.treatmentLabel}</Td>
                    <Td align="right" className="text-slate-900">{formatInr(row.estimatedValue)}</Td>
                    <Td><Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge></Td>
                    <Td className="text-neutral-600">{row.ownerName ?? "—"}</Td>
                    <Td className="text-neutral-600">{fmtDate(row.nextActionDueAt)}</Td>
                    <Td className="text-neutral-600">{fmtDate(row.lastContactAt)}</Td>
                    <Td className="text-neutral-600">{fmtDate(row.plannedDate)}</Td>
                    <Td>
                      {canManage && NEXT_STEPS[row.status] && (
                        <div className="flex items-center gap-1">
                          <Button size="sm" onClick={() => transition(row, NEXT_STEPS[row.status]!.primary.status)} data-testid={`treatment-${row.id}-${NEXT_STEPS[row.status]!.primary.status}`}>
                            {NEXT_STEPS[row.status]!.primary.label}
                          </Button>
                          <OverflowMenu
                            testId={`treatment-${row.id}-more`}
                            items={NEXT_STEPS[row.status]!.secondary.map((s) => ({
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

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
