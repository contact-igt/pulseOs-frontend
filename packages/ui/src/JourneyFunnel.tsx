import { Card, SectionHeading } from "./primitives";

export interface JourneyFunnelStage {
  key: string;
  label: string;
  count: number;
}

/**
 * Compact conversion funnel: Enquiry → Contacted → Booked → Attended →
 * Consulted → Treatment Converted. Width communicates progression (% of
 * the first stage); the percentage next to each count is also % of the
 * first stage (matches the reading of a funnel — "how much of our starting
 * volume is still here"), with the percentage-point drop since the
 * previous stage shown alongside as the drop-off signal. Deliberately a
 * thin stat list, not a marketing-style tapered graphic — this is an
 * operations dashboard.
 */
export function JourneyFunnel({ stages, onStageClick, testId }: { stages: JourneyFunnelStage[]; onStageClick?: (key: string) => void; testId?: string }) {
  const first = stages[0]?.count ?? 0;

  return (
    <Card className="p-4" data-testid={testId ?? "journey-funnel"}>
      <SectionHeading title="Patient Journey Performance" subtitle="Enquiry → appointment → consultation → treatment" />
      <ul className="space-y-1.5">
        {stages.map((stage, idx) => {
          const pctOfFirst = first > 0 ? Math.round((stage.count / first) * 100) : 0;
          const prevPctOfFirst = idx > 0 && first > 0 ? Math.round((stages[idx - 1].count / first) * 100) : null;
          const dropOffPoints = prevPctOfFirst !== null ? prevPctOfFirst - pctOfFirst : null;
          const barWidthPct = first > 0 ? Math.max(pctOfFirst, stage.count > 0 ? 3 : 0) : 0;

          return (
            <li key={stage.key}>
              <button
                type="button"
                onClick={() => onStageClick?.(stage.key)}
                className="flex w-full items-center gap-2.5 rounded px-1 py-1 text-left hover:bg-neutral-50 disabled:cursor-default disabled:hover:bg-transparent"
                disabled={!onStageClick}
                data-testid={`funnel-stage-${stage.key}`}
              >
                <span className="w-24 shrink-0 truncate text-xs text-neutral-600 sm:w-32">{stage.label}</span>
                <span className="h-4 min-w-[24px] flex-1 overflow-hidden rounded bg-neutral-100">
                  <span className="block h-full rounded bg-primary-500 transition-all" style={{ width: `${barWidthPct}%` }} />
                </span>
                <span className="w-7 shrink-0 text-right text-xs tabular-nums text-slate-900">{stage.count}</span>
                <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-slate-700">{pctOfFirst}%</span>
                <span className="hidden w-14 shrink-0 text-right text-[11px] tabular-nums text-neutral-400 sm:block">
                  {dropOffPoints !== null && dropOffPoints > 0 ? `-${dropOffPoints}pp` : dropOffPoints === 0 ? "flat" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
