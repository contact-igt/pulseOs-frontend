import type { TodayStrip } from "@pulseos/types";
import { Card } from "./primitives";

interface KpiDef {
  key: keyof TodayStrip;
  label: string;
  tone?: "default" | "warning" | "danger";
}

const KPIS: KpiDef[] = [
  { key: "newEnquiries", label: "New enquiries" },
  { key: "uncontacted", label: "Uncontacted", tone: "warning" },
  { key: "followUpsDue", label: "Follow-ups due", tone: "warning" },
  { key: "appointmentsToday", label: "Appointments today" },
  { key: "waitingNow", label: "Waiting now" },
  { key: "noShows", label: "No-shows", tone: "danger" },
  { key: "consultationsCompleted", label: "Consultations done" },
  { key: "treatmentDecisionsPending", label: "Treatment decisions pending", tone: "warning" },
];

export function KpiStripSection({ data, onSegmentClick }: { data: TodayStrip; onSegmentClick?: (key: keyof TodayStrip) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {KPIS.map((kpi) => (
        <Card key={String(kpi.key)} className="cursor-pointer p-3 transition hover:border-primary-300" data-testid={`kpi-${String(kpi.key)}`}>
          <button
            type="button"
            onClick={() => onSegmentClick?.(kpi.key)}
            className="flex w-full flex-col items-start text-left"
          >
            <span
              className={`text-2xl font-semibold tabular-nums ${
                kpi.tone === "danger" ? "text-danger-500" : kpi.tone === "warning" ? "text-warning-500" : "text-slate-900"
              }`}
            >
              {data[kpi.key]}
            </span>
            <span className="mt-1 text-xs leading-tight text-neutral-500">{kpi.label}</span>
          </button>
        </Card>
      ))}
    </div>
  );
}
