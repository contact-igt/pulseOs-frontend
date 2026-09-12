import type { SpendAtRiskCategory, SpendAtRiskCategoryKey, SpendAtRiskSummary } from "@pulseos/types";
import { Card, EmptyState, SectionHeading } from "./primitives";
import { formatInr } from "./format";

export function SpendAtRiskPanel({ data, onCategoryClick }: { data: SpendAtRiskSummary; onCategoryClick?: (key: SpendAtRiskCategoryKey) => void }) {
  const maxSpend = Math.max(...data.categories.map((c) => c.allocatedSpend), 1);

  return (
    <Card className="border-warning-500/30 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-slate-900">Spend At Risk</h2>
        <span className="text-lg font-semibold tabular-nums text-warning-500">{formatInr(data.total)}</span>
      </div>
      {data.categories.every((c) => c.journeyCount === 0) ? (
        <EmptyState message="No acquired journeys currently need recovery action" />
      ) : (
        <ul className="space-y-1.5">
          {data.categories.map((cat: SpendAtRiskCategory) => (
            <li key={cat.key}>
              <button
                type="button"
                onClick={() => onCategoryClick?.(cat.key)}
                disabled={cat.journeyCount === 0}
                className="flex w-full items-center gap-3 rounded px-1 py-1 text-left hover:bg-neutral-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span className="w-48 shrink-0 truncate text-xs text-neutral-600">{cat.label}</span>
                <div className="h-3 flex-1 rounded bg-neutral-100">
                  <div className="h-3 rounded bg-warning-500" style={{ width: `${Math.max((cat.allocatedSpend / maxSpend) * 100, cat.allocatedSpend > 0 ? 4 : 0)}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-700">{cat.journeyCount}</span>
                <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-700">{formatInr(cat.allocatedSpend)}</span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-neutral-400">
                  {cat.oldestAgeDays > 0 ? `${cat.oldestAgeDays}d overdue` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
