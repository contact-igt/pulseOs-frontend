import type { ConversionStage } from "@pulseos/types";
import { Card, SectionHeading } from "./primitives";
import { formatMoneyOrDash } from "./format";

export function ConversionFunnel({ stages, onStageClick }: { stages: ConversionStage[]; onStageClick?: (key: ConversionStage["key"]) => void }) {
  const max = Math.max(...stages.map((s) => s.count), 1);

  let biggestDropIdx = -1;
  let biggestDrop = -1;
  for (let i = 1; i < stages.length; i++) {
    const drop = stages[i - 1].count - stages[i].count;
    if (drop > biggestDrop) {
      biggestDrop = drop;
      biggestDropIdx = i;
    }
  }

  return (
    <Card className="p-4">
      <SectionHeading title="Journey Funnel" subtitle="Enquiry to completed treatment" />
      <div className="space-y-1.5">
        {stages.map((stage, idx) => {
          const widthPct = Math.max((stage.count / max) * 100, 4);
          const pctOfPrev = idx === 0 ? 100 : stages[0].count === 0 ? 0 : Math.round((stage.count / stages[0].count) * 100);
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => onStageClick?.(stage.key)}
              className="flex w-full items-center gap-3 rounded px-1 py-1 text-left hover:bg-neutral-50"
            >
              <span className="w-28 shrink-0 truncate text-xs text-neutral-600">{stage.label}</span>
              <div className="h-4 flex-1 rounded bg-neutral-100">
                <div
                  className={`h-4 rounded ${idx === biggestDropIdx ? "bg-warning-500" : "bg-primary-500"}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-700">{stage.count}</span>
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-neutral-400">{pctOfPrev}%</span>
              <span className="w-20 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                {stage.costPerOutcome !== null ? formatMoneyOrDash(stage.costPerOutcome) : ""}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-right text-[11px] text-neutral-400">cost per outcome, where tracked</p>
    </Card>
  );
}
