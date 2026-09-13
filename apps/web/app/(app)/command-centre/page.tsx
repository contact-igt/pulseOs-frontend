"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import {
  AttentionQueue,
  ErrorState,
  JourneyHealthRadial,
  JourneyPerformanceChart,
  KpiStripSection,
  PatientFlowBoard,
  Skeleton,
  SourcePerformanceTable,
  SpendAtRisk,
  TeamPanel,
} from "@pulseos/ui";

const RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "Week", days: 7 },
  { label: "Month", days: 30 },
  { label: "Custom", days: 90 },
];

export default function CommandCentrePage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string>("");
  const [journeyType, setJourneyType] = useState<string>("");
  const [rangeDays, setRangeDays] = useState(7);

  const filters = { branchId: branchId || undefined, journeyType: journeyType || undefined };

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const journeyTypes = useQuery({ queryKey: ["journey-types"], queryFn: api.journeyTypes });

  const today = useQuery({ queryKey: ["dashboard", "today", filters], queryFn: () => api.today(filters) });
  const journeyHealth = useQuery({ queryKey: ["dashboard", "journey-health", filters], queryFn: () => api.journeyHealth(filters) });
  const performance = useQuery({
    queryKey: ["dashboard", "journey-performance", rangeDays, filters],
    queryFn: () => api.journeyPerformance(rangeDays, filters),
  });
  const patientFlow = useQuery({ queryKey: ["dashboard", "patient-flow", filters], queryFn: () => api.patientFlow(filters) });
  const attention = useQuery({ queryKey: ["dashboard", "attention", filters], queryFn: () => api.attention(filters) });
  const spendAtRisk = useQuery({ queryKey: ["dashboard", "spend-at-risk-by-reason"], queryFn: () => api.spendAtRiskByReason() });
  const sourcePerformance = useQuery({ queryKey: ["dashboard", "source-performance"], queryFn: () => api.sourcePerformance() });
  const team = useQuery({ queryKey: ["dashboard", "team", filters], queryFn: () => api.team(filters) });
  const branchDoctor = useQuery({ queryKey: ["dashboard", "branch-doctor", filters], queryFn: () => api.branchDoctor(filters) });

  return (
    <div className="mx-auto max-w-7xl space-y-5" data-testid="command-centre">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2" data-testid="filter-bar">
        <div className="flex gap-0.5 rounded border border-neutral-200 p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setRangeDays(opt.days)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                rangeDays === opt.days ? "bg-primary-50 text-primary-700" : "text-neutral-500 hover:bg-neutral-100"
              }`}
              data-testid={`range-${opt.label.toLowerCase()}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700"
          data-testid="filter-branch"
        >
          <option value="">All branches</option>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={journeyType}
          onChange={(e) => setJourneyType(e.target.value)}
          className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700"
          data-testid="filter-service"
        >
          <option value="">All services</option>
          {journeyTypes.data?.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <section>
        {today.isLoading && <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}
        {today.isError && <ErrorState message="Could not load today's summary." />}
        {today.data && <KpiStripSection data={today.data} onSegmentClick={(key) => router.push(`/patients?filter=${String(key)}`)} />}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.9fr_1fr]">
        {performance.isLoading ? (
          <Skeleton className="h-80" />
        ) : performance.isError ? (
          <ErrorState message="Could not load journey performance." />
        ) : (
          performance.data && <JourneyPerformanceChart data={performance.data} windowDays={rangeDays} />
        )}
        {journeyHealth.isLoading ? (
          <Skeleton className="h-80" />
        ) : journeyHealth.isError ? (
          <ErrorState message="Could not load journey health." />
        ) : (
          journeyHealth.data && <JourneyHealthRadial data={journeyHealth.data} onSegmentClick={(key) => router.push(`/journeys?stage=${key}`)} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {attention.isLoading ? <Skeleton className="h-64" /> : attention.isError ? <ErrorState message="Could not load attention queue." /> : attention.data && (
          <AttentionQueue items={attention.data} onItemClick={(item) => router.push(`/patients/${item.id}`)} />
        )}
        {patientFlow.isLoading ? <Skeleton className="h-64" /> : patientFlow.isError ? <ErrorState message="Could not load patient flow." /> : patientFlow.data && (
          <PatientFlowBoard data={patientFlow.data} onBucketClick={(bucket) => router.push(`/appointments?flow=${bucket}`)} compact />
        )}
        {sourcePerformance.isLoading ? <Skeleton className="h-64" /> : sourcePerformance.isError ? <ErrorState message="Could not load source performance." /> : sourcePerformance.data && (
          <SourcePerformanceTable rows={sourcePerformance.data} onRowClick={(row) => router.push(`/journeys?campaignId=${row.campaignId ?? ""}`)} compact />
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {team.isLoading || branchDoctor.isLoading ? (
          <Skeleton className="h-64" />
        ) : team.isError || branchDoctor.isError ? (
          <ErrorState message="Could not load team workload." />
        ) : (
          team.data &&
          branchDoctor.data && (
            <TeamPanel
              team={team.data}
              doctors={branchDoctor.data}
              onTeamClick={(row) => router.push(`/team/${row.userId}`)}
              onDoctorClick={(row) => router.push(`/doctors/${row.id}`)}
            />
          )
        )}
        {spendAtRisk.isLoading ? <Skeleton className="h-64" /> : spendAtRisk.isError ? <ErrorState message="Could not load spend at risk." /> : spendAtRisk.data && (
          <SpendAtRisk data={spendAtRisk.data} onReasonClick={(reason) => router.push(`/patients?filter=${reason}`)} />
        )}
      </div>
    </div>
  );
}
