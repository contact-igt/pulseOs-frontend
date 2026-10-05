import { and, asc, eq, gt, lte } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { appointments } from "../../db/schema.js";
import type { DueJob } from "../../jobs/runner.js";
import { planForSubject } from "./notification.service.js";

// Safety net for the one gap the in-process "appointment.confirmed" event cannot close: the visit is CONFIRMED and committed,
// but the process died before the confirmation / reminders were planned (and a second Confirm click is, by design, a no-op).
//
// The appointment row is the truth about what SHOULD exist; the notification rows are what DOES. This pass does not decide
// anything itself: for each confirmed, upcoming visit it asks the same idempotent planner the event uses. Planning is keyed
// in the database (unique tenant + rule + visit + start time), so a visit that is already fully planned costs a few reads and
// writes nothing, a partly planned one is completed, and concurrent runs cannot double anything. The planner also owns every
// rule: capability off, rule off, no reminder in the past, a visit that is no longer confirmed. Sending stays with the
// worker, which re-reads the visit and refuses anything that is no longer confirmed.

/** Visits further out than this are picked up by a later run. Past visits are never touched: a confirmation for a visit that has started is useless. */
export const RECONCILE_HORIZON_DAYS = 7;
/** Bounds one run; the oldest-due visits go first and the rest follow on the next run. */
export const RECONCILE_BATCH = 500;
/** One pass every few minutes is plenty for the pilot; override with NOTIFICATION_RECONCILE_INTERVAL_MS. */
export const RECONCILE_DEFAULT_INTERVAL_MS = 5 * 60_000;

export interface ReconcileResult {
  /** Confirmed upcoming visits looked at. */
  inspected: number;
  /** Notifications that were missing and are now planned (confirmations + reminders). */
  recovered: number;
  /** Visits whose planning threw; the next run tries them again. */
  errors: number;
}

export async function reconcileAppointmentNotifications(db: Db, now: Date = new Date(), opts: { horizonDays?: number; batch?: number } = {}): Promise<ReconcileResult> {
  const horizon = new Date(now.getTime() + (opts.horizonDays ?? RECONCILE_HORIZON_DAYS) * 86_400_000);
  const visits = await db
    .select({ id: appointments.id, tenantId: appointments.tenantId })
    .from(appointments)
    .where(and(eq(appointments.status, "confirmed"), gt(appointments.scheduledAt, now), lte(appointments.scheduledAt, horizon)))
    .orderBy(asc(appointments.scheduledAt))
    .limit(opts.batch ?? RECONCILE_BATCH);

  const result: ReconcileResult = { inspected: visits.length, recovered: 0, errors: 0 };
  for (const v of visits) {
    try {
      result.recovered += (await planForSubject(db, v.tenantId, "APPOINTMENT", v.id, now)).planned;
    } catch {
      result.errors++; // never log the visit's details: ids only would be enough, and a retry follows anyway
    }
  }
  return result;
}

/**
 * The runner wakes every few seconds; this job runs the pass only when its own interval has elapsed. State is just the last
 * run time - losing it on a restart means one extra (harmless, idempotent) pass.
 */
export function reconcileJob(db: Db, log: (msg: string, detail?: unknown) => void, intervalMs = RECONCILE_DEFAULT_INTERVAL_MS): DueJob {
  let last = 0;
  return {
    name: "notification-reconcile",
    run: async (now) => {
      if (now.getTime() - last < intervalMs) return;
      last = now.getTime();
      const r = await reconcileAppointmentNotifications(db, now);
      // Counts only: nothing about a patient, a phone number or a message ever reaches the log.
      if (r.recovered > 0 || r.errors > 0) log("notification reconcile", r);
      return { ...r };
    },
  };
}
