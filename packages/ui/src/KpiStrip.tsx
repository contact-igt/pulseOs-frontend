import type { TodayStrip } from "@pulseos/types";
import { MetricStrip } from "./MetricStrip";

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
    <MetricStrip
      testId="kpi-strip"
      cells={KPIS.map((kpi) => ({
        key: String(kpi.key),
        label: kpi.label,
        value: kpi.format ? kpi.format(data[kpi.key]) : data[kpi.key],
        onClick: onSegmentClick ? () => onSegmentClick(kpi.key) : undefined,
        testId: `kpi-${String(kpi.key)}`,
      }))}
    />
  );
}
