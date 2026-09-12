import type { DoctorDashboard, DoctorTodayItem } from "@pulseos/types";
import { Badge, Card, EmptyState, SectionHeading } from "./primitives";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_TONE: Record<DoctorTodayItem["status"], "neutral" | "warning" | "danger" | "primary"> = {
  requested: "neutral",
  scheduled: "neutral",
  confirmed: "neutral",
  checked_in: "warning",
  waiting: "warning",
  with_doctor: "primary",
  completed: "neutral",
  no_show: "danger",
  cancelled: "neutral",
};

export function NextPatientCard({ dashboard }: { dashboard: DoctorDashboard }) {
  const next = dashboard.nextPatient;
  return (
    <Card className="p-5">
      <SectionHeading title="Next patient" />
      {!next ? (
        <EmptyState message="No patient waiting right now" />
      ) : (
        <div>
          <p className="text-lg font-semibold text-slate-900">{next.patientName}</p>
          <p className="mt-1 text-sm text-neutral-500">
            {next.journeyType} · {fmtTime(next.appointmentTime)}
          </p>
          {next.reason && <p className="mt-2 text-sm text-neutral-600">{next.reason}</p>}
        </div>
      )}
    </Card>
  );
}

export function DoctorTodayList({ items, title }: { items: DoctorTodayItem[]; title: string }) {
  return (
    <Card className="p-4">
      <SectionHeading title={title} subtitle={`${items.length}`} />
      {items.length === 0 ? (
        <EmptyState message="Nothing here" />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((item) => (
            <li key={item.appointmentId} className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-900">{item.patientName}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-neutral-500">{fmtTime(item.time)}</span>
                <Badge tone={STATUS_TONE[item.status]}>{item.status.replace("_", " ")}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export const AwaitingOutcomeList = DoctorTodayList;
