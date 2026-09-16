import type { ConsultationOutcomeValue, DoctorTodayItem } from "@pulseos/types";
import { Card, EmptyState, SectionHeading } from "./primitives";
import { fmtTime } from "./format";

const ACTIONS: { outcome: ConsultationOutcomeValue; label: string }[] = [
  { outcome: "CONSULTED", label: "Consultation Completed" },
  { outcome: "TREATMENT_ADVISED", label: "Treatment Advised" },
  { outcome: "DECISION_PENDING", label: "Decision Pending" },
  { outcome: "FOLLOW_UP_REQUIRED", label: "Follow-up Required" },
  { outcome: "NO_TREATMENT_REQUIRED", label: "No Treatment Required" },
];

export function OutcomeActionList({
  items,
  onRecord,
  pendingAppointmentId,
}: {
  items: DoctorTodayItem[];
  onRecord: (appointmentId: string, outcome: ConsultationOutcomeValue) => void;
  pendingAppointmentId?: string | null;
}) {
  return (
    <Card className="p-4">
      <SectionHeading title="Awaiting outcome" subtitle={`${items.length}`} />
      {items.length === 0 ? (
        <EmptyState message="Nothing awaiting an outcome" />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((item) => {
            const isPending = pendingAppointmentId === item.appointmentId;
            return (
              <li key={item.appointmentId} className="py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-900">{item.patientName}</span>
                  <span className="text-xs tabular-nums text-neutral-500">{fmtTime(item.time)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.outcome}
                      type="button"
                      disabled={isPending}
                      onClick={() => onRecord(item.appointmentId, a.outcome)}
                      className="rounded border border-neutral-200 px-2 py-1 text-[11px] text-neutral-600 transition hover:border-primary-500 hover:text-primary-700 disabled:opacity-40"
                      data-testid={`outcome-${a.outcome}-${item.appointmentId}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
