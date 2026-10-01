import { REPORT_RANGES, type ReportFilterOptions, type ReportQuery, type ReportRange } from "@pulseos/types";

// The Operations report's filters live in the URL (shareable, survive refresh/back) under an `r` prefix so they never
// collide with the Command Centre overview's own `branchId` / `journeyType`. Anything malformed falls back to the
// default instead of breaking the page; the server validates again.

export const DEFAULT_REPORT_RANGE: ReportRange = "7d";

const KEYS = { range: "rRange", from: "rFrom", to: "rTo", branchId: "rBranch", service: "rService", sourceId: "rSource", ownerId: "rOwner", doctorId: "rDoctor" } as const;
const RANGES = new Set<string>(REPORT_RANGES.map((r) => r.key));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRealDate(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** URL → a valid query. A custom range without valid dates becomes the default preset. */
export function readReportFilters(get: (key: string) => string, today: string): ReportQuery & { range: ReportRange } {
  const raw = get(KEYS.range);
  let range: ReportRange = RANGES.has(raw) ? (raw as ReportRange) : DEFAULT_REPORT_RANGE;
  const from = get(KEYS.from);
  const to = get(KEYS.to);
  if (range === "custom" && !(isRealDate(from) && isRealDate(to) && from <= to && to <= today)) range = DEFAULT_REPORT_RANGE;
  const id = (k: string) => (UUID.test(get(k)) ? get(k) : undefined);
  const service = get(KEYS.service).slice(0, 120) || undefined;
  return {
    range,
    ...(range === "custom" ? { from, to } : {}),
    ...(id(KEYS.branchId) ? { branchId: id(KEYS.branchId) } : {}),
    ...(service ? { service } : {}),
    ...(id(KEYS.sourceId) ? { sourceId: id(KEYS.sourceId) } : {}),
    ...(id(KEYS.ownerId) ? { ownerId: id(KEYS.ownerId) } : {}),
    ...(id(KEYS.doctorId) ? { doctorId: id(KEYS.doctorId) } : {}),
  };
}

/** A filter change → the URL patch (undefined clears a key). Leaving "custom" drops its dates. */
export function reportFilterPatch(patch: Partial<ReportQuery>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch) as [keyof typeof KEYS, string | undefined][]) out[KEYS[k]] = v || undefined;
  if (patch.range && patch.range !== "custom") Object.assign(out, { [KEYS.from]: undefined, [KEYS.to]: undefined });
  if (patch.range === DEFAULT_REPORT_RANGE) out[KEYS.range] = undefined;
  return out;
}

/** Clears every report filter (and only the report's). */
export function resetReportPatch(): Record<string, undefined> {
  return Object.fromEntries(Object.values(KEYS).map((k) => [k, undefined]));
}

/** A custom range opens on the last 7 hospital days. */
export function customDefaults(today: string): { from: string; to: string } {
  return { from: addDays(today, -6), to: today };
}

export interface ActiveChip {
  key: keyof ReportQuery;
  label: string;
}

/** Human-readable chips for every non-period filter that is set. */
export function activeReportChips(q: ReportQuery, o: ReportFilterOptions | undefined): ActiveChip[] {
  const chips: ActiveChip[] = [];
  const name = <T extends { id: string }>(list: T[] | undefined, id: string, pick: (x: T) => string) => (list?.find((x) => x.id === id) ? pick(list.find((x) => x.id === id)!) : "…");
  if (q.branchId) chips.push({ key: "branchId", label: `Branch: ${name(o?.branches, q.branchId, (b) => b.name)}` });
  if (q.service) chips.push({ key: "service", label: `Service: ${q.service}` });
  if (q.sourceId) chips.push({ key: "sourceId", label: `Source: ${name(o?.sources, q.sourceId, (s) => s.label)}` });
  if (q.ownerId) chips.push({ key: "ownerId", label: `Team member: ${name(o?.owners, q.ownerId, (u) => u.name)}` });
  if (q.doctorId) chips.push({ key: "doctorId", label: `Doctor: ${name(o?.doctors, q.doctorId, (d) => d.name)}` });
  return chips;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (ymd: string, year = false) => `${Number(ymd.slice(8, 10))} ${MONTHS[Number(ymd.slice(5, 7)) - 1]}${year ? ` ${ymd.slice(0, 4)}` : ""}`;

/** "1 Oct 2026" / "25 Sep – 1 Oct 2026" / "28 Dec 2025 – 3 Jan 2026" — always the hospital's calendar days. */
export function periodLabel(from: string, to: string): string {
  if (from === to) return short(from, true);
  return from.slice(0, 4) === to.slice(0, 4) ? `${short(from)} – ${short(to, true)}` : `${short(from, true)} – ${short(to, true)}`;
}
