export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatMoneyOrDash(amount: number | null): string {
  return amount === null ? "—" : formatInr(amount);
}

// Compact form for dense dashboard contexts (KPI strips, Spend At Risk,
// chart axes) — ₹2.4L / ₹46.7K, never a 3-decimal rupee value. The one
// shared compact formatter; do not duplicate this logic per-page.
export function formatInrCompact(amount: number): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  if (abs >= 100_000) return `₹${(rounded / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `₹${(rounded / 1_000).toFixed(1)}K`;
  return `₹${rounded.toLocaleString("en-IN")}`;
}

export function formatRoas(roas: number | null): string {
  return roas === null ? "—" : `${roas.toFixed(1)}x`;
}

// One date/time presentation per shape, shared across every table/drawer/
// timeline that was previously calling toLocaleDateString/toLocaleTimeString
// with its own slightly-different options object. India-first (en-IN),
// short month names, never a numeric month.

/** "16 Sept" — table cells, due dates, compact contexts. No year (implicitly current/near-term). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "16 Sept 2026" — contexts spanning more than the current year (campaign date ranges, etc). */
export function fmtDateWithYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "2:30 PM" — time-only contexts (queues, timelines). */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/** "16 Sept, 2:30 PM" — the common combined case. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * "Today, 2:30 PM" / "Yesterday, 4:10 PM" / "16 Sept, 2:30 PM" — the
 * context-aware form for activity feeds where "today"/"yesterday" reads
 * faster than a repeated date. Falls back to fmtDateTime beyond that.
 */
export function fmtSmartDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;
  return `${fmtDate(iso)}, ${time}`;
}

/** "just now" / "12m ago" / "3h ago" / "5d ago" — recency-relative, for feeds where exact time matters less than how fresh it is. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * "12m overdue" / "3h overdue" / "Due in 2d" — the shared due-date urgency
 * cue for anything with an SLA (Attention queue, task lists). `overdue`
 * drives the caller's severity styling (dot color, text color) so overdue
 * always reads as the strongest cue, never just another badge color.
 */
export function urgencyLabel(dueAt: string): { text: string; overdue: boolean } {
  const diffMins = Math.round((new Date(dueAt).getTime() - Date.now()) / 60_000);
  if (diffMins <= 0) {
    const overdueMins = -diffMins;
    if (overdueMins < 60) return { text: `${Math.max(overdueMins, 1)}m overdue`, overdue: true };
    const hours = Math.round(overdueMins / 60);
    if (hours < 24) return { text: `${hours}h overdue`, overdue: true };
    return { text: `${Math.round(hours / 24)}d overdue`, overdue: true };
  }
  if (diffMins < 60) return { text: `Due in ${diffMins}m`, overdue: false };
  const hours = Math.round(diffMins / 60);
  if (hours < 24) return { text: `Due in ${hours}h`, overdue: false };
  return { text: `Due in ${Math.round(hours / 24)}d`, overdue: false };
}
