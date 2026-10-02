"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Announcements, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// One drag-to-reorder behaviour for Settings lists: the grip is the ONLY drag activator (rows keep their normal click
// targets), Space / arrow keys / Space reorders from the keyboard with spoken announcements, motion is a short 150 ms
// shift that stops under prefers-reduced-motion. Callers keep their own up/down buttons for touch.

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function SortableGroup({ items, onReorder, children }: { items: { id: string; label: string }[]; onReorder: (orderedIds: string[]) => void; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const label = (id: string | number) => items.find((i) => i.id === id)?.label ?? "item";
  const pos = (id: string | number) => `position ${items.findIndex((i) => i.id === id) + 1} of ${items.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}, ${pos(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${label(active.id)} is over ${pos(over.id)}.` : `${label(active.id)} is not over a position.`),
    onDragEnd: ({ active, over }) => (over ? `${label(active.id)} dropped at ${pos(over.id)}.` : `${label(active.id)} dropped back where it was.`),
    onDragCancel: ({ active }) => `Moving ${label(active.id)} cancelled; it is back where it was.`,
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from >= 0 && to >= 0) onReorder(arrayMove(ids, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements }}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** A sortable list row: spread `rowProps` on the <li> and render <DragGrip> inside it. */
export function useSortableRow(id: string, disabled: boolean) {
  const reducedMotion = usePrefersReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled, transition: { duration: 150, easing: "ease-out" } });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition: reducedMotion ? undefined : transition, position: "relative", zIndex: isDragging ? 10 : undefined };
  return {
    isDragging,
    rowProps: { ref: setNodeRef, style, "data-dragging": isDragging || undefined } as const,
    gripProps: { ref: setActivatorNodeRef, ...attributes, ...listeners } as const,
  };
}

export function DragGrip({ label, disabled, dragging, testId, gripProps }: { label: string; disabled: boolean; dragging: boolean; testId: string; gripProps: Record<string, unknown> }) {
  return (
    <button
      type="button"
      {...gripProps}
      disabled={disabled}
      aria-label={`Reorder ${label}. Press space to pick up, arrow keys to move, space to drop.`}
      aria-roledescription="sortable item"
      className={`hidden h-8 w-6 touch-none items-center justify-center rounded-control text-ink-2 hover:bg-primary-50 hover:text-ink disabled:opacity-30 sm:inline-flex ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      data-testid={testId}
    >
      <GripVertical size={14} aria-hidden="true" />
    </button>
  );
}
