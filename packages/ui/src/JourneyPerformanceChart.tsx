import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { JourneyPerformancePoint } from "@pulseos/types";
import { Card, SectionHeading } from "./primitives";

const SERIES: { key: keyof JourneyPerformancePoint; label: string; color: string }[] = [
  { key: "enquiries", label: "Enquiries", color: "var(--color-chart-blue)" },
  { key: "appointments", label: "Appointments", color: "var(--color-chart-teal)" },
  { key: "consultations", label: "Consultations", color: "var(--color-chart-indigo)" },
  { key: "treatments", label: "Treatments", color: "var(--color-chart-violet)" },
];

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function JourneyPerformanceChart({
  data,
  windowDays,
  onWindowChange,
}: {
  data: JourneyPerformancePoint[];
  windowDays: number;
  onWindowChange?: (days: number) => void;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <SectionHeading title="Patient Journey Performance" subtitle="Enquiries → appointments → consultations → treatments" />
        {onWindowChange && (
          <div className="flex shrink-0 gap-0.5 rounded border border-neutral-200 p-0.5" role="group" aria-label="Trend window">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onWindowChange(d)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                  windowDays === d ? "bg-primary-50 text-primary-700" : "text-neutral-500 hover:bg-neutral-100"
                }`}
                data-testid={`journey-performance-window-${d}`}
              >
                {d}d
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="h-72 w-full" data-testid="journey-performance-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} axisLine={{ stroke: "var(--color-neutral-200)" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              labelFormatter={(v) => formatDay(v as string)}
              contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid var(--color-neutral-200)" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[2, 2, 0, 0]} maxBarSize={16} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
