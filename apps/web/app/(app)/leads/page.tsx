"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import { Badge, Card, EmptyState, ErrorState, MetricStrip, Skeleton } from "@pulseos/ui";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import { withFrom } from "@/components/shell/BackLink";
import type { LeadRow, LeadStatus } from "@pulseos/types";

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

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function LeadsPage() {
  const router = useRouter();
  const quickCreate = useQuickCreate();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");

  const summary = useQuery({ queryKey: ["leads-summary"], queryFn: api.leadsSummary });
  const leads = useQuery({
    queryKey: ["leads", statusFilter],
    queryFn: () => api.leads(statusFilter === "all" ? {} : { status: statusFilter }),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5" data-testid="leads-page">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-neutral-500">Track every enquiry from source to appointment.</p>
        </div>
        <button
          type="button"
          onClick={() => quickCreate.openAddLead()}
          className="shrink-0 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
          data-testid="add-lead-button"
        >
          + Add Lead
        </button>
      </div>

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

      <div className="flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1" role="tablist">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={statusFilter === t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`rounded px-2.5 py-1.5 text-xs font-medium transition ${
              statusFilter === t.key ? "bg-primary-50 text-primary-700" : "text-neutral-500 hover:bg-neutral-100"
            }`}
            data-testid={`leads-tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
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
        {leads.data && leads.data.length > 0 && (
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-neutral-100 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Lead / Patient</th>
                <th className="px-2 py-2 font-medium">Phone</th>
                <th className="px-2 py-2 font-medium">Specialty</th>
                <th className="px-2 py-2 font-medium">Source</th>
                <th className="px-2 py-2 font-medium">Campaign</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Owner</th>
                <th className="px-2 py-2 font-medium">Last Interaction</th>
                <th className="px-2 py-2 font-medium">Next Action</th>
                <th className="px-2 py-2 font-medium">Created</th>
                <th className="px-2 py-2 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {leads.data.map((lead: LeadRow) => (
                <tr key={lead.id} className="cursor-pointer hover:bg-neutral-50" onClick={() => router.push(withFrom(`/patients/${lead.patientId}`, "leads"))} data-testid={`lead-row-${lead.id}`}>
                  <td className="px-4 py-2 text-slate-900">{lead.patientName}</td>
                  <td className="px-2 py-2 text-neutral-600">{lead.phone}</td>
                  <td className="px-2 py-2 text-neutral-600">{lead.specialtyLabel ?? "—"}</td>
                  <td className="px-2 py-2 text-neutral-600">{lead.source}</td>
                  <td className="px-2 py-2 text-neutral-600">{lead.campaignName ?? "—"}</td>
                  <td className="px-2 py-2">
                    <Badge tone={STATUS_TONE[lead.leadStatus]}>{STATUS_LABEL[lead.leadStatus]}</Badge>
                  </td>
                  <td className="px-2 py-2 text-neutral-600">{lead.ownerName ?? "—"}</td>
                  <td className="px-2 py-2 text-neutral-600">{fmtDate(lead.lastInteractionAt)}</td>
                  <td className="px-2 py-2 text-neutral-600">{fmtDate(lead.nextActionDueAt)}</td>
                  <td className="px-2 py-2 text-neutral-600">{fmtDate(lead.createdAt)}</td>
                  <td className="px-2 py-2">{lead.priority === "high" ? <Badge tone="warning">High</Badge> : <span className="text-neutral-400">Normal</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
