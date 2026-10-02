"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GripVertical, Plus } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Announcements, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@pulseos/api-client";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Skeleton } from "@pulseos/ui";
import { ALL_SERVICES_KEY, CUSTOM_FIELD_TYPES, FIELD_GROUPS, FIELD_ORIGIN_LABEL, FIELD_VISIBILITY, type CrmFieldVm, type SpecialtyTemplateVm } from "@pulseos/types";
import { useUrlFilters } from "@/lib/useUrlFilters";
import { CheckRow, FormError, SelectInput } from "./FormBits";
import { FieldEditorSheet } from "./FieldEditorSheet";
import { blankField, fieldToForm, placementSummary, type FieldForm } from "./crmFieldForm";

const TYPE_LABEL = new Map(CUSTOM_FIELD_TYPES.map((t) => [t.key, t.label]));
const VISIBILITY_LABEL = new Map(FIELD_VISIBILITY.map((v) => [v.key, v.label]));

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

function FieldRow({ field, position, isFirst, isLast, canMove, reducedMotion, onMove, onEdit, onArchive, onRestore }: { field: CrmFieldVm; position: number; isFirst: boolean; isLast: boolean; canMove: boolean; reducedMotion: boolean; onMove: (d: -1 | 1) => void; onEdit: () => void; onArchive: () => void; onRestore: () => void }) {
  const btn = "inline-flex h-11 w-11 items-center justify-center rounded-control text-ink-2 hover:bg-primary-50 hover:text-ink disabled:opacity-30 sm:h-8 sm:w-7";
  // Only the grip starts a drag — the rest of the row keeps its normal click targets (Edit, Archive).
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: field.id, disabled: !canMove, transition: { duration: 150, easing: "ease-out" } });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition: reducedMotion ? undefined : transition, position: "relative", zIndex: isDragging ? 10 : undefined };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 first:rounded-t-card last:rounded-b-card ${field.archived ? "bg-neutral-50 text-ink-2" : "bg-white"} ${isDragging ? "rounded-card shadow-glass ring-2 ring-primary-400" : ""}`}
      data-testid={`field-row-${field.key}`}
      data-dragging={isDragging || undefined}
    >
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={!canMove}
          aria-label={`Reorder ${field.label}, position ${position}. Press space to pick up, arrow keys to move, space to drop.`}
          aria-roledescription="sortable field"
          className={`hidden h-8 w-6 touch-none items-center justify-center rounded-control text-ink-2 hover:bg-primary-50 hover:text-ink disabled:opacity-30 sm:inline-flex ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          data-testid={`field-drag-${field.key}`}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
        <span className="w-6 text-center text-[11px] tabular-nums text-ink-2" aria-hidden="true" data-testid={`field-position-${field.key}`}>
          {position}
        </span>
        <button type="button" onClick={() => onMove(-1)} disabled={!canMove || isFirst} className={btn} aria-label={`Move ${field.label} up`} data-testid={`field-move-up-${field.key}`}>
          <ArrowUp size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={!canMove || isLast} className={btn} aria-label={`Move ${field.label} down`} data-testid={`field-move-down-${field.key}`}>
          <ArrowDown size={14} aria-hidden="true" />
        </button>
      </div>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 basis-40 text-left" aria-label={`Edit ${field.label}`} data-testid={`field-edit-${field.key}`}>
        <span className="block truncate text-sm font-medium text-ink">{field.label}</span>
        <span className="block truncate text-[11px] text-ink-2">
          {TYPE_LABEL.get(field.fieldType) ?? field.fieldType} · {placementSummary(field.placements)}
        </span>
      </button>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {field.origin !== "CUSTOM" && <Badge tone={field.origin === "SYSTEM" ? "primary" : "neutral"} data-testid={`field-origin-${field.key}`}>{FIELD_ORIGIN_LABEL[field.origin]}</Badge>}
        {field.required && <Badge tone="primary">Required</Badge>}
        {field.visibleTo !== "everyone" && <Badge>{VISIBILITY_LABEL.get(field.visibleTo)}</Badge>}
        {field.archived && <Badge tone="warning">Archived</Badge>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        {field.origin === "SYSTEM" ? (
          <span className="px-2 text-[11px] text-ink-2" data-testid={`field-locked-${field.key}`}>Always on</span>
        ) : field.archived ? (
          <Button size="sm" variant="ghost" onClick={onRestore} data-testid={`field-restore-${field.key}`}>
            Restore
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onArchive} data-testid={`field-archive-${field.key}`}>
            Archive
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Settings → CRM Fields. One field system: each field is defined once and placed wherever it is needed
 * (Add Lead, Journey Detail, Patient 360, follow-up outcome, appointment, treatment). Archiving never
 * deletes what was recorded.
 */
export function CrmFieldsSection({ services }: { services: SpecialtyTemplateVm[] }) {
  const queryClient = useQueryClient();
  const urlFilters = useUrlFilters();
  const requested = urlFilters.get("service");
  const scope = requested === ALL_SERVICES_KEY || services.some((s) => s.key === requested) ? requested : (services[0]?.key ?? ALL_SERVICES_KEY);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; form: FieldForm; id?: string } | null>(null);
  const [confirming, setConfirming] = useState<CrmFieldVm | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Optimistic order per group while a reorder is in flight (cleared on success, rolled back on failure).
  const [pending, setPending] = useState<Record<string, string[]>>({});
  const reducedMotion = usePrefersReducedMotion();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const fields = useQuery({ queryKey: ["crm-fields"], queryFn: () => api.crmFields({ includeArchived: true }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["crm-fields"] });

  const inScope = useMemo(() => (fields.data ?? []).filter((f) => f.specialtyKey === scope), [fields.data, scope]);
  const shown = inScope.filter((f) => showArchived || !f.archived);
  const sharedCount = scope === ALL_SERVICES_KEY ? 0 : (fields.data ?? []).filter((f) => f.specialtyKey === ALL_SERVICES_KEY && !f.archived).length;
  const archivedCount = inScope.filter((f) => f.archived).length;

  const groups = FIELD_GROUPS.map((g) => {
    const list = shown.filter((f) => f.groupKey === g.key);
    const order = pending[g.key];
    return { ...g, fields: order ? [...list].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : list };
  }).filter((g) => g.fields.length > 0);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError(null);
    try {
      await action();
      await refresh();
    } catch {
      setError(fallback);
    }
  }

  // One reorder path for drag-and-drop and the arrow buttons: show the new order at once, persist it, roll back on failure.
  async function reorder(groupKey: CrmFieldVm["groupKey"], orderedIds: string[]) {
    setError(null);
    setPending((p) => ({ ...p, [groupKey]: orderedIds }));
    try {
      await api.reorderCrmFields({ specialtyKey: scope, groupKey, orderedIds });
      await refresh();
    } catch {
      setError("Couldn't save the new order — it has been put back. Try again.");
    } finally {
      setPending(({ [groupKey]: _done, ...rest }) => rest);
    }
  }

  const move = (group: { key: CrmFieldVm["groupKey"]; fields: CrmFieldVm[] }, index: number, d: -1 | 1) => {
    const j = index + d;
    if (j < 0 || j >= group.fields.length) return;
    return reorder(group.key, arrayMove(group.fields.map((f) => f.id), index, j));
  };

  const onDragEnd = (group: { key: CrmFieldVm["groupKey"]; fields: CrmFieldVm[] }) => (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = group.fields.map((f) => f.id);
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from >= 0 && to >= 0) void reorder(group.key, arrayMove(ids, from, to));
  };

  const labelOf = (id: string | number) => inScope.find((f) => f.id === id)?.label ?? "field";
  const announcements = (group: { fields: CrmFieldVm[] }): Announcements => {
    const pos = (id: string | number) => `position ${group.fields.findIndex((f) => f.id === id) + 1} of ${group.fields.length}`;
    return {
      onDragStart: ({ active }) => `Picked up ${labelOf(active.id)}, ${pos(active.id)}.`,
      onDragOver: ({ active, over }) => (over ? `${labelOf(active.id)} is over ${pos(over.id)}.` : `${labelOf(active.id)} is not over a position.`),
      onDragEnd: ({ active, over }) => (over ? `${labelOf(active.id)} dropped at ${pos(over.id)}.` : `${labelOf(active.id)} dropped back where it was.`),
      onDragCancel: ({ active }) => `Moving ${labelOf(active.id)} cancelled; it is back where it was.`,
    };
  };

  return (
    <div className="space-y-4" data-testid="crm-fields-section">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 sm:max-w-xs">
          <SelectInput label="Fields for" value={scope} onChange={(e) => urlFilters.set({ service: e.target.value })} data-testid="crm-fields-scope">
            <option value={ALL_SERVICES_KEY}>All services (shared)</option>
            {services.map((s) => (
              <option key={s.key} value={s.key}>
                {s.displayName}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {archivedCount > 0 && <CheckRow label={`Show archived (${archivedCount})`} checked={showArchived} onChange={setShowArchived} testId="crm-fields-show-archived" />}
          <Button variant="primary" onClick={() => setEditing({ mode: "create", form: blankField(scope) })} data-testid="crm-fields-add">
            <Plus size={14} aria-hidden="true" /> Add field
          </Button>
        </div>
      </div>

      {sharedCount > 0 && (
        <p className="text-xs text-ink-2" data-testid="crm-fields-shared-note">
          {sharedCount} shared field{sharedCount === 1 ? "" : "s"} also appear for this service.{" "}
          <button type="button" className="font-medium text-primary-700 hover:underline" onClick={() => urlFilters.set({ service: ALL_SERVICES_KEY })}>
            View shared fields
          </button>
        </p>
      )}

      <FormError message={error} testId="crm-fields-error" />

      {fields.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}
      {fields.isError && <ErrorState message="Could not load CRM fields." />}
      {fields.data && groups.length === 0 && (
        <EmptyState message="No fields here yet." hint="Add a field to capture more about each patient's enquiry for this service." action={<Button variant="primary" onClick={() => setEditing({ mode: "create", form: blankField(scope) })}>Add field</Button>} />
      )}

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`group-${g.key}`} data-testid={`field-group-${g.key}`}>
          <h3 id={`group-${g.key}`} className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
            {g.label}
            <span className="ml-2 hidden font-normal normal-case tracking-normal sm:inline">· shown in this order — drag the handle or use the arrows</span>
          </h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(g)} accessibility={{ announcements: announcements(g) }}>
            <SortableContext items={g.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-line rounded-card border border-line bg-white" aria-busy={!!pending[g.key]}>
            {g.fields.map((f, i) => (
              <FieldRow
                key={f.id}
                field={f}
                position={i + 1}
                isFirst={i === 0}
                isLast={i === g.fields.length - 1}
                canMove={!f.archived && !pending[g.key]}
                reducedMotion={reducedMotion}
                onMove={(d) => move(g, i, d)}
                onEdit={() => setEditing({ mode: "edit", form: fieldToForm(f), id: f.id })}
                onArchive={() => setConfirming(f)}
                onRestore={() => run(() => api.updateCrmField(f.id, { archived: false }), "Couldn't restore that field — try again.")}
              />
            ))}
              </ul>
            </SortableContext>
          </DndContext>
        </section>
      ))}

      {editing && (
        <FieldEditorSheet
          mode={editing.mode}
          initial={editing.form}
          fieldId={editing.id}
          services={services}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirming}
        title={confirming ? `Archive "${confirming.label}"?` : ""}
        description="This removes it from new forms and from this list going forward. Existing patients who already have a value saved for it keep that value on their record — archiving doesn't delete historical data, only stops collecting it for new journeys. You can restore it any time."
        confirmLabel="Archive field"
        onConfirm={() => {
          const f = confirming;
          setConfirming(null);
          if (f) void run(() => api.updateCrmField(f.id, { archived: true }), "Couldn't archive that field — try again.");
        }}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
