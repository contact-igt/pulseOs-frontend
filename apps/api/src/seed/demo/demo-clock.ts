// A stable "demo clock" for same-day seed data.
//
// Today's clinic queue (waiting / checked in / with doctor / completed /
// upcoming) must look plausible whenever the demo is seeded — 7 am or 9 pm —
// so appointment times are placed relative to a clinic-hours "demo now": the
// real time of day, clamped into 11:00–17:30. Seeded at 6 am the queue still
// reads as a busy mid-morning; at 11 pm it reads as the end of the clinic day,
// never a "waiting" patient scheduled hours in the future or an "upcoming"
// one already in the past.

export const DEMO_NOW_EARLIEST_MINUTES = 11 * 60;
export const DEMO_NOW_LATEST_MINUTES = 17 * 60 + 30;
const CLINIC_OPENS_MINUTES = 8 * 60;

/** `now` with its time of day clamped into clinic hours (same calendar day). */
export function demoNow(now: Date = new Date()): Date {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const clamped = Math.min(Math.max(minutes, DEMO_NOW_EARLIEST_MINUTES), DEMO_NOW_LATEST_MINUTES);
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(Math.floor(clamped / 15) * 15);
  return d;
}

type TodayStatus = "scheduled" | "confirmed" | "checked_in" | "waiting" | "with_doctor" | "completed" | "no_show" | "cancelled";

// Minutes relative to demo-now. Negative = already happened / arrived.
const MINUTES_BY_STATUS: Record<TodayStatus, { base: number; step: number }> = {
  completed: { base: -120, step: -30 }, // earlier ones finished earlier still
  with_doctor: { base: -30, step: -15 },
  waiting: { base: -45, step: -10 },
  checked_in: { base: -20, step: -10 },
  scheduled: { base: 120, step: 30 },
  confirmed: { base: 120, step: 30 },
  no_show: { base: -180, step: -30 },
  cancelled: { base: -180, step: -30 },
};

/**
 * Scheduled time for a same-day appointment given its status. `ordinal` is how
 * many earlier same-status appointments exist today, so several completed
 * visits are staggered instead of stacked on one minute.
 */
export function todaySlot(status: TodayStatus, ordinal: number, now: Date = new Date()): Date {
  const { base, step } = MINUTES_BY_STATUS[status];
  const slot = demoNow(now);
  const candidate = slot.getHours() * 60 + slot.getMinutes() + base + step * ordinal;
  // Past slots may not precede opening; upcoming slots may not run past 19:00.
  const bounded = Math.min(Math.max(candidate, CLINIC_OPENS_MINUTES), 19 * 60);
  slot.setHours(0, 0, 0, 0);
  slot.setMinutes(Math.round(bounded / 15) * 15);
  return slot;
}
