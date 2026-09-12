import type { AppointmentAction, AppointmentRow, AppointmentStatus } from "@pulseos/types";
import { Badge, Card, EmptyState, SectionHeading } from "./primitives";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  requested: "Requested",
  scheduled: "Confirmed",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  waiting: "Waiting",
  with_doctor: "With Doctor",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<AppointmentStatus, "neutral" | "warning" | "danger" | "primary"> = {
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

const NEXT_ACTION: Partial<Record<AppointmentStatus, { action: AppointmentAction; label: string }>> = {
  requested: { action: "confirm", label: "Confirm" },
  scheduled: { action: "confirm", label: "Confirm" },
  confirmed: { action: "check_in", label: "Check In" },
  checked_in: { action: "mark_waiting", label: "Mark Waiting" },
  waiting: { action: "send_to_doctor", label: "Send to Doctor" },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function AppointmentList({
  title,
  subtitle,
  rows,
  emptyMessage = "Nothing here",
  onAction,
  onComplete,
  onRowClick,
  showDoctor = true,
}: {
  title: string;
  subtitle?: string;
  rows: AppointmentRow[];
  emptyMessage?: string;
  onAction?: (row: AppointmentRow, action: AppointmentAction) => void;
  onComplete?: (row: AppointmentRow) => void;
  onRowClick?: (row: AppointmentRow) => void;
  showDoctor?: boolean;
}) {
  return (
    <Card className="p-4">
      <SectionHeading title={title} subtitle={subtitle ?? `${rows.length}`} />
      {rows.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <ul className="divide-y divide-neutral-100" data-testid="appointment-list">
          {rows.map((row) => {
            const next = NEXT_ACTION[row.status];
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2" data-testid={`appointment-row-${row.id}`}>
                <button type="button" onClick={() => onRowClick?.(row)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm text-slate-900">{row.patientName}</span>
                  <span className="block truncate text-xs text-neutral-500">
                    {fmtTime(row.scheduledAt)}
                    {showDoctor && row.doctorName ? ` · ${row.doctorName}` : ""}
                    {row.branchName ? ` · ${row.branchName}` : ""}
                  </span>
                </button>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                  {onAction && next && (
                    <button
                      type="button"
                      onClick={() => onAction(row, next.action)}
                      className="rounded border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                      data-testid={`appointment-action-${row.id}`}
                    >
                      {next.label}
                    </button>
                  )}
                  {onComplete && row.status === "with_doctor" && (
                    <button
                      type="button"
                      onClick={() => onComplete(row)}
                      className="rounded bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700"
                      data-testid={`appointment-complete-${row.id}`}
                    >
                      Complete
                    </button>
                  )}
                  {onAction && (row.status === "scheduled" || row.status === "confirmed" || row.status === "requested") && (
                    <button
                      type="button"
                      onClick={() => onAction(row, "mark_no_show")}
                      className="rounded border border-danger-100 px-2 py-1 text-xs font-medium text-danger-700 hover:bg-danger-100"
                      data-testid={`appointment-noshow-${row.id}`}
                    >
                      No-show
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
