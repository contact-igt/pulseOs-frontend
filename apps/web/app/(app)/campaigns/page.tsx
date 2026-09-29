"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { Card, ConnectorModeBadge, EmptyState, ErrorState, FilterBar, FilterSelect, MetricStrip, Panel, Skeleton, SpendAtRisk, Table, TableBody, TableHead, Td, Th, Tr, formatInr, formatMoneyOrDash, formatRoas } from "@pulseos/ui";
import type { CampaignFilters, SourceChannel } from "@pulseos/types";
import { withFrom } from "@/components/shell/BackLink";

const SOURCE_OPTIONS: SourceChannel[] = ["meta", "google", "website", "whatsapp", "phone", "walk_in", "referral", "organic", "other"];
const SOURCE_LABEL: Record<SourceChannel, string> = { meta: "Meta", google: "Google", website: "Website", whatsapp: "WhatsApp", phone: "Phone", walk_in: "Walk-in", referral: "Referral", organic: "Organic", other: "Other" };
const DATE_INPUT = "glass-control h-8 rounded-control px-2 text-xs text-ink outline-none focus-visible:border-primary-500";

export default function CampaignsPage() {
  const [filters, setFilters] = useState<CampaignFilters>({});

  const specialties = useQuery({ queryKey: ["specialties"], queryFn: () => api.specialties() });
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: api.lookups });
  const efficiency = useQuery({ queryKey: ["marketing-efficiency", filters], queryFn: () => api.marketingEfficiency(filters) });
  const performance = useQuery({ queryKey: ["campaign-performance", filters], queryFn: () => api.campaignPerformance(filters) });
  const spendAtRisk = useQuery({ queryKey: ["campaign-spend-at-risk"], queryFn: api.campaignSpendAtRisk });

  return (
    <div className="mx-auto max-w-7xl space-y-5" data-testid="campaigns-page">
      <FilterBar data-testid="campaigns-filter-bar">
        <FilterSelect value={filters.branchId ?? ""} onChange={(e) => setFilters((f) => ({ ...f, branchId: e.target.value || undefined }))} aria-label="Branch">
          <option value="">All branches</option>
          {lookups.data?.branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          value={filters.specialtyKey ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, specialtyKey: e.target.value || undefined }))}
          aria-label="Specialty"
          data-testid="campaigns-specialty-filter"
        >
          <option value="">All specialties</option>
          {specialties.data?.map((s) => (
            <option key={s.key} value={s.key}>
              {s.displayName}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={filters.source ?? ""} onChange={(e) => setFilters((f) => ({ ...f, source: (e.target.value as SourceChannel) || undefined }))} aria-label="Source">
          <option value="">All sources</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </FilterSelect>
        <div className="flex items-center gap-1.5 text-xs text-ink-2">
          <label htmlFor="campaigns-date-from">From</label>
          <input
            id="campaigns-date-from"
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
            className={DATE_INPUT}
            data-testid="campaigns-date-from"
          />
          <label htmlFor="campaigns-date-to">To</label>
          <input
            id="campaigns-date-to"
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
            className={DATE_INPUT}
            data-testid="campaigns-date-to"
          />
        </div>
        {(filters.branchId || filters.specialtyKey || filters.source || filters.dateFrom || filters.dateTo) && (
          <button type="button" onClick={() => setFilters({})} className="text-xs font-medium text-primary-700 hover:underline">
            Clear filters
          </button>
        )}
      </FilterBar>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-2">Marketing Efficiency</h2>
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
            <Card tone="info" className="grid grid-cols-2 gap-2 px-4 py-2.5 sm:grid-cols-4" data-testid="marketing-efficiency-secondary">
              {[
                { key: "consultations", label: "Consultations", value: efficiency.data.consultations },
                { key: "cpl", label: "Cost / Lead", value: formatMoneyOrDash(efficiency.data.cpl) },
                { key: "cpa", label: "Cost / Appointment", value: formatMoneyOrDash(efficiency.data.costPerAppointment) },
                { key: "cpt", label: "Cost / Treatment", value: formatMoneyOrDash(efficiency.data.costPerTreatment) },
              ].map((cell) => (
                <div key={cell.key} data-testid={`metric-${cell.key}`}>
                  <span className="block text-sm font-semibold tabular-nums text-ink">{cell.value}</span>
                  <span className="block text-[11px] text-ink-2">{cell.label}</span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </section>

      {/* Stacked, not side-by-side — the performance table has 13 real
          columns (min-w 860px) and was getting squeezed into a ~750px
          column next to Spend At Risk, clipping the last few columns with
          no visible scroll affordance. Full width removes the need to
          scroll at all on any desktop viewport this product targets. */}
      <div className="space-y-5">
        <Panel title="Campaign / Source Performance" subtitle={performance.data ? `${performance.data.length} campaigns` : undefined} padded={false}>
          {performance.isLoading && <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>}
          {performance.isError && <ErrorState message="Could not load campaign performance." />}
          {performance.data && performance.data.length === 0 && <EmptyState message="No campaigns match these filters." />}
          {performance.data && performance.data.length > 0 && (
            <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHead>
                <tr>
                  <Th leading>Campaign</Th>
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
                    <Td leading nowrap={false} className="text-ink">
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
                    <Td className="text-ink-2">{SOURCE_LABEL[row.source as SourceChannel] ?? row.source}</Td>
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
            </div>
          )}
        </Panel>

        {spendAtRisk.isLoading ? <Skeleton className="h-64" /> : spendAtRisk.isError ? <ErrorState message="Could not load spend at risk." /> : spendAtRisk.data && <SpendAtRisk data={spendAtRisk.data} />}
      </div>
    </div>
  );
}
