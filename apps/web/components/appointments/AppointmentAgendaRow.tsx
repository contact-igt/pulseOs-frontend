"use client";

import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, Badge } from "@pulseos/ui";
import type { AppointmentRow } from "@pulseos/types";
import { fmtTimeInZone } from "./appointmentViews";

/**
 * One appointment as a compact agenda row (time, patient, context, status as
 * text). The whole row is a button that opens the existing appointment drawer.
 */
export function AppointmentAgendaRow({
  row,
  timeZone,
  context,
  onSelect,
  testId,
}: {
  row: AppointmentRow;
  timeZone: string;
  /** Secondary line, e.g. doctor or reason. */
  context?: string;
  onSelect: (row: AppointmentRow) => void;
  testId: string;
}) {
  const status = APPOINTMENT_STATUS_LABEL[row.status];
  const time = fmtTimeInZone(row.scheduledAt, timeZone);
  const closed = row.status === "cancelled";
  return (
    <button
      type="button"
      onClick={() => onSelect(row)}
      aria-label={`${time}, ${row.patientName}, ${status}. Open appointment`}
      data-testid={testId}
      className="flex min-h-11 w-full items-center gap-3 rounded-control px-2 py-1.5 text-left transition hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500"
    >
      <span className="w-16 shrink-0 text-xs font-medium tabular-nums text-ink-2">{time}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate text-sm font-medium text-ink ${closed ? "line-through decoration-neutral-400" : ""}`}>{row.patientName}</span>
        {context && <span className="truncate text-xs text-ink-2">{context}</span>}
      </span>
      <Badge tone={APPOINTMENT_STATUS_TONE[row.status]}>{status}</Badge>
    </button>
  );
}
