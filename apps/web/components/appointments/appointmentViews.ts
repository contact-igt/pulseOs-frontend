import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, visibleRange } from "@pulseos/ui";
import type { CalendarEvent } from "@pulseos/ui";
import type { AppointmentRangeFilters, AppointmentRow, AppointmentStatus, DoctorTodayItem } from "@pulseos/types";

// Pure view-model helpers shared by the Appointments, Doctor Home and Front
// Desk alternate views. Every view is a presentation of the SAME query result;
// these only decide which rows/range to ask for and how to group them.

export const APPOINTMENT_VIEWS = ["list", "day", "week", "month", "doctors"] as const;
export type AppointmentView = (typeof APPOINTMENT_VIEWS)[number];

export type ListTab = "today" | "upcoming" | "no_show" | "completed";
export const LIST_TABS: readonly ListTab[] = ["today", "upcoming", "no_show", "completed"];

/**
 * The /appointments filters for a view. List/Today, Day and Doctor Schedule all
 * ask for the selected local day (so they return identical rows); Week/Month ask
 * for the visible grid. The list-only status tabs never apply to calendar views.
 */
export function appointmentQuery(input: { view: AppointmentView; tab: ListTab; date: string; branchId: string; doctorId: string }): AppointmentRangeFilters {
  const common = { branchId: input.branchId || undefined, doctorId: input.doctorId || undefined };
  if (input.view === "week" || input.view === "month") return { ...visibleRange(input.view, input.date), ...common };
  if (input.view === "day" || input.view === "doctors" || input.tab === "today") return { from: input.date, to: input.date, ...common };
  if (input.tab === "no_show" || input.tab === "completed") return { status: input.tab, ...common };
  return common;
}

export function matchesSearch(row: { patientName: string }, q: string): boolean {
  const needle = q.trim().toLowerCase();
  return !needle || row.patientName.toLowerCase().includes(needle);
}

export function toCalendarEvent(row: AppointmentRow): CalendarEvent<AppointmentRow> {
  const status = APPOINTMENT_STATUS_LABEL[row.status];
  return {
    id: row.id,
    start: row.scheduledAt,
    title: row.patientName,
    subtitle: [row.doctorName, row.reason].filter(Boolean).join(" · "),
    status,
    state: row.status === "completed" ? "completed" : row.status === "cancelled" ? "cancelled" : "default",
    tone: APPOINTMENT_STATUS_TONE[row.status],
    data: row,
  };
}

const byTime = <T,>(at: (x: T) => string) => (a: T, b: T) => new Date(at(a)).getTime() - new Date(at(b)).getTime();

export interface DoctorGroup {
  doctorId: string;
  doctorName: string;
  rows: AppointmentRow[];
}

export function groupByDoctor(rows: AppointmentRow[]): DoctorGroup[] {
  const map = new Map<string, DoctorGroup>();
  for (const r of rows) {
    const g = map.get(r.doctorId) ?? { doctorId: r.doctorId, doctorName: r.doctorName ?? "Unassigned doctor", rows: [] };
    g.rows.push(r);
    map.set(r.doctorId, g);
  }
  const groups = [...map.values()];
  for (const g of groups) g.rows.sort(byTime((r) => r.scheduledAt));
  return groups.sort((a, b) => a.doctorName.localeCompare(b.doctorName));
}

export type FlowGroupKey = "arrived" | "with_doctor" | "expected" | "seen" | "not_arrived";

export const FLOW_GROUPS: { key: FlowGroupKey; label: string; statuses: AppointmentStatus[] }[] = [
  { key: "arrived", label: "Arrived · waiting", statuses: ["checked_in", "waiting"] },
  { key: "with_doctor", label: "With doctor", statuses: ["with_doctor"] },
  { key: "expected", label: "Expected", statuses: ["requested", "scheduled", "confirmed"] },
  { key: "seen", label: "Seen", statuses: ["completed"] },
  { key: "not_arrived", label: "No-show / cancelled", statuses: ["no_show", "cancelled"] },
];

/** Today's rows grouped by arrival state (operational order), each group time-ordered. Empty groups are kept so the flow reads the same every day. */
export function groupTodayFlow(rows: AppointmentRow[]): { key: FlowGroupKey; label: string; rows: AppointmentRow[] }[] {
  return FLOW_GROUPS.map((g) => ({ key: g.key, label: g.label, rows: rows.filter((r) => g.statuses.includes(r.status)).sort(byTime((r) => r.scheduledAt)) }));
}

const hourFmt = new Map<string, Intl.DateTimeFormat>();
function localHour(iso: string, timeZone: string): number {
  let f = hourFmt.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" });
    hourFmt.set(timeZone, f);
  }
  return Number(f.format(new Date(iso))) % 24;
}

export type DayPartKey = "morning" | "afternoon" | "evening";
const DAY_PARTS: { key: DayPartKey; label: string; test: (h: number) => boolean }[] = [
  { key: "morning", label: "Morning", test: (h) => h < 12 },
  { key: "afternoon", label: "Afternoon", test: (h) => h >= 12 && h < 17 },
  { key: "evening", label: "Evening", test: (h) => h >= 17 },
];

/** A doctor's day split into Morning (<12) / Afternoon (12-17) / Evening, by the hospital's local hour. Empty parts are omitted. */
export function groupDayParts(items: DoctorTodayItem[], timeZone: string): { key: DayPartKey; label: string; items: DoctorTodayItem[] }[] {
  const sorted = [...items].sort(byTime((i) => i.time));
  return DAY_PARTS.map((p) => ({ key: p.key, label: p.label, items: sorted.filter((i) => p.test(localHour(i.time, timeZone))) })).filter((p) => p.items.length > 0);
}

const timeFmt = new Map<string, Intl.DateTimeFormat>();
/** "2:00 pm" in the hospital zone (never the browser's). */
export function fmtTimeInZone(iso: string, timeZone: string): string {
  let f = timeFmt.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-IN", { timeZone, hour: "numeric", minute: "2-digit", hour12: true });
    timeFmt.set(timeZone, f);
  }
  return f.format(new Date(iso)).replace(/\s/g, " ").toLowerCase();
}
