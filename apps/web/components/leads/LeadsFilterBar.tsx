"use client";

import { X } from "lucide-react";
import { Button, FilterSelect } from "@pulseos/ui";
import type { LeadView, LeadsWorkspace, LookupOption } from "@pulseos/types";
import { OwnerScopeControl } from "@/components/journey/OwnerScopeControl";
import { PeriodControls } from "@/components/filters/PeriodControls";
import { LEAD_RANGES, type LeadChip, type LeadFilters } from "./leadFilters";

const FIXED_TODAY: LeadView[] = ["today", "new_today", "appointments_today"];

/** Date + owner + source + service filters for Leads, with counts on owners and the date context stated in words. */
export function LeadsFilterBar({
  filters,
  workspace,
  sessionUserId,
  owners,
  chips,
  dirty,
  onChange,
  onReset,
}: {
  filters: LeadFilters;
  workspace: LeadsWorkspace | undefined;
  sessionUserId: string | undefined;
  owners: LookupOption[];
  chips: LeadChip[];
  dirty: boolean;
  onChange: (patch: Partial<LeadFilters>) => void;
  onReset: () => void;
}) {
  const fixed = FIXED_TODAY.includes(filters.view);
  const oc = workspace?.ownerCounts;
  const mineCount = oc?.byOwner.find((o) => o.userId === sessionUserId)?.count ?? 0;
  const today = workspace?.period.today ?? "";

  return (
    <div className="space-y-2" data-testid="leads-filters">
      <div className="glass flex flex-wrap items-center gap-x-2 gap-y-2 rounded-panel px-2.5 py-2">
        <PeriodControls
          presets={LEAD_RANGES}
          value={{ range: filters.range, from: filters.from, to: filters.to }}
          today={today}
          onChange={(p) => onChange({ range: p.range as LeadFilters["range"], from: p.from, to: p.to })}
          noneLabel="Any date"
          allowFuture={filters.view === "follow_up_due"}
          disabled={fixed || !today}
          reason="This view always means today"
          testIdPrefix="leads"
        />
        <span className="mx-0.5 hidden h-5 w-px bg-line-strong sm:block" aria-hidden="true" />
        <OwnerScopeControl
          value={filters.owner}
          onChange={(owner) => onChange({ owner })}
          owners={owners}
          counts={oc ? { all: oc.all, mine: mineCount, unassigned: oc.unassigned, byOwner: Object.fromEntries(oc.byOwner.map((o) => [o.userId, o.count])) } : undefined}
        />
        <FilterSelect aria-label="Source" value={filters.source} onChange={(e) => onChange({ source: e.target.value })} data-testid="leads-source" className="max-md:[&_select]:h-11">
          <option value="">All sources</option>
          {workspace?.options.sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </FilterSelect>
        <FilterSelect aria-label="Service" value={filters.service} onChange={(e) => onChange({ service: e.target.value })} data-testid="leads-service" className="max-md:[&_select]:h-11">
          <option value="">All services</option>
          {workspace?.options.services.map((s) => <option key={s} value={s}>{s}</option>)}
        </FilterSelect>
        {dirty && (
          <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto max-md:min-h-11" data-testid="leads-reset">
            Reset
          </Button>
        )}
      </div>

      <p className="px-0.5 text-[11px] leading-4 text-ink-2" data-testid="leads-date-context">
        {workspace ? contextLine(workspace, filters) : "Loading…"}
      </p>

      {chips.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters" data-testid="leads-chips">
          {chips.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={() => onChange(c.key === "due" ? { due: undefined } : ({ [c.key]: "" } as Partial<LeadFilters>))} className="inline-flex max-w-[16rem] items-center gap-1 rounded-chip bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-800 transition hover:bg-primary-200 max-md:min-h-8" title={`Remove filter — ${c.label}`}>
                <span className="truncate">{c.label}</span>
                <X size={11} aria-hidden="true" />
                <span className="sr-only">remove</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (ymd: string) => `${Number(ymd.slice(8, 10))} ${MONTHS[Number(ymd.slice(5, 7)) - 1]}`;

/** "Enquiry date · 26 Sep – 2 Oct · Asia/Kolkata" — what the date range is measured against, always stated. */
function contextLine(w: LeadsWorkspace, f: LeadFilters): string {
  const zone = w.period.timezone.replace("_", " ");
  const ctx = w.dateContext;
  if (ctx.kind === "today") return `${ctx.label} · ${short(w.period.today)} · ${zone}${f.range ? " — the date range is not used for this view" : ""}`;
  if (!w.period.from || !w.period.to) return `${ctx.label}: any date · today is ${short(w.period.today)} · ${zone}`;
  const span = w.period.from === w.period.to ? short(w.period.from) : `${short(w.period.from)} – ${short(w.period.to)}`;
  return `${ctx.label} · ${span} · ${zone}`;
}
