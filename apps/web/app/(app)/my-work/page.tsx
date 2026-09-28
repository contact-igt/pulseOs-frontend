"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, TASK_REASON_LABEL, TASK_REASON_TONE, fmtDateTime as fmtDate, urgencyLabel } from "@pulseos/ui";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import { withFrom } from "@/components/shell/BackLink";
import { hasPermission } from "@pulseos/types";
import type { TaskReason, TaskRow, TaskStatus, TaskType, TaskView } from "@pulseos/types";

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

const STATUS_TONE: Record<TaskStatus, "neutral" | "warning" | "danger" | "primary"> = {
  pending: "neutral",
  in_progress: "primary",
  completed: "neutral",
  cancelled: "neutral",
};


function isOverdue(task: TaskRow) {
  return task.status === "pending" && new Date(task.dueAt).getTime() < Date.now();
}

export default function MyWorkPage() {
  const router = useRouter();
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

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="my-work-page">
      {canManageTasks && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => quickCreate.openAddTask()} data-testid="add-task-button">
            + Add Task
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded border border-neutral-200 bg-white p-1" role="tablist">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={effectiveTab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition ${effectiveTab === t.key ? "bg-primary-50 text-primary-700" : "text-neutral-500 hover:bg-neutral-100"}`}
            data-testid={`my-work-tab-${t.key}`}
          >
            {t.label}
            {counts.data && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-neutral-500" data-testid={`my-work-tab-count-${t.key}`}>
                {counts.data[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by reason">
        {REASON_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            role="tab"
            aria-selected={reasonKey === g.key}
            onClick={() => setReasonKey(g.key)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${reasonKey === g.key ? "border-primary-200 bg-primary-50 text-primary-700" : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"}`}
            data-testid={`my-work-reason-${g.key}`}
          >
            {g.label}
            {tasks.data && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-neutral-500" data-testid={`my-work-reason-count-${g.key}`}>
                {reasonCounts[g.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card className="p-0">
        {(tasks.isLoading || session.isLoading) && <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
        {tasks.isError && <div className="p-4"><ErrorState message="Could not load tasks." /></div>}
        {visibleTasks && visibleTasks.length === 0 && (
          <div className="p-8">
            <EmptyState message="You're all caught up." />
            {canManageTasks && (
              <div className="mt-3 flex justify-center">
                <button type="button" onClick={() => quickCreate.openAddTask()} className="text-xs font-medium text-primary-600 hover:underline">
                  + Add Task
                </button>
              </div>
            )}
          </div>
        )}
        {visibleTasks && visibleTasks.length > 0 && (
          <ul className="divide-y divide-neutral-100" data-testid="my-work-task-list">
            {visibleTasks.map((task) => {
              const overdue = isOverdue(task);
              const urgency = task.status === "pending" ? urgencyLabel(task.dueAt) : null;
              return (
                <li
                  key={task.id}
                  className={`p-4 ${overdue ? "border-l-2 border-l-danger-500 bg-danger-100/30" : ""}`}
                  data-testid={`task-row-${task.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => router.push(withFrom(`/patients/${task.patientId}`, "my-work"))}
                        className="text-sm font-medium text-slate-900 hover:underline"
                      >
                        {task.patientName}
                      </button>
                      <span className="ml-2 text-xs text-neutral-500">{task.journeyType ?? "General"}</span>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={STATUS_TONE[task.status]}>{TYPE_LABEL[task.type]}</Badge>
                        <Badge tone={TASK_REASON_TONE[task.reason]}>{TASK_REASON_LABEL[task.reason]}</Badge>
                        {task.priority === "high" && <Badge tone="warning">High priority</Badge>}
                        <span className={`text-xs tabular-nums ${overdue ? "font-medium text-danger-500" : "text-neutral-500"}`}>
                          {urgency ? urgency.text : `Due ${fmtDate(task.dueAt)}`}
                        </span>
                        <span className="text-xs text-neutral-400">· {fmtDate(task.dueAt)}</span>
                        {task.assignedToName && <span className="text-xs text-neutral-400">· {task.assignedToName}</span>}
                      </div>
                      {task.notes && <p className="mt-1.5 text-xs text-neutral-600">{task.notes}</p>}
                    </div>

                    {canManageTasks && task.status !== "completed" && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button type="button" onClick={() => reschedule(task.id, 1)} className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50" data-testid={`task-reschedule-${task.id}`}>
                          +1 day
                        </button>
                        <button type="button" onClick={() => complete(task.id)} className="rounded bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700" data-testid={`task-complete-${task.id}`}>
                          Complete
                        </button>
                      </div>
                    )}
                  </div>

                  {canManageTasks && task.status !== "completed" && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Add a note…"
                        value={noteDraft[task.id] ?? ""}
                        onChange={(e) => setNoteDraft((d) => ({ ...d, [task.id]: e.target.value }))}
                        className="w-full max-w-xs rounded border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-primary-400"
                        data-testid={`task-note-input-${task.id}`}
                      />
                      {noteDraft[task.id] !== undefined && (
                        <button type="button" onClick={() => saveNote(task.id)} className="text-xs font-medium text-primary-600 hover:underline">
                          Save
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
