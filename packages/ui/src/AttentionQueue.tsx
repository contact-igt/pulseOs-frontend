import type { AttentionItem } from "@pulseos/types";
import { Badge, Card, EmptyState, SectionHeading } from "./primitives";

const REASON_LABEL: Record<AttentionItem["reason"], string> = {
  overdue_callback: "Overdue callback",
  missed_follow_up: "Missed follow-up",
  no_show: "No-show",
  high_intent_uncontacted: "High-intent, uncontacted",
  treatment_decision_pending: "Treatment decision pending",
};

export function AttentionQueue({ items, onItemClick }: { items: AttentionItem[]; onItemClick?: (item: AttentionItem) => void }) {
  return (
    <Card className="p-4">
      <SectionHeading title="Attention / SLA" subtitle={`${items.length} need action`} />
      {items.length === 0 ? (
        <EmptyState message="Nothing needs attention right now" />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((item) => {
            const overdue = new Date(item.dueAt).getTime() < Date.now();
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onItemClick?.(item)}
                  className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-neutral-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-900">{item.patientName}</span>
                    <span className="block text-xs text-neutral-500">{item.journeyType} · {item.ownerName ?? "Unassigned"}</span>
                  </span>
                  <Badge tone={overdue ? "danger" : "warning"}>{REASON_LABEL[item.reason]}</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
