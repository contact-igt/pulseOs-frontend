"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import {
  AttentionQueue,
  BranchDoctorPanel,
  ConversionFunnel,
  ErrorState,
  KpiStripSection,
  MarketingPanel,
  PatientFlowBoard,
  Skeleton,
  TeamPanel,
} from "@pulseos/ui";

export default function CommandCentrePage() {
  const router = useRouter();

  const today = useQuery({ queryKey: ["dashboard", "today"], queryFn: api.today });
  const conversion = useQuery({ queryKey: ["dashboard", "conversion"], queryFn: api.conversion });
  const patientFlow = useQuery({ queryKey: ["dashboard", "patient-flow"], queryFn: api.patientFlow });
  const attention = useQuery({ queryKey: ["dashboard", "attention"], queryFn: api.attention });
  const marketing = useQuery({ queryKey: ["dashboard", "marketing"], queryFn: api.marketing });
  const team = useQuery({ queryKey: ["dashboard", "team"], queryFn: api.team });
  const branchDoctor = useQuery({ queryKey: ["dashboard", "branch-doctor"], queryFn: api.branchDoctor });

  return (
    <div className="mx-auto max-w-7xl space-y-6" data-testid="command-centre">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Command Centre</h1>
        <p className="text-sm text-neutral-500">Hospital engagement operation at a glance</p>
      </div>

      <section>
        {today.isLoading && <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}
        {today.isError && <ErrorState message="Could not load today's summary." />}
        {today.data && (
          <KpiStripSection
            data={today.data}
            onSegmentClick={(key) => router.push(`/patients?filter=${String(key)}`)}
          />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {conversion.isLoading ? <Skeleton className="h-64" /> : conversion.isError ? <ErrorState message="Could not load conversion funnel." /> : conversion.data && (
          <ConversionFunnel stages={conversion.data} onStageClick={(key) => router.push(`/journeys?stage=${key}`)} />
        )}
        {patientFlow.isLoading ? <Skeleton className="h-64" /> : patientFlow.isError ? <ErrorState message="Could not load patient flow." /> : patientFlow.data && (
          <PatientFlowBoard data={patientFlow.data} onBucketClick={(bucket) => router.push(`/appointments?flow=${bucket}`)} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {attention.isLoading ? <Skeleton className="h-64" /> : attention.isError ? <ErrorState message="Could not load attention queue." /> : attention.data && (
          <AttentionQueue items={attention.data} onItemClick={(item) => router.push(`/patients/${item.id}`)} />
        )}
        {marketing.isLoading ? <Skeleton className="h-64" /> : marketing.isError ? <ErrorState message="Could not load marketing sources." /> : marketing.data && (
          <MarketingPanel rows={marketing.data} onSourceClick={(source) => router.push(`/journeys?source=${source}`)} />
        )}
        {team.isLoading ? <Skeleton className="h-64" /> : team.isError ? <ErrorState message="Could not load team workload." /> : team.data && (
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
