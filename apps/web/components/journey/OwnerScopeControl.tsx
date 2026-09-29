"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterBar, FilterSelect, Tabs } from "@pulseos/ui";
import type { LookupOption } from "@pulseos/types";

/**
 * Owner scope stored in the URL (`?owner=`) so it is shareable and other pages
 * (e.g. the Command Centre team panel) can deep-link to one owner's work.
 * "" = everyone, "mine" | "unassigned" | <userId>.
 */
export function useOwnerScope(): [string, (next: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner") ?? "";
  const setOwner = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("owner", next);
      else params.delete("owner");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );
  return [owner, setOwner];
}

/** All / Mine / Unassigned segmented control plus a specific-owner select. */
export function OwnerScopeControl({ value, onChange, owners }: { value: string; onChange: (next: string) => void; owners: LookupOption[] }) {
  const segment = value === "" || value === "mine" || value === "unassigned" ? (value === "" ? "all" : value) : "owner";
  return (
    <FilterBar data-testid="owner-scope">
      <Tabs
        ariaLabel="Owner scope"
        value={segment}
        onChange={(k) => onChange(k === "all" ? "" : k)}
        items={[
          { key: "all", label: "All owners", testId: "owner-scope-all" },
          { key: "mine", label: "Mine", testId: "owner-scope-mine" },
          { key: "unassigned", label: "Unassigned", testId: "owner-scope-unassigned" },
        ]}
      />
      {owners.length > 0 && (
        <FilterSelect aria-label="Filter by owner" value={owners.some((o) => o.id === value) ? value : ""} onChange={(e) => onChange(e.target.value)} data-testid="owner-scope-select">
          <option value="">Any owner</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </FilterSelect>
      )}
    </FilterBar>
  );
}
