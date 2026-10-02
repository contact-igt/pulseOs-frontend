"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Lock, Plus } from "lucide-react";
import { api } from "@pulseos/api-client";
import { Badge, Button, EmptyState, ErrorState, Skeleton } from "@pulseos/ui";
import type { CrmOutcomeVm, JourneyStage } from "@pulseos/types";
import { CheckRow, FormError } from "@/components/settings/FormBits";
import { DragGrip, SortableGroup, useSortableRow } from "@/components/settings/SortableList";
import { OutcomeEditorSheet } from "./OutcomeEditorSheet";
import { blankOutcome, outcomeHint, outcomeToForm, type OutcomeForm } from "./outcomeForm";
import { SYSTEM_STAGES, outcomesForStage } from "./stageModel";

const BTN = "inline-flex h-11 w-9 items-center justify-center rounded-control text-ink-2 hover:bg-primary-50 hover:text-ink disabled:opacity-30 sm:h-8 sm:w-7";

function OutcomeRow({ o, position, isFirst, isLast, locked, onMove, onEdit, onArchive, onRestore }: { o: CrmOutcomeVm; position: number; isFirst: boolean; isLast: boolean; locked: boolean; onMove: (d: -1 | 1) => void; onEdit: () => void; onArchive: () => void; onRestore: () => void }) {
  const { isDragging, rowProps, gripProps } = useSortableRow(o.id, o.archived || locked);
  return (
    <li {...rowProps} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 first:rounded-t-card last:rounded-b-card ${o.archived ? "bg-neutral-50 text-ink-2" : "bg-white"} ${isDragging ? "rounded-card shadow-glass ring-2 ring-primary-400" : ""}`} data-testid={`outcome-row-${o.key}`}>
      <div className="flex shrink-0 items-center">
        <DragGrip label={o.label} disabled={o.archived || locked} dragging={isDragging} testId={`outcome-drag-${o.key}`} gripProps={gripProps} />
        <span className="w-6 text-center text-[11px] tabular-nums text-ink-2" aria-hidden="true">{position}</span>
        <button type="button" className={BTN} disabled={o.archived || locked || isFirst} onClick={() => onMove(-1)} aria-label={`Move ${o.label} up`} data-testid={`outcome-move-up-${o.key}`}>
          <ArrowUp size={14} aria-hidden="true" />
        </button>
        <button type="button" className={BTN} disabled={o.archived || locked || isLast} onClick={() => onMove(1)} aria-label={`Move ${o.label} down`} data-testid={`outcome-move-down-${o.key}`}>
          <ArrowDown size={14} aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="min-w-0 flex-1 basis-40 text-left" onClick={onEdit} aria-label={`Edit ${o.label}`} data-testid={`outcome-edit-${o.key}`}>
        <span className="block truncate text-sm font-medium text-ink">{o.label}</span>
        <span className="block truncate text-[11px] text-ink-2">{outcomeHint(o) || "No extra steps"}</span>
      </button>
      <div className="flex shrink-0 items-center gap-1.5">{o.archived && <Badge tone="warning">Archived</Badge>}</div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        {o.archived ? (
          <Button size="sm" variant="ghost" onClick={onRestore} data-testid={`outcome-restore-${o.key}`}>
            Restore
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onArchive} data-testid={`outcome-archive-${o.key}`}>
            Archive
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Settings → Workflow Outcomes. The journey's STAGES are PulseOS's own — fixed, in order, locked — so reports and the
 * state machines stay consistent. What a hospital configures is the OUTCOMES recorded under the two stages a call or
 * follow-up can move a journey to (Contacted, Lost): add, rename, reorder, archive, and three simple rules.
 */
export function OutcomesSection() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; form: OutcomeForm; id?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, string[]>>({});
  const outcomes = useQuery({ queryKey: ["crm-outcomes", "all"], queryFn: () => api.crmOutcomes({ includeArchived: true }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["crm-outcomes"] });

  const all = outcomes.data ?? [];
  const archivedCount = all.filter((o) => o.archived).length;

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError(null);
    try {
      await action();
      await refresh();
    } catch {
      setError(fallback);
    }
  }

  // One reorder path for drag and arrows: show the order at once, save it, put it back with a message on failure.
  async function reorder(stage: JourneyStage, orderedIds: string[]) {
    setError(null);
    setPending((p) => ({ ...p, [stage]: orderedIds }));
    try {
      await api.reorderCrmOutcomes(orderedIds);
      await refresh();
    } catch {
      setError("Couldn't save the new order — it has been put back. Try again.");
    } finally {
      setPending(({ [stage]: _done, ...rest }) => rest);
    }
  }

  const listFor = (stage: JourneyStage) => {
    const list = outcomesForStage(all, stage, showArchived);
    const order = pending[stage];
    return order ? [...list].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : list;
  };
  const add = (stage: "contacted" | "lost") => setEditing({ mode: "create", form: { ...blankOutcome(), stage } });

  return (
    <div className="space-y-4" data-testid="outcomes-section">
      <p className="max-w-2xl text-xs leading-relaxed text-ink-2">
        Every journey moves through the same fixed stages, so reports mean the same thing everywhere. Your team chooses the outcomes recorded under <strong className="font-semibold text-ink">Contacted</strong> and <strong className="font-semibold text-ink">Lost</strong> — what happened on a call or follow-up. All other stages update on their own.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {archivedCount > 0 && <CheckRow label={`Show archived (${archivedCount})`} checked={showArchived} onChange={setShowArchived} testId="outcomes-show-archived" />}
        <Button variant="primary" onClick={() => add("contacted")} data-testid="outcomes-add">
          <Plus size={14} aria-hidden="true" /> Add outcome
        </Button>
      </div>
      <FormError message={error} testId="outcomes-error" />
      {outcomes.isLoading && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
      {outcomes.isError && <ErrorState message="Could not load outcomes." />}

      {outcomes.data && (
        <ol className="space-y-3" aria-label="Journey stages" data-testid="outcome-list">
          {SYSTEM_STAGES.map((stage) => {
            const list = stage.outcomes ? listFor(stage.key) : [];
            const busy = !!pending[stage.key];
            return (
              <li key={stage.key} data-testid={`stage-${stage.key}`}>
                <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card border px-3 py-2 ${stage.outcomes ? "border-line bg-primary-50/60" : "border-line/70 bg-neutral-50/70"}`}>
                  <Lock size={13} className="shrink-0 text-ink-2" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-ink">{stage.label}</h3>
                  <span data-testid={`stage-locked-${stage.key}`}>
                    <Badge tone="neutral">System stage · fixed</Badge>
                  </span>
                  <span className="min-w-0 flex-1 basis-48 text-xs text-ink-2">
                    {stage.how}
                    {!stage.outcomes && " Set automatically."}
                  </span>
                  {stage.outcomes && (
                    <Button size="sm" variant="secondary" onClick={() => add(stage.key as "contacted" | "lost")} data-testid={`outcomes-add-${stage.key}`}>
                      <Plus size={13} aria-hidden="true" /> Add outcome
                    </Button>
                  )}
                </div>
                {stage.outcomes && (
                  <div className="ml-1 mt-1.5 border-l-2 border-primary-100 pl-2.5 sm:ml-5 sm:pl-4">
                    {list.length === 0 ? (
                      <EmptyState message={`No outcomes under ${stage.label} yet.`} hint="Add the outcomes your team records." />
                    ) : (
                      <SortableGroup items={list.map((o) => ({ id: o.id, label: o.label }))} onReorder={(ids) => void reorder(stage.key, ids)}>
                        <ul className="divide-y divide-line rounded-card border border-line bg-white" aria-label={`${stage.label} outcomes`} aria-busy={busy} data-testid={`outcome-group-${stage.key}`}>
                          {list.map((o, i) => (
                            <OutcomeRow
                              key={o.id}
                              o={o}
                              position={i + 1}
                              isFirst={i === 0}
                              isLast={i === list.length - 1}
                              locked={busy}
                              onMove={(d) => {
                                const ids = list.map((x) => x.id);
                                const j = i + d;
                                if (j < 0 || j >= ids.length) return;
                                [ids[i], ids[j]] = [ids[j]!, ids[i]!];
                                void reorder(stage.key, ids);
                              }}
                              onEdit={() => setEditing({ mode: "edit", form: outcomeToForm(o), id: o.id })}
                              onArchive={() => run(() => api.updateCrmOutcome(o.id, { archived: true }), "Couldn't archive that outcome — try again.")}
                              onRestore={() => run(() => api.updateCrmOutcome(o.id, { archived: false }), "Couldn't restore that outcome — try again.")}
                            />
                          ))}
                        </ul>
                      </SortableGroup>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {editing && (
        <OutcomeEditorSheet
          mode={editing.mode}
          initial={editing.form}
          outcomeId={editing.id}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
