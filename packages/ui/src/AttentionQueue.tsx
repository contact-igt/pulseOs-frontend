import type { AttentionItem } from "@pulseos/types";
import { Card, EmptyState, SectionHeading } from "./primitives";
import { ATTENTION_REASON_LABEL as REASON_LABEL } from "./status";
import { urgencyLabel } from "./format";

export function AttentionQueue({ items, onItemClick }: { items: AttentionItem[]; onItemClick?: (item: AttentionItem) => void }) {
  return (
    <Card className="p-4">
      <SectionHeading title="Attention / SLA" subtitle={`${items.length} need action`} />
      {items.length === 0 ? (
        <EmptyState message="Nothing needs attention right now" />
      ) : (
        <ul className="max-h-80 divide-y divide-neutral-100 overflow-y-auto">
          {items.map((item) => {
            const urgency = urgencyLabel(item.dueAt);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onItemClick?.(item)}
                  className="flex w-full items-start gap-2.5 py-2 text-left hover:bg-neutral-50"
                  data-testid={`attention-row-${item.id}`}
                >
                  {/* A severity dot, not a full-width colored pill — the row's own text carries the meaning. */}
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${urgency.overdue ? "bg-danger-500" : "bg-warning-500"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">{item.patientName}</span>
                      <span className={`shrink-0 text-[11px] tabular-nums font-medium ${urgency.overdue ? "text-danger-500" : "text-neutral-400"}`}>
                        {urgency.text}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {item.journeyType} · {item.ownerName ?? "Unassigned"}
                    </span>
                    <span className="block truncate text-xs text-neutral-600">{REASON_LABEL[item.reason]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
