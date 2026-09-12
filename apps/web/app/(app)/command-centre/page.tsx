"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import {
  AttentionQueue,
  BranchDoctorPanel,
  ConversionFunnel,
  ErrorState,
  ExecutiveStripSection,
  PatientFlowBoard,
  Skeleton,
  SourcePerformanceTable,
  SpendAtRiskPanel,
  TeamPanel,
} from "@pulseos/ui";

export default function CommandCentrePage() {
  const router = useRouter();

  const executive = useQuery({ queryKey: ["dashboard", "executive"], queryFn: api.executive });
  const conversion = useQuery({ queryKey: ["dashboard", "conversion"], queryFn: api.conversion });
  const spendAtRisk = useQuery({ queryKey: ["dashboard", "spend-at-risk"], queryFn: api.spendAtRisk });
  const sourcePerformance = useQuery({ queryKey: ["dashboard", "source-performance"], queryFn: api.sourcePerformance });
  const attention = useQuery({ queryKey: ["dashboard", "attention"], queryFn: api.attention });
  const patientFlow = useQuery({ queryKey: ["dashboard", "patient-flow"], queryFn: api.patientFlow });
  const team = useQuery({ queryKey: ["dashboard", "team"], queryFn: api.team });
  const branchDoctor = useQuery({ queryKey: ["dashboard", "branch-doctor"], queryFn: api.branchDoctor });

  return (
    <div className="mx-auto max-w-7xl space-y-6" data-testid="command-centre">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Command Centre</h1>
        <p className="text-sm text-neutral-500">How much did we spend, what did it produce, where are we losing patients, what should we do today.</p>
      </div>

      {/* 1. Executive strip: spend, acquisition, conversion, revenue, ROAS, spend at risk */}
      <section>
        {executive.isLoading && <div className="grid grid-cols-4 gap-2 lg:grid-cols-7">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}
        {executive.isError && <ErrorState message="Could not load the executive summary." />}
        {executive.data && (
          <ExecutiveStripSection data={executive.data} onSpendAtRiskClick={() => document.getElementById("spend-at-risk")?.scrollIntoView({ behavior: "smooth" })} />
        )}
      </section>

      {/* 2. Journey funnel: flagship visualization */}
      <section>
        {conversion.isLoading ? <Skeleton className="h-64" /> : conversion.isError ? <ErrorState message="Could not load the journey funnel." /> : conversion.data && (
          <ConversionFunnel stages={conversion.data} onStageClick={(key) => router.push(`/journeys?stage=${key}`)} />
        )}
      </section>

      {/* 3. Spend at risk: signature panel */}
      <section id="spend-at-risk">
        {spendAtRisk.isLoading ? <Skeleton className="h-64" /> : spendAtRisk.isError ? <ErrorState message="Could not load spend at risk." /> : spendAtRisk.data && (
          <SpendAtRiskPanel data={spendAtRisk.data} onCategoryClick={(key) => router.push(`/journeys?atRisk=${key}`)} />
        )}
      </section>

      {/* 4. Source/campaign performance */}
      <section>
        {sourcePerformance.isLoading ? <Skeleton className="h-64" /> : sourcePerformance.isError ? <ErrorState message="Could not load source performance." /> : sourcePerformance.data && (
          <SourcePerformanceTable rows={sourcePerformance.data} onRowClick={(row) => router.push(`/journeys?campaignId=${row.campaignId ?? ""}`)} />
        )}
      </section>

      {/* 5. Action queue */}
      <section>
        {attention.isLoading ? <Skeleton className="h-64" /> : attention.isError ? <ErrorState message="Could not load the action queue." /> : attention.data && (
          <AttentionQueue items={attention.data} onItemClick={(item) => router.push(`/patients?journeyId=${item.id}`)} />
        )}
      </section>

      {/* 6. Secondary context: patient flow, team, branch/doctor — below the fold relative to spend/journey/revenue */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {patientFlow.isLoading ? <Skeleton className="h-56" /> : patientFlow.isError ? <ErrorState message="Could not load patient flow." /> : patientFlow.data && (
          <PatientFlowBoard data={patientFlow.data} onBucketClick={(bucket) => router.push(`/appointments?flow=${bucket}`)} />
        )}
        {team.isLoading ? <Skeleton className="h-56" /> : team.isError ? <ErrorState message="Could not load team workload." /> : team.data && (
          <TeamPanel rows={team.data} onRowClick={(row) => router.push(`/team/${row.userId}`)} />
        )}
      </div>
      <div>
        {branchDoctor.isLoading ? <Skeleton className="h-48" /> : branchDoctor.isError ? <ErrorState message="Could not load branch/doctor performance." /> : branchDoctor.data && (
          <BranchDoctorPanel rows={branchDoctor.data} onRowClick={(row) => router.push(`/doctors/${row.id}`)} />
        )}
      </div>
    </div>
  );
}
