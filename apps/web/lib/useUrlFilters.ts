"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
