"use client";

import type { LeadsTodaySummary } from "@pulseos/types";

const CELLS: { key: keyof LeadsTodaySummary; label: string; testId: string; attention?: boolean }[] = [
  { key: "appointmentsToday", label: "Appointments today", testId: "today-appointments" },
  { key: "followUpsDue", label: "Follow-ups due", testId: "today-follow-ups" },
  { key: "overdue", label: "Overdue", testId: "today-overdue", attention: true },
  { key: "newToday", label: "New leads today", testId: "today-new" },
];

/**
 * A compact "today" strip above the list. Every value is a button that opens the matching filter, and every value is
 * the same number the opened list shows (the server counts both with one predicate).
 */
export function LeadsTodayStrip({ summary, onOpen, activeKey }: { summary: LeadsTodaySummary; onOpen: (key: keyof LeadsTodaySummary) => void; activeKey: keyof LeadsTodaySummary | null }) {
  return (
    <ul className="glass flex flex-wrap divide-x divide-line rounded-panel" aria-label="Today at a glance" data-testid="leads-today-strip">
      {CELLS.map((c) => {
        const n = summary[c.key];
        const active = activeKey === c.key;
        return (
          <li key={c.key} className="min-w-[8.5rem] flex-1">
            <button
              type="button"
              onClick={() => onOpen(c.key)}
              aria-pressed={active}
              className={`flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left transition hover:bg-white/70 max-md:min-h-11 ${active ? "bg-white/80" : ""}`}
              data-testid={c.testId}
            >
              <span className="text-[11px] font-medium text-ink-2">{c.label}</span>
              <span className={`text-base font-semibold tabular-nums ${c.attention && n > 0 ? "text-danger-700" : "text-ink"}`} data-testid={`${c.testId}-count`}>
                {n}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
