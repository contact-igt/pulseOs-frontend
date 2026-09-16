"use client";

import { useState } from "react";
import { CalendarCheck, MessageCircle, Stethoscope, ListChecks, Circle, type LucideIcon } from "lucide-react";
import { Card, EmptyState, SectionHeading } from "./primitives";
import { fmtDateTime } from "./format";

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

// A restrained icon + background cue per category — never a heavy card per
// event, just enough to let the eye separate a WhatsApp reply from an
// appointment change from a clinical note while scanning quickly.
const CATEGORY_ICON: Record<TimelineEventVm["category"], LucideIcon> = {
  communication: MessageCircle,
  appointments: CalendarCheck,
  clinical: Stethoscope,
  tasks: ListChecks,
  other: Circle,
};

const CATEGORY_DOT: Record<TimelineEventVm["category"], string> = {
  communication: "bg-accent-100 text-accent-700",
  appointments: "bg-primary-100 text-primary-700",
  clinical: "bg-warning-100 text-warning-700",
  tasks: "bg-neutral-100 text-neutral-600",
  other: "bg-neutral-100 text-neutral-500",
};

const FILTERS: { key: "all" | TimelineEventVm["category"]; label: string }[] = [
  { key: "all", label: "All" },
  { key: "communication", label: "Communication" },
  { key: "appointments", label: "Appointments" },
  { key: "clinical", label: "Clinical-operational" },
  { key: "tasks", label: "Tasks" },
];

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
        <ol className="space-y-4 border-l border-neutral-200 pl-4">
          {visible.map((event) => {
            const Icon = CATEGORY_ICON[event.category];
            return (
              <li key={event.id} className="relative">
                <span className={`absolute -left-[27px] top-0 flex h-5 w-5 items-center justify-center rounded-full ${CATEGORY_DOT[event.category]}`}>
                  <Icon size={12} strokeWidth={2} />
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-slate-900">{event.title}</span>
                  <span className="shrink-0 text-[11px] text-neutral-400">{fmtDateTime(event.occurredAt)}</span>
                </div>
                {event.description && <p className="mt-0.5 text-xs text-neutral-500">{event.description}</p>}
                <span className="mt-0.5 block text-[11px] text-neutral-400">
                  {CATEGORY_LABEL[event.category]}
                  {event.sourceChannel && ` · ${event.sourceChannel}`}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
