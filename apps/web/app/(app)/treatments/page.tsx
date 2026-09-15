"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import { Badge, Card, ErrorState, SectionHeading, Skeleton, formatInr } from "@pulseos/ui";
import { withFrom } from "@/components/shell/BackLink";
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

const NEXT_STEPS: Partial<Record<TreatmentStatus, { status: TreatmentStatus; label: string }[]>> = {
  ADVISED: [
    { status: "DECISION_PENDING", label: "Awaiting decision" },
    { status: "ACCEPTED", label: "Accept" },
    { status: "DECLINED", label: "Decline" },
  ],
  DECISION_PENDING: [
    { status: "ACCEPTED", label: "Accept" },
    { status: "DECLINED", label: "Decline" },
  ],
  ACCEPTED: [{ status: "SCHEDULED", label: "Schedule" }],
  SCHEDULED: [{ status: "COMPLETED", label: "Complete" }],
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

  async function transition(row: TreatmentRow, next: TreatmentStatus) {
    await api.updateTreatmentStatus(row.id, next);
    queryClient.invalidateQueries({ queryKey: ["treatments"] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-testid="treatments-page">
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
                      <div className="flex gap-1">
                        {(NEXT_STEPS[row.status] ?? []).map((step) => (
                          <button
                            key={step.status}
                            type="button"
                            onClick={() => transition(row, step.status)}
                            className="rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
                            data-testid={`treatment-${row.id}-${step.status}`}
                          >
                            {step.label}
                          </button>
                        ))}
                      </div>
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
