"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@pulseos/api-client";
import { localDayKey } from "@pulseos/ui";
import { useHospitalTimeZone } from "@/lib/useHospitalTimeZone";
import type { AppointmentAction, AppointmentRow } from "@pulseos/types";

/** The hospital's timezone (session) and its local "today" (server clock once loaded; never the browser's zone). */
export function useCalendarContext() {
  const timeZone = useHospitalTimeZone();
  const q = useQuery({ queryKey: ["calendar-context"], queryFn: api.appointmentCalendarContext, staleTime: 5 * 60_000 });
  return { timeZone, today: q.data?.today ?? localDayKey(new Date(), timeZone), ready: q.isSuccess };
}

const ACTION_ERROR: Record<string, string> = {
  invalid_transition: "That step is not allowed from the appointment's current status - it may have just changed. The list has been refreshed.",
  appointment_closed: "This appointment is already closed (completed or cancelled). The list has been refreshed.",
  not_with_doctor: "Only a patient who is with the doctor can be marked complete. The list has been refreshed.",
  appointment_not_found: "This appointment could not be found. The list has been refreshed.",
};

/**
 * The page's existing appointment actions (action / complete / reschedule),
 * unchanged on success. A server rejection (e.g. a stale status -> 409) no
 * longer escapes as an unhandled rejection: it becomes an inline message and
 * the data is refetched so the view shows the server's truth.
 */
export function useAppointmentActions({ refresh, onDone }: { refresh: () => void; onDone: () => void }) {
  // The appointment changed on the server: the drawer closes and this notice explains why.
  const [error, setError] = useState<string | null>(null);
  // A recoverable failure (network, 5xx): the drawer stays open with what was typed in it, and the
  // message belongs to THAT appointment only — it never shows on another one's drawer.
  const [drawerError, setDrawerError] = useState<{ id: string; message: string } | null>(null);

  const run = useCallback(
    async (rowId: string, fn: () => Promise<unknown>) => {
      setError(null);
      setDrawerError(null);
      try {
        await fn();
        onDone();
      } catch (err) {
        const code = err instanceof ApiError ? err.message : "";
        const changed = ACTION_ERROR[code];
        if (changed) {
          setError(changed);
          onDone();
        } else {
          setDrawerError({ id: rowId, message: "Could not update the appointment. Please try again." });
        }
      } finally {
        refresh();
      }
    },
    [refresh, onDone],
  );

  return {
    error,
    clearError: useCallback(() => setError(null), []),
    drawerErrorFor: useCallback((id: string | undefined) => (id && drawerError?.id === id ? drawerError.message : null), [drawerError]),
    clearDrawerError: useCallback(() => setDrawerError(null), []),
    handleAction: useCallback((row: AppointmentRow, action: AppointmentAction) => run(row.id, () => api.appointmentAction(row.id, action)), [run]),
    handleComplete: useCallback((row: AppointmentRow) => run(row.id, () => api.completeAppointment(row.id)), [run]),
    handleReschedule: useCallback((row: AppointmentRow, iso: string) => run(row.id, () => api.rescheduleAppointment(row.id, iso)), [run]),
  };
}
