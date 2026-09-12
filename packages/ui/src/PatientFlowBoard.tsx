import type { PatientFlowCount } from "@pulseos/types";
import { Card, SectionHeading } from "./primitives";

const LABELS: Record<PatientFlowCount["bucket"], string> = {
  confirmed: "Confirmed",
  checked_in: "Checked In",
  with_doctor: "With Doctor",
  completed: "Completed",
};

const COLORS: Record<PatientFlowCount["bucket"], string> = {
  confirmed: "var(--color-neutral-300)",
  checked_in: "var(--color-chart-amber)",
  with_doctor: "var(--color-chart-blue)",
  completed: "var(--color-primary-500)",
};

export function PatientFlowBoard({ data, onBucketClick }: { data: PatientFlowCount[]; onBucketClick?: (bucket: PatientFlowCount["bucket"]) => void }) {
  const rawTotal = data.reduce((sum, r) => sum + r.count, 0);
  const total = Math.max(rawTotal, 1);

  return (
    <Card className="p-4">
      <SectionHeading title="Patient Flow Today" subtitle={`${rawTotal} appointments`} />
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100">
        {data.map((row) => (
          <button
            key={row.bucket}
            type="button"
            title={`${LABELS[row.bucket]}: ${row.count}`}
            onClick={() => onBucketClick?.(row.bucket)}
            className="h-full transition-opacity hover:opacity-80"
            style={{ width: `${(row.count / total) * 100}%`, backgroundColor: COLORS[row.bucket] }}
            data-testid={`flow-bucket-${row.bucket}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {data.map((row) => (
          <button
            key={row.bucket}
            type="button"
            onClick={() => onBucketClick?.(row.bucket)}
            className="flex items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-neutral-50"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[row.bucket] }} />
            <span className="text-xs text-neutral-600">{LABELS[row.bucket]}</span>
            <span className="text-xs font-medium tabular-nums text-slate-900">{row.count}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
