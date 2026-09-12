import type { DoctorDashboard, DoctorRecentPatient, DoctorTodayItem } from "@pulseos/types";
import { Badge, Card, EmptyState, SectionHeading } from "./primitives";
import { SegmentedRadial } from "./SegmentedRadial";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_TONE: Record<DoctorTodayItem["status"], "neutral" | "warning" | "danger" | "primary"> = {
  scheduled: "neutral",
  checked_in: "warning",
  with_doctor: "primary",
  completed: "neutral",
  no_show: "danger",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<DoctorTodayItem["status"], string> = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  with_doctor: "With doctor",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

interface DoctorKpiDef {
  label: string;
  value: number;
}

export function DoctorKpiStrip({ dashboard }: { dashboard: DoctorDashboard }) {
  const kpis: DoctorKpiDef[] = [
    { label: "Appointments today", value: dashboard.todayCount },
    { label: "Checked in", value: dashboard.checkedInCount },
    { label: "Waiting", value: dashboard.waitingNow },
    { label: "With me", value: dashboard.withMeCount },
    { label: "Outcomes pending", value: dashboard.awaitingOutcome.length },
    { label: "Follow-ups due", value: dashboard.treatmentFollowUps.length },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="doctor-kpi-strip">
      {kpis.map((k) => (
        <Card key={k.label} className="p-3">
          <span className="block text-xl font-semibold tabular-nums text-slate-900">{k.value}</span>
          <span className="mt-0.5 block text-[11px] leading-tight text-neutral-500">{k.label}</span>
        </Card>
      ))}
    </div>
  );
}

export function DoctorFlowRadial({ dashboard }: { dashboard: DoctorDashboard }) {
  const scheduledCount = dashboard.todayCount;
  const seenCount = dashboard.today.filter((i) => i.status === "with_doctor" || i.status === "completed").length;
  const outcomeCount = dashboard.today.filter((i) => i.status === "completed").length - dashboard.awaitingOutcome.length;

  const segments = [
    { key: "scheduled", label: "Scheduled", count: scheduledCount, pct: 100, color: "var(--color-neutral-300)" },
    { key: "checked_in", label: "Checked In", count: dashboard.checkedInCount, pct: scheduledCount > 0 ? Math.round((dashboard.checkedInCount / scheduledCount) * 100) : 0, color: "var(--color-chart-amber)" },
    { key: "seen", label: "Seen", count: seenCount, pct: scheduledCount > 0 ? Math.round((seenCount / scheduledCount) * 100) : 0, color: "var(--color-chart-blue)" },
    { key: "outcome_recorded", label: "Outcome Recorded", count: Math.max(outcomeCount, 0), pct: scheduledCount > 0 ? Math.round((Math.max(outcomeCount, 0) / scheduledCount) * 100) : 0, color: "var(--color-primary-500)" },
  ];

  return (
    <SegmentedRadial
      title="Today's Patient Flow"
      subtitle={`${scheduledCount} scheduled`}
      segments={segments}
      centerLabel="Today's Completion"
      centerValue={`${dashboard.completionPct}%`}
    />
  );
}

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

export function DoctorTodayList({ items, title, highlightId }: { items: DoctorTodayItem[]; title: string; highlightId?: string }) {
  return (
    <Card className="p-4">
      <SectionHeading title={title} subtitle={`${items.length}`} />
      {items.length === 0 ? (
        <EmptyState message="Nothing here" />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((item) => {
            const isNext = item.appointmentId === highlightId;
            return (
              <li
                key={item.appointmentId}
                className={`flex items-center justify-between rounded px-2 py-2 ${isNext ? "bg-primary-50" : ""}`}
                data-testid={isNext ? "next-patient-row" : undefined}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {isNext && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />}
                  <span className={`truncate text-sm ${isNext ? "font-medium text-primary-700" : "text-slate-900"}`}>{item.patientName}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs tabular-nums text-neutral-500">{fmtTime(item.time)}</span>
                  <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export const AwaitingOutcomeList = DoctorTodayList;

export function RecentPatientsList({ items }: { items: DoctorRecentPatient[] }) {
  return (
    <Card className="p-4">
      <SectionHeading title="Recent Patients" subtitle={`${items.length}`} />
      {items.length === 0 ? (
        <EmptyState message="No recent visits yet" />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((item) => (
            <li key={item.appointmentId} className="flex items-center justify-between py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-900">{item.patientName}</span>
                <span className="block text-xs text-neutral-500">{item.journeyType}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-neutral-500">{fmtTime(item.time)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
