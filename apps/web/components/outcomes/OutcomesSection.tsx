"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { api } from "@pulseos/api-client";
import { Badge, Button, EmptyState, ErrorState, Skeleton } from "@pulseos/ui";
import type { CrmOutcomeVm } from "@pulseos/types";
import { CheckRow, FormError } from "@/components/settings/FormBits";
import { OutcomeEditorSheet } from "./OutcomeEditorSheet";
import { blankOutcome, outcomeHint, outcomeToForm, type OutcomeForm } from "./outcomeForm";

/**
 * Settings → Workflow Outcomes. The journey stages (Enquiry, Contacted, Booked …) are fixed so reports
 * stay consistent; what a hospital configures is the wording of what happened, and three simple rules.
 */
export function OutcomesSection() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; form: OutcomeForm; id?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outcomes = useQuery({ queryKey: ["crm-outcomes", "all"], queryFn: () => api.crmOutcomes({ includeArchived: true }) });
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["crm-outcomes"] })]);

  const all = outcomes.data ?? [];
  const shown = all.filter((o) => showArchived || !o.archived);
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
  const move = (list: CrmOutcomeVm[], i: number, d: -1 | 1) => {
    const ids = list.map((o) => o.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    return run(() => api.reorderCrmOutcomes(ids), "Couldn't reorder that outcome — try again.");
  };
  const btn = "inline-flex h-11 w-9 items-center justify-center rounded-control text-ink-2 hover:bg-primary-50 hover:text-ink disabled:opacity-30 sm:h-8 sm:w-7";

  return (
    <div className="space-y-4" data-testid="outcomes-section">
      <p className="max-w-2xl text-xs leading-relaxed text-ink-2">
        Outcomes describe what happened on a call or follow-up. Journey stages themselves are fixed so reports stay consistent; each outcome only chooses whether the journey becomes Contacted or Lost.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {archivedCount > 0 && <CheckRow label={`Show archived (${archivedCount})`} checked={showArchived} onChange={setShowArchived} testId="outcomes-show-archived" />}
        <Button variant="primary" onClick={() => setEditing({ mode: "create", form: blankOutcome() })} data-testid="outcomes-add">
          <Plus size={14} aria-hidden="true" /> Add outcome
        </Button>
      </div>
      <FormError message={error} testId="outcomes-error" />
      {outcomes.isLoading && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
      {outcomes.isError && <ErrorState message="Could not load outcomes." />}
      {outcomes.data && shown.length === 0 && <EmptyState message="No outcomes yet." hint="Add the outcomes your team records after a call." />}
      {shown.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white" data-testid="outcome-list">
          {shown.map((o, i) => (
            <li key={o.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 ${o.archived ? "bg-neutral-50 text-ink-2" : ""}`} data-testid={`outcome-row-${o.key}`}>
              <div className="flex shrink-0 items-center">
                <button type="button" className={btn} disabled={o.archived || i === 0} onClick={() => move(shown, i, -1)} aria-label={`Move ${o.label} up`} data-testid={`outcome-move-up-${o.key}`}>
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button type="button" className={btn} disabled={o.archived || i === shown.length - 1} onClick={() => move(shown, i, 1)} aria-label={`Move ${o.label} down`} data-testid={`outcome-move-down-${o.key}`}>
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
              </div>
              <button type="button" className="min-w-0 flex-1 basis-40 text-left" onClick={() => setEditing({ mode: "edit", form: outcomeToForm(o), id: o.id })} aria-label={`Edit ${o.label}`} data-testid={`outcome-edit-${o.key}`}>
                <span className="block truncate text-sm font-medium text-ink">{o.label}</span>
                <span className="block truncate text-[11px] text-ink-2">{outcomeHint(o) || "No extra steps"}</span>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge tone={o.stage === "lost" ? "warning" : "primary"}>{o.stage === "lost" ? "Lost" : "Contacted"}</Badge>
                {o.archived && <Badge tone="warning">Archived</Badge>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ mode: "edit", form: outcomeToForm(o), id: o.id })}>
                  Edit
                </Button>
                {o.archived ? (
                  <Button size="sm" variant="ghost" onClick={() => run(() => api.updateCrmOutcome(o.id, { archived: false }), "Couldn't restore that outcome — try again.")} data-testid={`outcome-restore-${o.key}`}>
                    Restore
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => run(() => api.updateCrmOutcome(o.id, { archived: true }), "Couldn't archive that outcome — try again.")} data-testid={`outcome-archive-${o.key}`}>
                    Archive
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
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
