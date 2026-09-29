import type { PatientFlowCount } from "@pulseos/types";
import { Card, SectionHeading } from "./primitives";

const LABELS: Record<PatientFlowCount["bucket"], string> = {
  confirmed: "Confirmed",
  checked_in: "Checked In",
  waiting: "Waiting",
  with_doctor: "With Doctor",
  completed: "Completed",
};

const COMPACT_LABELS: Record<PatientFlowCount["bucket"], string> = {
  confirmed: "Confirmed",
  checked_in: "Checked in",
  waiting: "Waiting",
  with_doctor: "With Dr.",
  completed: "Done",
};

const COLORS: Record<PatientFlowCount["bucket"], string> = {
  confirmed: "var(--color-neutral-300)",
  checked_in: "var(--color-primary-300)",
  waiting: "var(--color-chart-amber)",
  with_doctor: "var(--color-chart-blue)",
  // Success tone, not the same blue as "with_doctor" (they rendered
  // identically before — primary-500 and chart-blue are the same hex).
  completed: "var(--color-accent-500)",
};

export function PatientFlowBoard({
  data,
  onBucketClick,
  compact = false,
}: {
  data: PatientFlowCount[];
  onBucketClick?: (bucket: PatientFlowCount["bucket"]) => void;
  /** Narrower label set + tighter type for a 1/3-width dashboard panel. */
  compact?: boolean;
}) {
  const rawTotal = data.reduce((sum, r) => sum + r.count, 0);
  const total = Math.max(rawTotal, 1);
  const labels = compact ? COMPACT_LABELS : LABELS;

  return (
    <Card className="p-4">
      <SectionHeading title="Patient Flow Today" subtitle={`${rawTotal} appointments`} />
      <div className="flex h-9 w-full gap-0.5 overflow-hidden rounded-lg bg-neutral-100" data-testid="patient-flow-bar">
        {data.map((row) => (
          <button
            key={row.bucket}
            type="button"
            title={`${LABELS[row.bucket]}: ${row.count}`}
            onClick={() => onBucketClick?.(row.bucket)}
            // A zero-count stage still renders as a thin, subdued sliver (min-width
            // floor + reduced opacity) — never truly 0px, which would read as
            // "this stage doesn't exist" rather than "nothing here yet today".
            className={`h-full min-w-[4px] transition-opacity hover:opacity-80 ${row.count === 0 ? "opacity-30" : ""}`}
            style={{ width: `${(row.count / total) * 100}%`, backgroundColor: COLORS[row.bucket] }}
            data-testid={`flow-bucket-${row.bucket}`}
          />
        ))}
      </div>
      <div className="mt-3 grid w-full gap-1" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((row) => (
          <button
            key={row.bucket}
            type="button"
            onClick={() => onBucketClick?.(row.bucket)}
            className="min-w-0 rounded px-0.5 py-0.5 text-left hover:bg-neutral-50"
          >
            <span className={`block font-semibold tabular-nums ${row.count === 0 ? "text-neutral-400" : "text-slate-900"} ${compact ? "text-sm" : "text-lg"}`}>{row.count}</span>
            <span className={`block text-neutral-500 ${compact ? "text-[9px] leading-tight" : "truncate text-[11px]"}`}>{labels[row.bucket]}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
