"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@pulseos/api-client";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@pulseos/ui";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import { withFrom } from "@/components/shell/BackLink";
import { hasPermission } from "@pulseos/types";
import type { TaskRow, TaskStatus, TaskType, TaskView } from "@pulseos/types";

const TABS: { key: TaskView | "mine"; label: string }[] = [
  { key: "mine", label: "My Work" },
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function isOverdue(task: TaskRow) {
  return task.status === "pending" && new Date(task.dueAt).getTime() < Date.now();
}

export default function MyWorkPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const quickCreate = useQuickCreate();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("mine");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  const currentUserId = session.data?.user.id;
  // MANAGE_TASKS gates create/complete/reschedule/note server-side (Doctor
  // has only the weaker VIEW_TASKS) — mirrored here only to avoid showing
  // dead controls, never as the actual authorization boundary.
  const canManageTasks = !!session.data && hasPermission(session.data.user.role, "MANAGE_TASKS");

  const tasks = useQuery({
    queryKey: ["tasks", tab, currentUserId],
    queryFn: () => api.tasks(tab === "mine" ? { assignedTo: currentUserId } : { view: tab, assignedTo: currentUserId }),
    enabled: !!currentUserId,
  });

  const counts = useQuery({
    queryKey: ["tasks", "counts", currentUserId],
    queryFn: api.taskCounts,
    enabled: !!currentUserId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
      <PageHeader
        title="My Work"
        subtitle="Tasks, callbacks and follow-ups assigned to you."
        action={
          canManageTasks && (
            <Button variant="primary" onClick={() => quickCreate.openAddTask()} data-testid="add-task-button">
              + Add Task
            </Button>
          )
        }
      />

      <div className="flex flex-wrap gap-1 rounded border border-neutral-200 bg-white p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition ${tab === t.key ? "bg-primary-50 text-primary-700" : "text-neutral-500 hover:bg-neutral-100"}`}
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

      <Card className="p-0">
        {(tasks.isLoading || session.isLoading) && <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
        {tasks.isError && <div className="p-4"><ErrorState message="Could not load tasks." /></div>}
        {tasks.data && tasks.data.length === 0 && (
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
        {tasks.data && tasks.data.length > 0 && (
          <ul className="divide-y divide-neutral-100" data-testid="my-work-task-list">
            {tasks.data.map((task) => {
              const overdue = isOverdue(task);
              return (
                <li key={task.id} className="p-4" data-testid={`task-row-${task.id}`}>
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
                        <Badge tone={overdue ? "danger" : STATUS_TONE[task.status]}>{TYPE_LABEL[task.type]}</Badge>
                        {task.priority === "high" && <Badge tone="warning">High priority</Badge>}
                        <span className="text-xs text-neutral-500">Due {fmtDate(task.dueAt)}</span>
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
