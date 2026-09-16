"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { Card, ConnectorModeBadge, EmptyState, ErrorState, MetricStrip, PageHeader, SectionHeading, Skeleton, SpendAtRisk, Table, TableBody, TableHead, Td, Th, Tr, formatInr, formatMoneyOrDash, formatRoas } from "@pulseos/ui";
import type { CampaignFilters, SourceChannel } from "@pulseos/types";
import { withFrom } from "@/components/shell/BackLink";

const SOURCE_OPTIONS: SourceChannel[] = ["meta", "google", "website", "whatsapp", "phone", "walk_in", "referral", "organic", "other"];

export default function CampaignsPage() {
  const [filters, setFilters] = useState<CampaignFilters>({});

  const specialties = useQuery({ queryKey: ["specialties"], queryFn: () => api.specialties() });
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: api.lookups });
  const efficiency = useQuery({ queryKey: ["marketing-efficiency", filters], queryFn: () => api.marketingEfficiency(filters) });
  const performance = useQuery({ queryKey: ["campaign-performance", filters], queryFn: () => api.campaignPerformance(filters) });
  const spendAtRisk = useQuery({ queryKey: ["campaign-spend-at-risk"], queryFn: api.campaignSpendAtRisk });

  return (
    <div className="mx-auto max-w-7xl space-y-5" data-testid="campaigns-page">
      <PageHeader title="Campaigns / Sources" subtitle="Where spend turns into treatment revenue." />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2" data-testid="campaigns-filter-bar">
        <select
          value={filters.branchId ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, branchId: e.target.value || undefined }))}
          className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700"
        >
          <option value="">All branches</option>
          {lookups.data?.branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={filters.specialtyKey ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, specialtyKey: e.target.value || undefined }))}
          className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700"
          data-testid="campaigns-specialty-filter"
        >
          <option value="">All specialties</option>
          {specialties.data?.map((s) => (
            <option key={s.key} value={s.key}>
              {s.displayName}
            </option>
          ))}
        </select>
        <select
          value={filters.source ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, source: (e.target.value as SourceChannel) || undefined }))}
          className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700"
        >
          <option value="">All sources</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 text-xs text-neutral-500">
          <span>From</span>
          <input
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
            className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700"
            data-testid="campaigns-date-from"
          />
          <span>To</span>
          <input
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
            className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700"
            data-testid="campaigns-date-to"
          />
        </div>
        {(filters.branchId || filters.specialtyKey || filters.source || filters.dateFrom || filters.dateTo) && (
          <button type="button" onClick={() => setFilters({})} className="text-xs text-neutral-400 hover:text-slate-900">
            Clear filters
          </button>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Marketing Efficiency</h2>
        {efficiency.isLoading && <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}
        {efficiency.isError && <ErrorState message="Could not load marketing efficiency." />}
        {efficiency.data && (
          <div className="space-y-2">
            {/* Primary: the numbers that answer "is this spend working" at a glance. */}
            <MetricStrip
              testId="marketing-efficiency-strip"
              cells={[
                { key: "spend", label: "Marketing Spend", value: formatInr(efficiency.data.spend) },
                { key: "leads", label: "Leads", value: efficiency.data.leads },
                { key: "appointments", label: "Appointments", value: efficiency.data.appointments },
                { key: "treatments", label: "Treatments", value: efficiency.data.treatments },
                { key: "revenue", label: "Attributed Revenue", value: formatInr(efficiency.data.revenue) },
                { key: "roas", label: "ROAS", value: formatRoas(efficiency.data.roas) },
              ]}
            />
            {/* Secondary: derived cost/volume detail — same data, deliberately smaller and quieter than the primary row. */}
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-2.5 sm:grid-cols-4" data-testid="marketing-efficiency-secondary">
              {[
                { key: "consultations", label: "Consultations", value: efficiency.data.consultations },
                { key: "cpl", label: "Cost / Lead", value: formatMoneyOrDash(efficiency.data.cpl) },
                { key: "cpa", label: "Cost / Appointment", value: formatMoneyOrDash(efficiency.data.costPerAppointment) },
                { key: "cpt", label: "Cost / Treatment", value: formatMoneyOrDash(efficiency.data.costPerTreatment) },
              ].map((cell) => (
                <div key={cell.key} data-testid={`metric-${cell.key}`}>
                  <span className="block text-sm font-medium tabular-nums text-neutral-700">{cell.value}</span>
                  <span className="block text-[11px] text-neutral-500">{cell.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.9fr_1fr]">
        <Card className="overflow-x-auto p-4">
          <SectionHeading title="Campaign / Source Performance" subtitle={performance.data ? `${performance.data.length} campaigns` : undefined} />
          {performance.isLoading && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>}
          {performance.isError && <ErrorState message="Could not load campaign performance." />}
          {performance.data && performance.data.length === 0 && <EmptyState message="No campaigns match these filters." />}
          {performance.data && performance.data.length > 0 && (
            <Table className="min-w-[860px]">
              <TableHead>
                <tr>
                  <Th>Campaign</Th>
                  <Th>Source</Th>
                  <Th align="right">Spend</Th>
                  <Th align="right">Leads</Th>
                  <Th align="right">Appts</Th>
                  <Th align="right">Consults</Th>
                  <Th align="right">Tx Advised</Th>
                  <Th align="right">Tx Completed</Th>
                  <Th align="right">Revenue</Th>
                  <Th align="right">CPL</Th>
                  <Th align="right">Cost/Appt</Th>
                  <Th align="right">Cost/Tx</Th>
                  <Th align="right">ROAS</Th>
                </tr>
              </TableHead>
              <TableBody>
                {performance.data.map((row) => (
                  <Tr key={row.campaignId ?? row.campaignName} data-testid={`campaign-row-${row.campaignId ?? row.campaignName}`}>
                    <Td className="text-slate-900">
                      <span className="flex items-center gap-1.5">
                        {row.campaignId ? (
                          <Link href={withFrom(`/campaigns/${row.campaignId}`, "campaigns")} className="font-medium text-primary-700 hover:underline">
                            {row.campaignName}
                          </Link>
                        ) : (
                          row.campaignName
                        )}
                        <ConnectorModeBadge mode={row.connectorMode} />
                      </span>
                      {row.specialtyLabel && <span className="block text-[11px] text-neutral-400">{row.specialtyLabel}</span>}
                    </Td>
                    <Td className="text-neutral-600">{row.source}</Td>
                    <Td align="right">{formatInr(row.spend)}</Td>
                    <Td align="right">{row.leads}</Td>
                    <Td align="right">{row.appointments}</Td>
                    <Td align="right">{row.consultations}</Td>
                    <Td align="right">{row.treatmentAdvised}</Td>
                    <Td align="right">{row.treatmentCompleted}</Td>
                    <Td align="right">{formatInr(row.revenue)}</Td>
                    <Td align="right">{formatMoneyOrDash(row.cpl)}</Td>
                    <Td align="right">{formatMoneyOrDash(row.costPerAppointment)}</Td>
                    <Td align="right">{formatMoneyOrDash(row.costPerTreatment)}</Td>
                    <Td align="right" className="font-medium">{formatRoas(row.roas)}</Td>
                  </Tr>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {spendAtRisk.isLoading ? <Skeleton className="h-64" /> : spendAtRisk.isError ? <ErrorState message="Could not load spend at risk." /> : spendAtRisk.data && <SpendAtRisk data={spendAtRisk.data} />}
      </div>
    </div>
  );
}
