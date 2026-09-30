"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

/**
 * Page filters (branch, doctor, tab, search...) kept in the URL next to the
 * view/date that useViewState owns. `router.replace`, so filtering never adds
 * history entries; refresh and back/forward restore the same filtered view.
 */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const get = useCallback((key: string) => params.get(key) ?? "", [params]);
  const set = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return { get, set };
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
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      try {
        await fn();
      } catch (err) {
        const code = err instanceof ApiError ? err.message : "";
        setError(ACTION_ERROR[code] ?? "Could not update the appointment. Please try again.");
      } finally {
        refresh();
        onDone();
      }
    },
    [refresh, onDone],
  );

  return {
    error,
    clearError: useCallback(() => setError(null), []),
    handleAction: useCallback((row: AppointmentRow, action: AppointmentAction) => run(() => api.appointmentAction(row.id, action)), [run]),
    handleComplete: useCallback((row: AppointmentRow) => run(() => api.completeAppointment(row.id)), [run]),
    handleReschedule: useCallback((row: AppointmentRow, iso: string) => run(() => api.rescheduleAppointment(row.id, iso)), [run]),
  };
}
