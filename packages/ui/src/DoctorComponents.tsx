import type { DoctorDashboard, DoctorRecentPatient, DoctorTodayItem } from "@pulseos/types";
import { Badge, Card, EmptyState, SectionHeading } from "./primitives";
import { SegmentedRadial } from "./SegmentedRadial";
import { MetricStrip } from "./MetricStrip";

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

const STATUS_LABEL: Record<DoctorTodayItem["status"], string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  waiting: "Waiting",
  with_doctor: "With doctor",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export function DoctorKpiStrip({ dashboard }: { dashboard: DoctorDashboard }) {
  return (
    <MetricStrip
      testId="doctor-kpi-strip"
      cells={[
        { key: "appointments", label: "Appointments today", value: dashboard.todayCount },
        { key: "checked_in", label: "Checked in", value: dashboard.checkedInCount },
        { key: "waiting", label: "Waiting", value: dashboard.waitingNow },
        { key: "with_me", label: "With me", value: dashboard.withMeCount },
        { key: "outcomes_pending", label: "Outcomes pending", value: dashboard.awaitingOutcome.length },
        { key: "follow_ups", label: "Follow-ups due", value: dashboard.treatmentFollowUps.length },
      ]}
    />
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

export function DoctorQuickStats({ dashboard }: { dashboard: DoctorDashboard }) {
  const cells = [
    { key: "awaiting_outcome", label: "Awaiting Outcome", value: dashboard.awaitingOutcome.length },
    { key: "treatment_follow_ups", label: "Treatment Follow-ups", value: dashboard.treatmentFollowUps.length },
    { key: "post_care", label: "Post-care Reviews", value: dashboard.postCare.length },
  ];
  return (
    <Card className="p-0">
      <div className="px-4 pt-3.5">
        <SectionHeading title="Quick Stats" />
      </div>
      <div className="grid grid-cols-3 divide-x divide-neutral-100">
        {cells.map((cell) => (
          <div key={cell.key} className="px-3 py-3 text-center">
            <span className="block text-xl font-semibold tabular-nums text-slate-900">{cell.value}</span>
            <span className="mt-0.5 block text-[11px] leading-tight text-neutral-500">{cell.label}</span>
          </div>
        ))}
      </div>
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
                  {isNext && (
                    <span className="shrink-0 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Next
                    </span>
                  )}
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
