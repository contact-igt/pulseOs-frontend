import { eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { tenants } from "../../db/schema.js";
import type { AnalyticsBucket, AnalyticsGranularity, AnalyticsPeriod, AnalyticsQuery } from "@pulseos/types";

/** A malformed filter (bad range, inverted dates...) — the route maps this to HTTP 400. */
export class AnalyticsInputError extends Error {}

const MAX_RANGE_DAYS = 366;
const PRESET_DAYS = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 } as const;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

// --- Pure calendar arithmetic on YYYY-MM-DD strings (no timezone involved) ---

export function isRealDate(ymd: string): boolean {
  if (!YMD.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

export function addDays(ymd: string, n: number): string {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** b - a in whole calendar days. */
export function diffDays(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY_MS);
}

// --- Timezone SQL ---

/**
 * The tenant timezone as an inlined SQL string literal. It is inlined (not a
 * bind parameter) so `GROUP BY` / `SELECT` expressions containing it are
 * textually identical. The value comes from tenants.timezone — never from a
 * request — and is still whitelisted by shape.
 */
export function tzLiteral(timezone: string): SQL {
  if (!/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/.test(timezone)) throw new Error(`Invalid timezone: ${timezone}`);
  return sql.raw(`'${timezone}'`);
}

/** Local calendar day (YYYY-MM-DD, in the tenant's zone) of a timestamptz column. */
export function localDay(column: unknown, timezone: string): SQL<string> {
  return sql<string>`to_char(${column} at time zone ${tzLiteral(timezone)}, 'YYYY-MM-DD')`;
}

/** `column` falls on a local day between `from` and `to` inclusive, in the tenant's zone (DST-safe). */
export function inLocalRange(column: unknown, timezone: string, from: string, to: string): SQL {
  const tz = tzLiteral(timezone);
  return sql`${column} >= (${from}::date)::timestamp at time zone ${tz} and ${column} < ((${to}::date + 1))::timestamp at time zone ${tz}`;
}

export async function tenantTimezone(db: Db, tenantId: string): Promise<string> {
  const [row] = await db.select({ timezone: tenants.timezone }).from(tenants).where(eq(tenants.id, tenantId));
  return row?.timezone ?? "Asia/Kolkata";
}

/** The local calendar day `now` falls on in `timezone`. */
export async function localToday(db: Db, timezone: string, now: Date): Promise<string> {
  const rows = await db.execute<{ d: string }>(sql`select to_char(${now.toISOString()}::timestamptz at time zone ${tzLiteral(timezone)}, 'YYYY-MM-DD') as d`);
  return [...rows][0].d;
}

export async function resolvePeriod(db: Db, tenantId: string, query: Pick<AnalyticsQuery, "range" | "from" | "to">, now: Date = new Date()): Promise<AnalyticsPeriod> {
  const timezone = await tenantTimezone(db, tenantId);
  const preset = query.range ?? "30d";
  const today = await localToday(db, timezone, now);
  let from: string;
  let to: string;

  if (preset === "custom") {
    if (!query.from || !query.to || !isRealDate(query.from) || !isRealDate(query.to)) {
      throw new AnalyticsInputError("A custom range needs valid from and to dates (YYYY-MM-DD)");
    }
    from = query.from;
    to = query.to;
    if (diffDays(from, to) < 0) throw new AnalyticsInputError("Invalid range: 'from' must not be after 'to'");
    if (diffDays(from, to) + 1 > MAX_RANGE_DAYS) throw new AnalyticsInputError(`Invalid range: at most ${MAX_RANGE_DAYS} days`);
  } else {
    to = today;
    from = addDays(to, -(PRESET_DAYS[preset] - 1));
  }

  const days = diffDays(from, to) + 1;
  const previousTo = addDays(from, -1);
  return { preset, from, to, days, previousFrom: addDays(previousTo, -(days - 1)), previousTo, timezone, today };
}

// --- Buckets: a local day, or a 7-day block anchored at the period start ---

export function leadsGranularity(days: number): AnalyticsGranularity {
  return days <= 31 ? "day" : "week";
}

export function revenueGranularity(days: number): AnalyticsGranularity {
  return days <= 7 ? "day" : "week";
}

export const binDays = (g: AnalyticsGranularity) => (g === "day" ? 1 : 7);

export function buildBuckets(from: string, days: number, granularity: AnalyticsGranularity): AnalyticsBucket[] {
  const size = binDays(granularity);
  const last = addDays(from, days - 1);
  const out: AnalyticsBucket[] = [];
  for (let offset = 0; offset < days; offset += size) {
    const key = addDays(from, offset);
    const to = addDays(key, size - 1) > last ? last : addDays(key, size - 1);
    const span = diffDays(key, to) + 1;
    out.push({ key, to, days: span, partial: span < size });
  }
  return out;
}

/** Index of the bucket a local day belongs to, or -1 when outside the period. */
export function bucketIndex(day: string, from: string, days: number, granularity: AnalyticsGranularity): number {
  const offset = diffDays(from, day);
  if (offset < 0 || offset >= days) return -1;
  return Math.floor(offset / binDays(granularity));
}
