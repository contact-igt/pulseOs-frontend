"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isDayKey, localDayKey } from "@pulseos/ui";

export type ViewRange = "day" | "week" | "month";
const RANGES: readonly ViewRange[] = ["day", "week", "month"];

export interface ViewState<V extends string> {
  view: V;
  /** Selected day, `yyyy-mm-dd` in `timeZone` (defaults to today there). */
  date: string;
  range: ViewRange;
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
 * URL-backed view state: ONLY `view`, `date` and `range`. Refresh, back/forward
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

  const state = useMemo<ViewState<V>>(
    () => ({
      view: views.find((v) => v === rawView) ?? defaultView,
      date: isDayKey(rawDate) ? rawDate : localDayKey(new Date(), timeZone),
      range: RANGES.find((r) => r === rawRange) ?? defaultRange,
    }),
    // `views` is a caller-supplied constant; its identity changing must not churn state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawView, rawDate, rawRange, defaultView, defaultRange, timeZone],
  );

  /** Patch any of view/date/range in one navigation. A value equal to its default (view, range) is dropped from the URL. */
  const setState = useCallback(
    (patch: Partial<ViewState<V>>) => {
      const next = new URLSearchParams(params.toString());
      const put = (key: string, value: string | undefined, isDefault: boolean) => {
        if (value === undefined || isDefault) next.delete(key);
        else next.set(key, value);
      };
      if ("view" in patch) put("view", patch.view, patch.view === defaultView);
      if ("date" in patch) put("date", patch.date, false);
      if ("range" in patch) put("range", patch.range, patch.range === defaultRange);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router, defaultView, defaultRange],
  );

  return {
    ...state,
    setView: useCallback((view: V) => setState({ view }), [setState]),
    setDate: useCallback((date: string) => setState({ date }), [setState]),
    setRange: useCallback((range: ViewRange) => setState({ range }), [setState]),
    setState,
  };
}
