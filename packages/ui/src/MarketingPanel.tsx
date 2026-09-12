import type { MarketingSourceRow } from "@pulseos/types";
import { Card, SectionHeading } from "./primitives";

const SOURCE_LABEL: Record<MarketingSourceRow["source"], string> = {
  meta: "Meta",
  google: "Google",
  website: "Website",
  whatsapp: "WhatsApp",
  walk_in: "Walk-in",
  referral: "Referral",
};

export function MarketingPanel({ rows, onSourceClick }: { rows: MarketingSourceRow[]; onSourceClick?: (source: MarketingSourceRow["source"]) => void }) {
  const maxVolume = Math.max(...rows.map((r) => r.volume), 1);
  return (
    <Card className="p-4">
      <SectionHeading title="Marketing / Source" />
      <div className="space-y-2">
        {rows.map((row) => (
          <button
            key={row.source}
            type="button"
            onClick={() => onSourceClick?.(row.source)}
            className="flex w-full items-center gap-3 rounded px-1 py-1 text-left hover:bg-neutral-50"
          >
            <span className="w-20 shrink-0 text-xs text-neutral-600">{SOURCE_LABEL[row.source]}</span>
            <div className="h-3 flex-1 rounded bg-neutral-100">
              <div className="h-3 rounded bg-accent-500" style={{ width: `${Math.max((row.volume / maxVolume) * 100, 4)}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-700">{row.volume}</span>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-neutral-500">
              {row.revenue > 0 ? `₹${row.revenue.toLocaleString("en-IN")}` : "—"}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
