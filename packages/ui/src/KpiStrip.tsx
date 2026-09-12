import type { TodayStrip } from "@pulseos/types";
import { Card } from "./primitives";

interface KpiDef {
  key: keyof TodayStrip;
  label: string;
  format?: (n: number) => string;
}

function formatInr(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const KPIS: KpiDef[] = [
  { key: "newEnquiries", label: "New enquiries" },
  { key: "appointmentsToday", label: "Appointments today" },
  { key: "waitingNow", label: "Waiting now" },
  { key: "consultationsCompleted", label: "Consultations" },
  { key: "treatmentDecisionsPending", label: "Treatment decisions" },
  { key: "attributedRevenue", label: "Attributed revenue", format: formatInr },
];

export function KpiStripSection({ data, onSegmentClick }: { data: TodayStrip; onSegmentClick?: (key: keyof TodayStrip) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="kpi-strip">
      {KPIS.map((kpi) => {
        const value = data[kpi.key];
        return (
          <Card key={String(kpi.key)} className="p-3 transition hover:border-primary-300" data-testid={`kpi-${String(kpi.key)}`}>
            <button type="button" onClick={() => onSegmentClick?.(kpi.key)} className="flex w-full flex-col items-start text-left">
              <span className="text-xl font-semibold tabular-nums text-slate-900">{kpi.format ? kpi.format(value) : value}</span>
              <span className="mt-0.5 text-[11px] leading-tight text-neutral-500">{kpi.label}</span>
            </button>
          </Card>
        );
      })}
    </div>
  );
}
