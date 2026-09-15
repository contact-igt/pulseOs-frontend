"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import { Badge, Button, Card, ErrorState, OverflowMenu, PageHeader, SectionHeading, Skeleton, formatInr } from "@pulseos/ui";
import { withFrom } from "@/components/shell/BackLink";
import { hasPermission } from "@pulseos/types";
import type { TreatmentRow, TreatmentStatus } from "@pulseos/types";

const STATUS_TONE: Record<TreatmentStatus, "neutral" | "warning" | "danger" | "primary"> = {
  ADVISED: "neutral",
  DECISION_PENDING: "warning",
  ACCEPTED: "primary",
  SCHEDULED: "primary",
  COMPLETED: "neutral",
  DECLINED: "danger",
  CANCELLED: "danger",
  LOST: "danger",
};

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

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function TreatmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<TreatmentStatus | "">("");

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
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
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
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-neutral-100 text-neutral-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Patient</th>
                  <th className="px-2 py-2 font-medium">Doctor</th>
                  <th className="px-2 py-2 font-medium">Treatment</th>
                  <th className="px-2 py-2 text-right font-medium">Est. Value</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Owner</th>
                  <th className="px-2 py-2 font-medium">Next Action</th>
                  <th className="px-2 py-2 font-medium">Last Contact</th>
                  <th className="px-2 py-2 font-medium">Planned Date</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {treatments.data.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    <td className="cursor-pointer px-2 py-2 text-slate-900" onClick={() => router.push(withFrom(`/patients/${row.patientId}`, "treatments"))}>{row.patientName}</td>
                    <td className="px-2 py-2 text-neutral-600">{row.doctorName ?? "—"}</td>
                    <td className="px-2 py-2 text-neutral-600">{row.treatmentLabel}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-900">{formatInr(row.estimatedValue)}</td>
                    <td className="px-2 py-2"><Badge tone={STATUS_TONE[row.status]}>{row.status.replace(/_/g, " ")}</Badge></td>
                    <td className="px-2 py-2 text-neutral-600">{row.ownerName ?? "—"}</td>
                    <td className="px-2 py-2 text-neutral-600">{fmtDate(row.nextActionDueAt)}</td>
                    <td className="px-2 py-2 text-neutral-600">{fmtDate(row.lastContactAt)}</td>
                    <td className="px-2 py-2 text-neutral-600">{fmtDate(row.plannedDate)}</td>
                    <td className="px-2 py-2">
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
                              onClick: () => transition(row, s.status),
                            }))}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
