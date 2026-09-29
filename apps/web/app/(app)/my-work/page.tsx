"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import Link from "next/link";
import { Badge, Button, EmptyState, ErrorState, Panel, Skeleton, Tabs, Toolbar, TASK_REASON_LABEL, TASK_REASON_TONE, fmtDateTime as fmtDate, urgencyLabel } from "@pulseos/ui";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import { withFrom } from "@/components/shell/BackLink";
import { hasPermission } from "@pulseos/types";
import type { TaskReason, TaskRow, TaskType, TaskView } from "@pulseos/types";

const TABS: { key: TaskView | "mine"; label: string }[] = [
  { key: "mine", label: "My Work" },
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "unassigned", label: "Unassigned" },
  { key: "completed", label: "Completed" },
];

// Secondary filter row: WHY a task exists, layered on top of the date tabs
// above (which filter WHEN it's due) — the two AND together. "Follow-ups"
// folds three reasons together since they're all "needs a call" variants;
// `reasons: []` means "no reason filter", i.e. the default "All" pill.
// Never label the new_lead group "New Leads" in user-facing copy — CLAUDE.md
// reserves "Lead" for technical/admin contexts; "enquiry" is the north-star
// term for a brand-new, not-yet-contacted patient touchpoint.
const REASON_GROUPS: { key: string; label: string; reasons: TaskReason[] }[] = [
  { key: "all", label: "All", reasons: [] },
  { key: "new_lead", label: "New Enquiries", reasons: ["new_lead"] },
  { key: "follow_up", label: "Follow-ups", reasons: ["overdue_callback", "treatment_decision_pending", "high_intent_uncontacted"] },
  { key: "missed_follow_up", label: "Missed Calls", reasons: ["missed_follow_up"] },
  { key: "no_show", label: "No-Shows", reasons: ["no_show"] },
];

const TYPE_LABEL: Record<TaskType, string> = {
  CALLBACK: "Callback",
  FOLLOW_UP: "Follow-up",
  APPOINTMENT_CONFIRMATION: "Appointment confirmation",
  NO_SHOW_RECOVERY: "No-show recovery",
  TREATMENT_DECISION: "Treatment decision",
  POST_CARE: "Post-care",
  RECALL: "Recall",
  OTHER: "Other",
};

const SOURCE_LABEL: Record<string, string> = {
  meta: "Meta", google: "Google", website: "Website", whatsapp: "WhatsApp", phone: "Phone", walk_in: "Walk-in", referral: "Referral", organic: "Organic", other: "Other",
};

// One grid shared by the column-header row and every task row (xl and up) — the
// actions column is a fixed width so columns line up across rows;
// below xl each row reflows into a two-line card instead of a squeezed table.
const ROW_GRID = "xl:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1fr)_15rem]";


function isOverdue(task: TaskRow) {
  return task.status === "pending" && new Date(task.dueAt).getTime() < Date.now();
}

