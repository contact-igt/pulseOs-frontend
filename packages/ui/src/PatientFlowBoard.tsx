import type { PatientFlowCount } from "@pulseos/types";
import { Card, SectionHeading } from "./primitives";

const LABELS: Record<PatientFlowCount["bucket"], string> = {
  waiting: "Waiting",
  checked_in: "Checked in",
  with_doctor: "With doctor",
  consultation_complete: "Consultation complete",
  follow_up_required: "Follow-up required",
};

export function PatientFlowBoard({ data, onBucketClick }: { data: PatientFlowCount[]; onBucketClick?: (bucket: PatientFlowCount["bucket"]) => void }) {
  return (
    <Card className="p-4">
      <SectionHeading title="Patient Flow" />
      <div className="grid grid-cols-5 gap-2">
        {data.map((row) => (
          <button
            key={row.bucket}
            type="button"
            onClick={() => onBucketClick?.(row.bucket)}
            className="flex flex-col items-start rounded border border-neutral-200 p-2 text-left hover:border-primary-300"
          >
            <span className="text-lg font-semibold tabular-nums text-slate-900">{row.count}</span>
            <span className="text-[11px] leading-tight text-neutral-500">{LABELS[row.bucket]}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
