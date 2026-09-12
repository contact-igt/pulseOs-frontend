"use client";

import { useState } from "react";
import { Card, EmptyState, SectionHeading } from "./primitives";

export interface TimelineEventVm {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  sourceChannel: string | null;
  occurredAt: string;
  category: "communication" | "appointments" | "clinical" | "tasks" | "other";
}

const CATEGORY_LABEL: Record<TimelineEventVm["category"], string> = {
  communication: "Communication",
  appointments: "Appointments",
  clinical: "Clinical / Treatment",
  tasks: "Tasks",
  other: "Other",
};

const FILTERS: { key: "all" | TimelineEventVm["category"]; label: string }[] = [
  { key: "all", label: "All" },
  { key: "communication", label: "Communication" },
  { key: "appointments", label: "Appointments" },
  { key: "clinical", label: "Clinical-operational" },
  { key: "tasks", label: "Tasks" },
];

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function Timeline({ events }: { events: TimelineEventVm[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const visible = filter === "all" ? events : events.filter((e) => e.category === filter);

  return (
    <Card className="p-4">
      <SectionHeading title="Timeline" subtitle={`${visible.length} events`} />
      <div className="mb-3 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded px-2 py-1 text-xs ${filter === f.key ? "bg-primary-100 text-primary-700" : "text-neutral-500 hover:bg-neutral-100"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState message="No timeline events yet" />
      ) : (
        <ol className="space-y-3 border-l border-neutral-200 pl-4">
          {visible.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary-500" />
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-slate-900">{event.title}</span>
                <span className="shrink-0 text-[11px] text-neutral-400">{fmtDateTime(event.occurredAt)}</span>
              </div>
              {event.description && <p className="mt-0.5 text-xs text-neutral-500">{event.description}</p>}
              <span className="mt-0.5 inline-block text-[11px] text-neutral-400">{CATEGORY_LABEL[event.category]}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
