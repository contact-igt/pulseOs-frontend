"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@pulseos/api-client";
import { Badge, Card, EmptyState, ErrorState, Skeleton, formatInr, formatMoneyOrDash } from "@pulseos/ui";
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
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Journeys</h1>
        <p className="text-sm text-neutral-500">The operational surface behind the Command Centre&apos;s numbers.</p>
      </div>

      {summary.data && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            { label: "Active", value: summary.data.activeJourneys },
            { label: "Appointments pending", value: summary.data.appointmentsPending },
            { label: "Consultations pending", value: summary.data.consultationsPending },
            { label: "Treatment decisions pending", value: summary.data.treatmentDecisionsPending },
            { label: "Revenue opportunity", value: formatInr(summary.data.revenueOpportunity) },
            { label: "Spend at risk", value: formatInr(summary.data.spendAtRisk) },
          ].map((m) => (
            <Card key={m.label} className="p-2.5">
              <span className="block text-base font-semibold text-slate-900">{m.value}</span>
              <span className="block text-[11px] text-neutral-500">{m.label}</span>
            </Card>
          ))}
        </div>
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
          {["meta", "google", "website", "whatsapp", "walk_in", "referral", "organic", "other"].map((s) => (
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
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="border-b border-neutral-100 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Patient</th>
                <th className="px-2 py-2 font-medium">Journey</th>
                <th className="px-2 py-2 font-medium">Source / Campaign</th>
                <th className="px-2 py-2 font-medium">Stage</th>
                <th className="px-2 py-2 font-medium">Doctor</th>
                <th className="px-2 py-2 font-medium">Owner</th>
                <th className="px-2 py-2 font-medium">Last Activity</th>
                <th className="px-2 py-2 font-medium">Next Action</th>
                <th className="px-2 py-2 text-right font-medium">Acq. Cost</th>
                <th className="px-2 py-2 text-right font-medium">Treatment Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {journeys.data.map((j) => (
                <tr key={j.id} className="cursor-pointer hover:bg-neutral-50" onClick={() => router.push(`/patients/${j.patientId}`)}>
                  <td className="px-4 py-2 text-slate-900">{j.patientName}</td>
                  <td className="px-2 py-2 text-neutral-600">{j.journeyType}</td>
                  <td className="px-2 py-2 text-neutral-600">
                    <span className="block">{j.source}</span>
                    {j.campaignName && <span className="block text-[11px] text-neutral-400">{j.campaignName}</span>}
                  </td>
                  <td className="px-2 py-2"><Badge tone={STAGE_TONE[j.stage] ?? "neutral"}>{j.stage.replace(/_/g, " ")}</Badge></td>
                  <td className="px-2 py-2 text-neutral-600">{j.doctorName ?? "—"}</td>
                  <td className="px-2 py-2 text-neutral-600">{j.ownerName ?? "—"}</td>
                  <td className="px-2 py-2 text-neutral-600">{fmtDate(j.lastActivityAt)}</td>
                  <td className="px-2 py-2 text-neutral-600">{fmtDate(j.nextActionDueAt)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatMoneyOrDash(j.acquisitionCost)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{j.treatmentValue > 0 ? formatInr(j.treatmentValue) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