export default function MyWorkPage() {
  const queryClient = useQueryClient();
  const quickCreate = useQuickCreate();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("mine");
  const [reasonKey, setReasonKey] = useState<(typeof REASON_GROUPS)[number]["key"]>("all");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  const currentUserId = session.data?.user.id;
  // MANAGE_TASKS gates create/complete/reschedule/note server-side (Doctor
  // has only the weaker VIEW_TASKS) — mirrored here only to avoid showing
  // dead controls, never as the actual authorization boundary.
  const canManageTasks = !!session.data && hasPermission(session.data.user.role, "MANAGE_TASKS");
  // "Unassigned" is a team-attention queue (tenant-wide, owner-less system
  // tasks), not a personal view — gate it out of the visible tab list for a
  // VIEW_TASKS-only role (e.g. Doctor). The API independently enforces this
  // too (a non-MANAGE_TASKS caller's assignedTo is forced server-side, which
  // always yields an empty result for this view), so this is UI polish only,
  // never the authorization boundary.
  const visibleTabs = TABS.filter((t) => t.key !== "unassigned" || canManageTasks);
  // If session permissions load in without MANAGE_TASKS while "unassigned"
  // is still selected (e.g. stale tab state), fall back to "mine" for the
  // query itself — belt-and-suspenders alongside the server-side gate, which
  // is the real authorization boundary either way.
  const effectiveTab = tab === "unassigned" && !canManageTasks ? "mine" : tab;

  const tasks = useQuery({
    queryKey: ["tasks", effectiveTab, currentUserId],
    // "Unassigned" is tenant-wide by definition — never force it down to the
    // caller's own assignments the way every other tab does.
    queryFn: () =>
      api.tasks(
        effectiveTab === "mine"
          ? { assignedTo: currentUserId }
          : effectiveTab === "unassigned"
            ? { view: "unassigned" }
            : { view: effectiveTab, assignedTo: currentUserId },
      ),
    enabled: !!currentUserId,
  });

  const counts = useQuery({
    queryKey: ["tasks", "counts", currentUserId],
    queryFn: api.taskCounts,
    enabled: !!currentUserId,
  });

  // Reason grouping is derived client-side from the already-fetched date-tab
  // list rather than a second round trip per pill — "My Work" queues are a
  // single telecaller's own tasks (small), and this keeps switching pills
  // instant with no extra loading state.
  const activeReasons = REASON_GROUPS.find((g) => g.key === reasonKey)?.reasons ?? [];
  const visibleTasks = tasks.data && activeReasons.length > 0 ? tasks.data.filter((t) => activeReasons.includes(t.reason)) : tasks.data;
  const reasonCounts: Record<string, number> = { all: tasks.data?.length ?? 0 };
  for (const group of REASON_GROUPS) {
    if (group.reasons.length === 0) continue;
    reasonCounts[group.key] = tasks.data?.filter((t) => group.reasons.includes(t.reason)).length ?? 0;
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    // A completed/rescheduled task changes Command Centre's Attention/SLA
    // queue — keep it in sync, not just this list.
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function complete(id: string) {
    await api.completeTask(id);
    invalidate();
  }

  async function reschedule(id: string, days: number) {
    const dueAt = new Date(Date.now() + days * 86400000).toISOString();
    await api.rescheduleTask(id, dueAt);
    invalidate();
  }

  async function assignToMe(id: string) {
    if (!currentUserId) return;
    await api.reassignTask(id, currentUserId);
    invalidate();
  }

  async function saveNote(id: string) {
    const notes = noteDraft[id];
    if (notes === undefined) return;
    await api.addTaskNote(id, notes);
    setNoteDraft((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    invalidate();
  }

  // Tabs only takes a plain-text `count`, which has no test id; the label is
  // rendered as-is inside the tab button, so the count is passed as part of a
  // node to keep the long-standing `my-work-tab-count-*` test ids.
  const tabItems = visibleTabs.map((t) => ({
    key: t.key,
    label: (
      <>
        {t.label}
        {counts.data && (
          <span className="tabular-nums text-neutral-500" data-testid={`my-work-tab-count-${t.key}`}>
            {counts.data[t.key]}
          </span>
        )}
      </>
    ) as unknown as string,
    testId: `my-work-tab-${t.key}`,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-3" data-testid="my-work-page">
      <Toolbar
        actions={
          canManageTasks && (
            <Button variant="primary" onClick={() => quickCreate.openAddTask()} data-testid="add-task-button">
              + Add Task
            </Button>
          )
        }
      >
        <Tabs items={tabItems} value={effectiveTab} onChange={(k) => setTab(k as typeof tab)} ariaLabel="Work queue" />
      </Toolbar>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by reason">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Reason</span>
        {REASON_GROUPS.map((g) => {
          const active = reasonKey === g.key;
          return (
            <button
              key={g.key}
              type="button"
              aria-pressed={active}
              onClick={() => setReasonKey(g.key)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium transition ${active ? "border-primary-300 bg-primary-50 text-primary-800" : "border-line bg-surface text-ink-2 hover:border-primary-200 hover:text-ink"}`}
              data-testid={`my-work-reason-${g.key}`}
            >
              {g.label}
              {tasks.data && (
                <span className="tabular-nums text-neutral-500" data-testid={`my-work-reason-count-${g.key}`}>
                  {reasonCounts[g.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Panel padded={false}>
        {(tasks.isLoading || session.isLoading) && <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
        {tasks.isError && <div className="p-4"><ErrorState message="Could not load tasks." /></div>}
        {visibleTasks && visibleTasks.length === 0 && (
          <div className="p-6">
            <EmptyState
              message="You're all caught up."
              hint="Nothing in this queue needs a Next Action right now."
              action={
                canManageTasks ? (
                  <button type="button" onClick={() => quickCreate.openAddTask()} className="text-xs font-medium text-primary-700 hover:underline">
                    + Add Task
                  </button>
                ) : undefined
              }
            />
          </div>
        )}
        {visibleTasks && visibleTasks.length > 0 && (
          <div>
            <div className={`hidden gap-x-4 border-b border-line bg-surface-muted px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-2 xl:grid ${ROW_GRID}`} aria-hidden="true">
              <span>Patient / Journey</span>
              <span>Reason / Next Action</span>
              <span>Due</span>
              <span>Source</span>
              <span>Owner</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-line" data-testid="my-work-task-list">
              {visibleTasks.map((task) => {
                const overdue = isOverdue(task);
                const urgency = task.status === "pending" ? urgencyLabel(task.dueAt) : null;
                const canAct = canManageTasks && task.status !== "completed";
                return (
                  <li
                    key={task.id}
                    className={`grid gap-x-4 gap-y-2 px-4 py-3 xl:items-start ${ROW_GRID} ${overdue ? "border-l-2 border-l-danger-500 pl-[14px]" : ""}`}
                    data-testid={`task-row-${task.id}`}
                  >
                    <div className="min-w-0">
                      <Link href={withFrom(`/patients/${task.patientId}`, "my-work")} className="block truncate text-sm font-semibold text-ink hover:text-primary-700 hover:underline" data-testid={`task-patient-${task.id}`}>
                        {task.patientName}
                      </Link>
                      {task.journeyId ? (
                        <Link href={withFrom(`/journeys/${task.journeyId}`, "my-work")} className="block truncate text-xs text-primary-700 hover:underline" data-testid={`task-journey-${task.id}`}>
                          {task.journeyType ?? "Journey"}
                        </Link>
                      ) : (
                        <span className="block truncate text-xs text-ink-2">No journey</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={TASK_REASON_TONE[task.reason]}>{TASK_REASON_LABEL[task.reason]}</Badge>
                        {task.priority === "high" && <Badge tone="warning">High priority</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-ink">
                        <span className="text-ink-2">Next Action · </span>
                        {TYPE_LABEL[task.type]}
                      </p>
                      {task.notes && <p className="mt-0.5 text-xs text-ink-2">{task.notes}</p>}
                    </div>

                    {/* Below xl: due / source / owner share one wrapping line; at xl they become grid columns. */}
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 xl:contents">
                      <div className="min-w-0 text-xs tabular-nums">
                        <span className={`block ${overdue ? "font-semibold text-danger-700" : "text-ink"}`}>{urgency ? urgency.text : `Due ${fmtDate(task.dueAt)}`}</span>
                        <span className="block text-ink-2">{fmtDate(task.dueAt)}</span>
                      </div>

                      <div className="min-w-0 text-xs text-ink">
                        <span className="text-ink-2 xl:hidden">Source · </span>
                        {task.source ? (SOURCE_LABEL[task.source] ?? task.source) : "—"}
                      </div>

                      <div className="min-w-0 truncate text-xs text-ink">
                        <span className="text-ink-2 xl:hidden">Owner · </span>
                        {task.assignedToName ?? <span className="text-ink-2">Unassigned</span>}
                      </div>
                    </div>

                    {canAct && (
                      <div className="flex min-w-0 flex-col gap-1.5 xl:items-end">
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          {!task.assignedTo && (
                            <Button size="sm" variant="secondary" onClick={() => assignToMe(task.id)} data-testid={`task-assign-me-${task.id}`}>
                              Assign to me
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => reschedule(task.id, 1)} data-testid={`task-reschedule-${task.id}`}>
                            +1 day
                          </Button>
                          <Button size="sm" variant="primary" onClick={() => complete(task.id)} data-testid={`task-complete-${task.id}`}>
                            Complete
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Add a note…"
                            aria-label={`Add a note for ${task.patientName}`}
                            value={noteDraft[task.id] ?? ""}
                            onChange={(e) => setNoteDraft((d) => ({ ...d, [task.id]: e.target.value }))}
                            className="h-7 w-full min-w-0 max-w-[11rem] rounded-control border border-line bg-surface px-2 text-xs text-ink outline-none placeholder:text-neutral-500 focus:border-primary-500 xl:w-40"
                            data-testid={`task-note-input-${task.id}`}
                          />
                          {noteDraft[task.id] !== undefined && (
                            <button type="button" onClick={() => saveNote(task.id)} className="text-xs font-medium text-primary-700 hover:underline">
                              Save
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Panel>
    </div>
  );
}
