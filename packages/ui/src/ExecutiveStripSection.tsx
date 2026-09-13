import type { ExecutiveStrip } from "@pulseos/types";
import { Card } from "./primitives";
import { formatInr, formatMoneyOrDash, formatRoas } from "./format";

interface Metric {
  key: keyof ExecutiveStrip;
  label: string;
  format: (v: number | null) => string;
  tone?: "warning" | "danger";
}

const METRICS: Metric[] = [
  { key: "marketingSpend", label: "Marketing Spend", format: (v) => formatInr(v ?? 0) },
  { key: "enquiries", label: "Enquiries Acquired", format: (v) => String(v ?? 0) },
  { key: "consultations", label: "Consultations", format: (v) => String(v ?? 0) },
  { key: "treatmentsCompleted", label: "Treatments Completed", format: (v) => String(v ?? 0) },
  { key: "attributedRevenue", label: "Attributed Revenue", format: (v) => formatInr(v ?? 0) },
  { key: "roas", label: "ROAS", format: (v) => formatRoas(v) },
  { key: "spendAtRisk", label: "Spend At Risk", format: (v) => formatMoneyOrDash(v ?? 0), tone: "warning" },
];

export function ExecutiveStripSection({ data, onSpendAtRiskClick }: { data: ExecutiveStrip; onSpendAtRiskClick?: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {METRICS.map((m) => {
        const value = data[m.key] as number | null;
        const clickable = m.key === "spendAtRisk";
        return (
          <Card key={m.key} className={`p-3 ${clickable ? "cursor-pointer transition hover:border-warning-500" : ""}`}>
            {clickable ? (
              <button type="button" onClick={onSpendAtRiskClick} className="flex w-full flex-col items-start text-left">
                <span className="text-xl font-semibold tabular-nums text-warning-500">{m.format(value)}</span>
                <span className="mt-1 text-xs leading-tight text-neutral-500">{m.label}</span>
              </button>
            ) : (
              <div className="flex flex-col items-start">
                <span className="text-xl font-semibold tabular-nums text-slate-900">{m.format(value)}</span>
                <span className="mt-1 text-xs leading-tight text-neutral-500">{m.label}</span>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
