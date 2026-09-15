"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import { Badge, Button, Card, EmptyState, ErrorState, MetricStrip, PageHeader, Skeleton, Table, TableBody, TableHead, Td, Th, Tr } from "@pulseos/ui";
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
      <PageHeader
        title="Leads"
        subtitle="Track every enquiry from source to appointment."
        action={
          <Button variant="primary" onClick={() => quickCreate.openAddLead()} data-testid="add-lead-button">
            + Add Lead
          </Button>
        }
      />

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
          <Table className="min-w-[980px]">
            <TableHead>
              <tr>
                <Th leading>Lead / Patient</Th>
                <Th>Phone</Th>
                <Th>Specialty</Th>
                <Th>Source</Th>
                <Th>Campaign</Th>
                <Th>Status</Th>
                <Th>Owner</Th>
                <Th>Last Interaction</Th>
                <Th>Next Action</Th>
                <Th>Created</Th>
                <Th>Priority</Th>
              </tr>
            </TableHead>
            <TableBody>
              {leads.data.map((lead: LeadRow) => (
                <Tr key={lead.id} onClick={() => router.push(withFrom(`/patients/${lead.patientId}`, "leads"))} data-testid={`lead-row-${lead.id}`}>
                  <Td leading className="text-slate-900">{lead.patientName}</Td>
                  <Td className="text-neutral-600">{lead.phone}</Td>
                  <Td className="text-neutral-600">{lead.specialtyLabel ?? "—"}</Td>
                  <Td className="text-neutral-600">{lead.source}</Td>
                  <Td className="text-neutral-600">{lead.campaignName ?? "—"}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[lead.leadStatus]}>{STATUS_LABEL[lead.leadStatus]}</Badge>
                  </Td>
                  <Td className="text-neutral-600">{lead.ownerName ?? "—"}</Td>
                  <Td className="text-neutral-600">{fmtDate(lead.lastInteractionAt)}</Td>
                  <Td className="text-neutral-600">{fmtDate(lead.nextActionDueAt)}</Td>
                  <Td className="text-neutral-600">{fmtDate(lead.createdAt)}</Td>
                  <Td>{lead.priority === "high" ? <Badge tone="warning">High</Badge> : <span className="text-neutral-400">Normal</span>}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
