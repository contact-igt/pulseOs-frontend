"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@pulseos/api-client";
import { Badge, Card, EmptyState, ErrorState, MetricStrip, PageHeader, Skeleton, Table, TableBody, TableHead, Td, Th, Tr, formatInr, formatMoneyOrDash } from "@pulseos/ui";
import { withFrom } from "@/components/shell/BackLink";
import type { JourneyStage } from "@pulseos/types";

const STAGE_TONE: Partial<Record<JourneyStage, "neutral" | "warning" | "danger" | "primary">> = {
  enquiry: "neutral", contacted: "neutral", booked: "primary", attended: "primary",
  consulted: "primary", treatment_advised: "warning", scheduled: "warning", completed: "primary", lost: "danger",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function JourneysPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stageFilter, setStageFilter] = useState(searchParams.get("stage") ?? "");
  const [sourceFilter, setSourceFilter] = useState(searchParams.get("source") ?? "");
  const campaignFilter = searchParams.get("campaignId") ?? undefined;

  const summary = useQuery({ queryKey: ["journeys-summary"], queryFn: api.journeysSummary });
  const journeys = useQuery({
    queryKey: ["journeys", stageFilter, sourceFilter, campaignFilter],
    queryFn: () => api.journeys({ stage: stageFilter || undefined, source: sourceFilter || undefined, campaignId: campaignFilter }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-testid="journeys-page">
      <PageHeader title="Journeys" subtitle="The operational surface behind the Command Centre's numbers." />

      {summary.data && (
        <MetricStrip
          testId="journeys-summary-strip"
          cells={[
            { key: "active", label: "Active", value: summary.data.activeJourneys },
            { key: "appointments_pending", label: "Appointments pending", value: summary.data.appointmentsPending },
            { key: "consultations_pending", label: "Consultations pending", value: summary.data.consultationsPending },
            { key: "treatment_decisions_pending", label: "Treatment decisions pending", value: summary.data.treatmentDecisionsPending },
            { key: "revenue_opportunity", label: "Revenue opportunity", value: formatInr(summary.data.revenueOpportunity) },
            { key: "spend_at_risk", label: "Spend at risk", value: formatInr(summary.data.spendAtRisk) },
          ]}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-xs">
          <option value="">All stages</option>
          {["enquiry", "contacted", "booked", "attended", "consulted", "treatment_advised", "scheduled", "completed", "lost"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-xs">
          <option value="">All sources</option>
          {["meta", "google", "website", "whatsapp", "phone", "walk_in", "referral", "organic", "other"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(stageFilter || sourceFilter) && (
          <button type="button" onClick={() => { setStageFilter(""); setSourceFilter(""); }} className="text-xs text-neutral-400 hover:text-slate-900">
            Clear filters
          </button>
        )}
      </div>

      <Card className="overflow-x-auto p-0">
        {journeys.isLoading && <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>}
        {journeys.isError && <div className="p-4"><ErrorState message="Could not load journeys." /></div>}
        {journeys.data && journeys.data.length === 0 && <div className="p-4"><EmptyState message="No journeys match these filters." /></div>}
        {journeys.data && journeys.data.length > 0 && (
          <Table className="min-w-[960px]">
            <TableHead>
              <tr>
                <Th leading>Patient</Th>
                <Th>Journey</Th>
                <Th>Source / Campaign</Th>
                <Th>Stage</Th>
                <Th>Doctor</Th>
                <Th>Owner</Th>
                <Th>Last Activity</Th>
                <Th>Next Action</Th>
                <Th align="right">Acq. Cost</Th>
                <Th align="right">Treatment Value</Th>
              </tr>
            </TableHead>
            <TableBody>
              {journeys.data.map((j) => (
                <Tr key={j.id} onClick={() => router.push(withFrom(`/patients/${j.patientId}`, "journeys"))}>
                  <Td leading className="text-slate-900">{j.patientName}</Td>
                  <Td className="text-neutral-600">{j.journeyType}</Td>
                  <Td className="text-neutral-600">
                    <span className="block">{j.source}</span>
                    {j.campaignName && <span className="block text-[11px] text-neutral-400">{j.campaignName}</span>}
                  </Td>
                  <Td><Badge tone={STAGE_TONE[j.stage] ?? "neutral"}>{j.stage.replace(/_/g, " ")}</Badge></Td>
                  <Td className="text-neutral-600">{j.doctorName ?? "—"}</Td>
                  <Td className="text-neutral-600">{j.ownerName ?? "—"}</Td>
                  <Td className="text-neutral-600">{fmtDate(j.lastActivityAt)}</Td>
                  <Td className="text-neutral-600">{fmtDate(j.nextActionDueAt)}</Td>
                  <Td align="right">{formatMoneyOrDash(j.acquisitionCost)}</Td>
                  <Td align="right">{j.treatmentValue > 0 ? formatInr(j.treatmentValue) : "—"}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
