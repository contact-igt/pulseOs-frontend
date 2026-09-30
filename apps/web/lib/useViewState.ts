"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isDayKey, localDayKey, type CalendarMode } from "@pulseos/ui";

export type ViewRange = "day" | "week" | "month";
const RANGES: readonly ViewRange[] = ["day", "week", "month"];

export interface ViewState<V extends string> {
  view: V;
  /** Selected day, `yyyy-mm-dd` in `timeZone` (defaults to today there). */
  date: string;
  range: ViewRange;
  /** What a calendar shows: the range grid, or Agenda (`cal=agenda`) listing that same span. */
  calendarMode: CalendarMode;
}

export interface UseViewStateOptions<V extends string> {
  /** Allowed `view` values; anything else in the URL falls back to `defaultView`. */
  views: readonly V[];
  defaultView: V;
  defaultRange?: ViewRange;
  /** Hospital/tenant IANA zone - decides what "today" is when `date` is absent. */
  timeZone: string;
}

/**
 * URL-backed view state: ONLY `view`, `date`, `range` and `cal` (Agenda). Refresh, back/forward
 * and shared links restore the same view. Every other query param (filters, page,
 * search) is left exactly as it was - this hook is not a filter store.
 * `router.replace` with `scroll: false`, so switching views never adds history
 * entries or jumps the page.
 *
 * Call sites need a Suspense boundary above them only if the page is statically
 * rendered; pages under the authenticated `(app)` layout are dynamic.
 */
export function useViewState<V extends string>({ views, defaultView, defaultRange = "week", timeZone }: UseViewStateOptions<V>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const rawView = params.get("view");
  const rawDate = params.get("date");
  const rawRange = params.get("range");
  // The URL this hook last wrote but the router has not surfaced yet: a second
  // update in the same handler (e.g. open a day = date + Day mode) builds on it
  // instead of on the stale `params`, so neither update is lost.
  const pending = useRef<string | null>(null);
  const current = params.toString();
  useEffect(() => {
    pending.current = null;
  }, [current]);
  const agenda = params.get("cal") === "agenda";

  const state = useMemo<ViewState<V>>(() => {
    const range = RANGES.find((r) => r === rawRange) ?? defaultRange;
    return {
      view: views.find((v) => v === rawView) ?? defaultView,
      date: isDayKey(rawDate) ? rawDate : localDayKey(new Date(), timeZone),
      range,
      calendarMode: agenda ? "agenda" : range,
    };
  },
    // `views` is a caller-supplied constant; its identity changing must not churn state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawView, rawDate, rawRange, agenda, defaultView, defaultRange, timeZone],
  );

  /** Patch any of view/date/range in one navigation. A value equal to its default (view, range) is dropped from the URL. */
  const setState = useCallback(
    (patch: Partial<Omit<ViewState<V>, "calendarMode">> & { agenda?: boolean }) => {
      const next = new URLSearchParams(pending.current ?? params.toString());
      const put = (key: string, value: string | undefined, isDefault: boolean) => {
        if (value === undefined || isDefault) next.delete(key);
        else next.set(key, value);
      };
      if ("view" in patch) put("view", patch.view, patch.view === defaultView);
      if ("date" in patch) put("date", patch.date, false);
      if ("range" in patch) put("range", patch.range, patch.range === defaultRange);
      if ("agenda" in patch) put("cal", "agenda", !patch.agenda);
      const qs = next.toString();
      pending.current = qs;
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router, defaultView, defaultRange],
  );

  return {
    ...state,
    setView: useCallback((view: V) => setState({ view }), [setState]),
    setDate: useCallback((date: string) => setState({ date }), [setState]),
    setRange: useCallback((range: ViewRange) => setState({ range }), [setState]),
    /** Agenda keeps the current range as its span; a grid mode clears Agenda and becomes the range. */
    setCalendarMode: useCallback((mode: CalendarMode) => setState(mode === "agenda" ? { agenda: true } : { agenda: false, range: mode }), [setState]),
    setState,
  };
}
