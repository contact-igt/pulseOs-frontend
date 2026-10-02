"use client";

import { FilterSelect } from "@pulseos/ui";
import { addDays } from "@/components/report/reportFilters";

const DATE_INPUT = "glass-control h-8 min-w-0 flex-1 rounded-control px-2 text-xs text-ink outline-none focus-visible:border-primary-500 disabled:opacity-50 sm:flex-none max-md:h-11";

export interface PeriodValue {
  range: string | undefined;
  from: string | undefined;
  to: string | undefined;
}

/**
 * Date presets + a custom from/to pair, shared by every list that filters by day. Days are hospital calendar days; the
 * caller passes the hospital's `today`. `allowFuture` lets a range reach ahead (follow-ups due next week).
 * `disabled` greys the control when the active view fixes its own date (and says why via `reason`).
 */
export function PeriodControls({
  presets,
  value,
  today,
  onChange,
  noneLabel,
  allowFuture = false,
  disabled = false,
  reason,
  testIdPrefix,
  label = "Date range",
}: {
  presets: readonly { key: string; label: string }[];
  value: PeriodValue;
  today: string;
  onChange: (next: PeriodValue) => void;
  /** Label for "no date filter" when the page has one (Leads: "Any date"). Omit when a range is always set. */
  noneLabel?: string;
  allowFuture?: boolean;
  disabled?: boolean;
  reason?: string;
  testIdPrefix: string;
  label?: string;
}) {
  const max = allowFuture ? undefined : today;
  return (
    <>
      <FilterSelect
        aria-label={label}
        title={disabled ? reason : undefined}
        value={value.range ?? ""}
        disabled={disabled}
        onChange={(e) => {
          const range = e.target.value || undefined;
          onChange(range === "custom" ? { range, from: addDays(today, -6), to: today } : { range, from: undefined, to: undefined });
        }}
        data-testid={`${testIdPrefix}-range`}
        className="max-md:[&_select]:h-11"
      >
        {noneLabel && <option value="">{noneLabel}</option>}
        {presets.map((p) => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </FilterSelect>
      {value.range === "custom" && !disabled && (
        <div className="flex items-center gap-1.5" data-testid={`${testIdPrefix}-custom-dates`}>
          <input type="date" aria-label="From date" className={DATE_INPUT} value={value.from ?? ""} max={value.to ?? max} onChange={(e) => e.target.value && onChange({ range: "custom", from: e.target.value, to: value.to ?? e.target.value })} data-testid={`${testIdPrefix}-from`} />
          <span className="text-xs text-ink-2" aria-hidden="true">–</span>
          <input type="date" aria-label="To date" className={DATE_INPUT} value={value.to ?? ""} min={value.from} max={max} onChange={(e) => e.target.value && onChange({ range: "custom", from: value.from ?? e.target.value, to: e.target.value })} data-testid={`${testIdPrefix}-to`} />
        </div>
      )}
    </>
  );
}
