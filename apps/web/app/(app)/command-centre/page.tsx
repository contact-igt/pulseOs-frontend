"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import {
  AttentionQueue,
  ErrorState,
  ExecutiveStripSection,
  FilterBar,
  FilterSelect,
  JourneyFunnel,
  PatientFlowBoard,
  ServiceLinePanel,
  Skeleton,
  SourcePerformanceTable,
  SpendAtRisk,
  TeamPanel,
  TodayPulse,
  Toolbar,
} from "@pulseos/ui";
import { withFrom } from "@/components/shell/BackLink";

/**
 * Command Centre composition (top to bottom):
 *  1. Hospital performance (all time): revenue anchor, spend, ROAS, spend at
 *     risk, volume — from /dashboard/executive.
 *  2. Today: a quiet operational strip (follows the filters).
 *  3. Primary analytics: the journey funnel + a right stack (Spend At Risk,
 *     patient flow today).
 *  4. Where the revenue comes from: service lines + top campaigns.
 *  5. What needs a person: attention queue + team / doctor load.
 */
export default function CommandCentrePage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string>("");
  const [journeyType, setJourneyType] = useState<string>("");

  const filters = { branchId: branchId || undefined, journeyType: journeyType || undefined };

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const journeyTypes = useQuery({ queryKey: ["journey-types"], queryFn: api.journeyTypes });

  const executive = useQuery({ queryKey: ["dashboard", "executive"], queryFn: () => api.executive() });
  const today = useQuery({ queryKey: ["dashboard", "today", filters], queryFn: () => api.today(filters) });
  const journeyHealth = useQuery({ queryKey: ["dashboard", "journey-health", filters], queryFn: () => api.journeyHealth(filters) });
  const patientFlow = useQuery({ queryKey: ["dashboard", "patient-flow", filters], queryFn: () => api.patientFlow(filters) });
  const attention = useQuery({ queryKey: ["dashboard", "attention", filters], queryFn: () => api.attention(filters) });
  const spendAtRisk = useQuery({ queryKey: ["dashboard", "spend-at-risk-by-reason"], queryFn: () => api.spendAtRiskByReason() });
  const sourcePerformance = useQuery({ queryKey: ["dashboard", "source-performance"], queryFn: () => api.sourcePerformance() });
  const serviceMix = useQuery({ queryKey: ["dashboard", "service-mix", { branchId: filters.branchId }], queryFn: () => api.serviceMix({ branchId: filters.branchId }) });
  const team = useQuery({ queryKey: ["dashboard", "team", filters], queryFn: () => api.team(filters) });
  const branchDoctor = useQuery({ queryKey: ["dashboard", "branch-doctor", filters], queryFn: () => api.branchDoctor(filters) });

  const doctors = branchDoctor.data?.filter((r) => r.kind === "doctor");

  return (
    <div className="mx-auto max-w-7xl space-y-4 lg:space-y-5" data-testid="command-centre">
      <Toolbar
        actions={
          <FilterBar data-testid="filter-bar" className="w-full sm:w-auto">
            <FilterSelect value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="Branch" data-testid="filter-branch">
              <option value="">All branches</option>
              {branches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={journeyType} onChange={(e) => setJourneyType(e.target.value)} aria-label="Service" data-testid="filter-service">
              <option value="">All services</option>
              {journeyTypes.data?.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </FilterSelect>
          </FilterBar>
        }
      >
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink">Hospital performance</h2>
          <p className="text-xs text-ink-2">All time · whole hospital<span className="hidden lg:inline">. Filters apply to today, the funnel, flow, attention and team.</span></p>
        </div>
      </Toolbar>

      <section aria-label="Hospital performance" className="space-y-2.5">
        {executive.isLoading && <Skeleton className="h-[76px]" />}
        {executive.isError && <ErrorState message="Could not load hospital performance." />}
        {executive.data && (
          <ExecutiveStripSection
            data={executive.data}
            onSpendAtRiskClick={() => document.getElementById("spend-at-risk-panel")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          />
        )}
        {today.isLoading && <Skeleton className="h-12" />}
        {today.isError && <ErrorState message="Could not load today's summary." />}
        {today.data && <TodayPulse data={today.data} onStatClick={(key) => router.push(`/patients?filter=${String(key)}`)} />}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:gap-5">
        {journeyHealth.isLoading ? (
          <Skeleton className="h-80" />
        ) : journeyHealth.isError ? (
          <ErrorState message="Could not load journey performance." />
        ) : (
          journeyHealth.data && (
            <JourneyFunnel
              stages={[
                { key: "enquiry", label: "Enquiries", count: journeyHealth.data.totalJourneys },
                ...journeyHealth.data.segments.map((s) => ({ key: s.key, label: s.label, count: s.count })),
              ]}
              onStageClick={(key) => router.push(key === "enquiry" ? "/journeys" : `/journeys?stage=${key}`)}
            />
          )
        )}
        <div className="flex min-w-0 flex-col gap-4 xl:gap-5">
          {spendAtRisk.isLoading ? (
            <Skeleton className="h-64" />
          ) : spendAtRisk.isError ? (
            <ErrorState message="Could not load spend at risk." />
          ) : (
            spendAtRisk.data && (
              <SpendAtRisk
                data={spendAtRisk.data}
                marketingSpend={executive.data?.marketingSpend}
                onReasonClick={(reason) => router.push(`/patients?filter=${reason}`)}
              />
            )
          )}
          {patientFlow.isLoading ? (
            <Skeleton className="h-28" />
          ) : patientFlow.isError ? (
            <ErrorState message="Could not load patient flow." />
          ) : (
            patientFlow.data && <PatientFlowBoard data={patientFlow.data} onBucketClick={(bucket) => router.push(`/appointments?flow=${bucket}`)} compact />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:gap-5">
        {serviceMix.isLoading ? (
          <Skeleton className="h-72" />
        ) : serviceMix.isError ? (
          <ErrorState message="Could not load service lines." />
        ) : (
          serviceMix.data && <ServiceLinePanel rows={serviceMix.data} selected={journeyType} onSelect={setJourneyType} />
        )}
        {sourcePerformance.isLoading ? (
          <Skeleton className="h-72" />
        ) : sourcePerformance.isError ? (
          <ErrorState message="Could not load source performance." />
        ) : (
          sourcePerformance.data && (
            <SourcePerformanceTable rows={sourcePerformance.data} onRowClick={(row) => router.push(`/journeys?campaignId=${row.campaignId ?? ""}`)} compact />
          )
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:gap-5">
        {attention.isLoading ? (
          <Skeleton className="h-64" />
        ) : attention.isError ? (
          <ErrorState message="Could not load attention queue." />
        ) : (
          attention.data && (
            <AttentionQueue
              items={attention.data}
              // `item.id` is the TASK id; the journey (or, failing that, the
              // patient) is what the row actually opens.
              onItemClick={(item) =>
                router.push(withFrom(item.journeyId ? `/journeys/${item.journeyId}` : `/patients/${item.patientId}`, "command-centre"))
              }
            />
          )
        )}
        {team.isLoading || branchDoctor.isLoading ? (
          <Skeleton className="h-64" />
        ) : team.isError || branchDoctor.isError ? (
          <ErrorState message="Could not load team workload." />
        ) : (
          team.data && doctors && <TeamPanel team={team.data} doctors={doctors} />
        )}
      </div>
    </div>
  );
}
