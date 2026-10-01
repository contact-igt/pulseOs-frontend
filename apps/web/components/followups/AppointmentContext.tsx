"use client";

import { CalendarCheck, Plus } from "lucide-react";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, Badge, Button, Card, fmtSmartDateTime } from "@pulseos/ui";
import type { AppointmentRow } from "@pulseos/types";

const OPEN = new Set(["requested", "scheduled", "confirmed", "checked_in", "waiting", "with_doctor"]);

/** The next live appointment on this journey, or null. Deep detail stays on the Appointments page. */
export function nextAppointment(appointments: AppointmentRow[], now: Date): AppointmentRow | null {
  const live = appointments.filter((a) => OPEN.has(a.status) && new Date(a.scheduledAt).getTime() >= now.getTime() - 3 * 3_600_000);
  return live.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0] ?? null;
}

/** One compact line of appointment context beside the Next Action — never a full section. */
export function AppointmentContext({ appointments, canBook, onBook }: { appointments: AppointmentRow[]; canBook: boolean; onBook: () => void }) {
  const appt = nextAppointment(appointments, new Date());
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4" data-testid="appointment-context">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{appt ? "Upcoming appointment" : "Appointment"}</p>
        {appt ? (
          <>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink" data-testid="appointment-context-when">
              <CalendarCheck size={14} aria-hidden="true" className="text-primary-600" />
              {fmtSmartDateTime(appt.scheduledAt)}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
              <span data-testid="appointment-context-doctor">{appt.doctorName ?? "Doctor to be confirmed"}</span>
              <Badge tone={APPOINTMENT_STATUS_TONE[appt.status]}>{APPOINTMENT_STATUS_LABEL[appt.status]}</Badge>
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm font-semibold text-ink" data-testid="appointment-context-empty">No appointment booked</p>
        )}
      </div>
      {!appt && canBook && (
        <Button variant="secondary" className="min-h-11 sm:min-h-0" onClick={onBook} data-testid="appointment-context-book">
          <Plus size={14} aria-hidden="true" /> Book appointment
        </Button>
      )}
    </Card>
  );
}
