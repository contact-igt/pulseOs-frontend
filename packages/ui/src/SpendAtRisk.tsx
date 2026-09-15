import type { AttentionReason, SpendAtRisk as SpendAtRiskData } from "@pulseos/types";
import { Card, SectionHeading } from "./primitives";
import { formatInrCompact } from "./format";

const REASON_LABEL: Record<AttentionReason, string> = {
  overdue_callback: "Overdue callbacks",
  missed_follow_up: "Missed follow-ups",
  no_show: "No-shows",
  high_intent_uncontacted: "High-intent, uncontacted",
  treatment_decision_pending: "Treatment decisions pending",
};

export function SpendAtRisk({ data, onReasonClick }: { data: SpendAtRiskData; onReasonClick?: (reason: AttentionReason) => void }) {
  const max = Math.max(...data.byReason.map((r) => r.estimatedValue), 1);

  return (
    <Card className="p-4">
      <SectionHeading
        title="Spend At Risk"
        subtitle="Marketing spend tied to unresolved follow-ups"
        action={
          <span className="text-lg font-semibold tabular-nums text-danger-500" data-testid="spend-at-risk-total">
            {formatInrCompact(data.totalAtRisk)}
          </span>
        }
      />
      <div className="space-y-1.5">
        {data.byReason.map((row) => (
          <button
            key={row.reason}
            type="button"
            onClick={() => onReasonClick?.(row.reason)}
            className="flex w-full items-center gap-3 rounded px-1 py-1 text-left hover:bg-neutral-50"
            data-testid={`spend-risk-${row.reason}`}
          >
            <span className="w-40 shrink-0 truncate text-xs text-neutral-600">{REASON_LABEL[row.reason]}</span>
            <div className="h-3 flex-1 rounded bg-neutral-100">
              <div className="h-3 rounded bg-danger-500" style={{ width: `${Math.max((row.estimatedValue / max) * 100, row.estimatedValue > 0 ? 4 : 0)}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-neutral-500">{row.count}</span>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-900">{formatInrCompact(row.estimatedValue)}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
