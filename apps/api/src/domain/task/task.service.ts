import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { patientNameSql } from "../../lib/patient-name.js";
import type { Db } from "../../db/client.js";
import { hospitalTodayBounds } from "../../lib/hospital-time.js";
import { journeys, patients, tasks, timelineEvents, users } from "../../db/schema.js";
import type { CreateTaskInput, TaskCounts, TaskReason, TaskRow, TaskView } from "@pulseos/types";

function toRow(r: {
  id: string; patientId: string; patientName: string; journeyId: string | null; journeyType: string | null; source?: TaskRow["source"];
  assignedTo: string | null; assignedToName: string | null; type: TaskRow["type"]; priority: TaskRow["priority"];
  status: TaskRow["status"]; reason: TaskRow["reason"]; notes: string | null; dueAt: Date; completedAt: Date | null; createdAt: Date;
}): TaskRow {
  return {
    id: r.id, patientId: r.patientId, patientName: r.patientName, journeyId: r.journeyId, journeyType: r.journeyType, source: r.source ?? null,
    assignedTo: r.assignedTo, assignedToName: r.assignedToName, type: r.type, priority: r.priority, status: r.status,
    reason: r.reason, notes: r.notes, dueAt: r.dueAt.toISOString(), completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export interface TaskFilters {
  view?: TaskView;
  assignedTo?: string;
  patientId?: string;
  reason?: TaskReason;
}

export async function listTasks(db: Db, tenantId: string, filters: TaskFilters, timezone: string): Promise<TaskRow[]> {
  const { start, end } = hospitalTodayBounds(timezone);
  const now = new Date();

  const viewCondition =
    filters.view === "today"
      ? and(eq(tasks.status, "pending"), gte(tasks.dueAt, start), lt(tasks.dueAt, end))
      : filters.view === "overdue"
        ? and(eq(tasks.status, "pending"), lt(tasks.dueAt, now))
        : filters.view === "upcoming"
          ? and(or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress")), gte(tasks.dueAt, end))
          : filters.view === "completed"
            ? eq(tasks.status, "completed")
            : filters.view === "unassigned"
              ? and(isNull(tasks.assignedTo), or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress")))
              : undefined;

  const rows = await db
    .select({
      id: tasks.id, patientId: tasks.patientId, patientName: patientNameSql,
      journeyId: tasks.journeyId, journeyType: journeys.journeyType, source: journeys.source,
      assignedTo: tasks.assignedTo, assignedToName: users.name,
      type: tasks.type, priority: tasks.priority, status: tasks.status, reason: tasks.reason, notes: tasks.notes,
      dueAt: tasks.dueAt, completedAt: tasks.completedAt, createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(patients, eq(tasks.patientId, patients.id))
    .leftJoin(journeys, eq(tasks.journeyId, journeys.id))
    .leftJoin(users, eq(tasks.assignedTo, users.id))
    .where(
      and(
        eq(tasks.tenantId, tenantId),
        viewCondition,
        filters.assignedTo ? eq(tasks.assignedTo, filters.assignedTo) : undefined,
        filters.patientId ? eq(tasks.patientId, filters.patientId) : undefined,
        filters.reason ? eq(tasks.reason, filters.reason) : undefined,
      ),
    )
    .orderBy(tasks.dueAt);

  return rows.map(toRow);
}

/**
 * One aggregate query for the "My Work" tab counts, mirroring listTasks's
 * exact view-condition logic (today/overdue/upcoming/completed) via
 * COUNT(*) FILTER instead of four separate round trips. Scoped to the
 * caller's own assignment — never an arbitrary assignedTo override.
 *
 * `unassigned` is a second, tenant-wide query (never scoped to `userId` —
 * unassigned tasks by definition have no owner) and is only computed when
 * `canManageTasks` is true, matching the same MANAGE_TASKS gate that
 * task.routes.ts applies to the `unassigned` view itself — a VIEW_TASKS-only
 * caller (e.g. Doctor) gets `unassigned: undefined`, never a tenant count.
 */
export async function getTaskCounts(db: Db, tenantId: string, userId: string, canManageTasks: boolean, timezone: string): Promise<TaskCounts> {
  const { start, end } = hospitalTodayBounds(timezone);
  const now = new Date();

  const overdueCond = and(eq(tasks.status, "pending"), lt(tasks.dueAt, now));
  const todayCond = and(eq(tasks.status, "pending"), gte(tasks.dueAt, start), lt(tasks.dueAt, end));
  const upcomingCond = and(or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress")), gte(tasks.dueAt, end));
  const completedCond = eq(tasks.status, "completed");

  const [row] = await db
    .select({
      mine: sql<number>`count(*)`,
      overdue: sql<number>`count(*) filter (where ${overdueCond})`,
      today: sql<number>`count(*) filter (where ${todayCond})`,
      upcoming: sql<number>`count(*) filter (where ${upcomingCond})`,
      completed: sql<number>`count(*) filter (where ${completedCond})`,
    })
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.assignedTo, userId)));

  let unassigned: number | undefined;
  if (canManageTasks) {
    const [urow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(eq(tasks.tenantId, tenantId), isNull(tasks.assignedTo), or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress"))));
    unassigned = Number(urow.count);
  }

  return {
    mine: Number(row.mine),
    overdue: Number(row.overdue),
    today: Number(row.today),
    upcoming: Number(row.upcoming),
    completed: Number(row.completed),
    unassigned,
  };
}

export async function createTask(db: Db, tenantId: string, createdBy: string, input: CreateTaskInput): Promise<TaskRow> {
  const [row] = await db
    .insert(tasks)
    .values({
      tenantId,
      patientId: input.patientId,
      journeyId: input.journeyId ?? null,
      assignedTo: input.assignedTo ?? null,
      type: input.type,
      priority: input.priority ?? "normal",
      notes: input.notes ?? null,
      dueAt: new Date(input.dueAt),
      createdBy,
    })
    .returning();

  await db.insert(timelineEvents).values({
    tenantId, patientId: input.patientId, journeyId: input.journeyId ?? null,
    actorType: "user", actorId: createdBy, eventType: "task_created",
    title: `Task created: ${input.type.replace(/_/g, " ").toLowerCase()}`,
  });

  const [patient] = await db.select({ name: patientNameSql }).from(patients).where(eq(patients.id, row.patientId)).limit(1);
  return toRow({ ...row, patientName: patient?.name ?? "", journeyType: null, assignedToName: null });
}

export async function completeTask(db: Db, tenantId: string, taskId: string, completedBy: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [existing] = await db.select().from(tasks).where(and(eq(tasks.tenantId, tenantId), eq(tasks.id, taskId))).limit(1);
  if (!existing) return { ok: false, reason: "task_not_found" };
  if (existing.status === "completed") return { ok: false, reason: "already_completed" };

  await db.update(tasks).set({ status: "completed", completedBy, completedAt: new Date() }).where(eq(tasks.id, taskId));
  await db.insert(timelineEvents).values({
    tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
    actorType: "user", actorId: completedBy, eventType: "task_completed",
    title: `Task completed: ${existing.type.replace(/_/g, " ").toLowerCase()}`,
  });
  return { ok: true };
}

export async function rescheduleTask(db: Db, tenantId: string, taskId: string, actorId: string, newDueAt: string, timezone: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [existing] = await db.select().from(tasks).where(and(eq(tasks.tenantId, tenantId), eq(tasks.id, taskId))).limit(1);
  if (!existing) return { ok: false, reason: "task_not_found" };
  if (existing.status === "completed") return { ok: false, reason: "already_completed" };
  const dueAt = new Date(newDueAt);
  if (Number.isNaN(dueAt.getTime())) return { ok: false, reason: "invalid_due_at" };

  await db.update(tasks).set({ dueAt }).where(eq(tasks.id, taskId));
  await db.insert(timelineEvents).values({
    tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
    actorType: "user", actorId, eventType: "task_rescheduled",
    title: `Task rescheduled to ${dueAt.toLocaleDateString("en-IN", { timeZone: timezone })}`,
  });
  return { ok: true };
}

export async function getTaskById(db: Db, tenantId: string, taskId: string): Promise<TaskRow | null> {
  const [row] = await db
    .select({
      id: tasks.id, patientId: tasks.patientId, patientName: patientNameSql,
      journeyId: tasks.journeyId, journeyType: journeys.journeyType, source: journeys.source,
      assignedTo: tasks.assignedTo, assignedToName: users.name,
      type: tasks.type, priority: tasks.priority, status: tasks.status, reason: tasks.reason, notes: tasks.notes,
      dueAt: tasks.dueAt, completedAt: tasks.completedAt, createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(patients, eq(tasks.patientId, patients.id))
    .leftJoin(journeys, eq(tasks.journeyId, journeys.id))
    .leftJoin(users, eq(tasks.assignedTo, users.id))
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.id, taskId)))
    .limit(1);

  return row ? toRow(row) : null;
}

export async function addTaskNote(db: Db, tenantId: string, taskId: string, notes: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [existing] = await db.select().from(tasks).where(and(eq(tasks.tenantId, tenantId), eq(tasks.id, taskId))).limit(1);
  if (!existing) return { ok: false, reason: "task_not_found" };

  await db.update(tasks).set({ notes }).where(eq(tasks.id, taskId));
  return { ok: true };
}

export async function reassignTask(db: Db, tenantId: string, taskId: string, actorId: string, newAssigneeId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [existing] = await db.select().from(tasks).where(and(eq(tasks.tenantId, tenantId), eq(tasks.id, taskId))).limit(1);
  if (!existing) return { ok: false, reason: "task_not_found" };

  await db.update(tasks).set({ assignedTo: newAssigneeId }).where(eq(tasks.id, taskId));
  await db.insert(timelineEvents).values({
    tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
    actorType: "user", actorId, eventType: "task_reassigned",
    title: "Task reassigned",
  });
  return { ok: true };
}

/** A Journey's Next Action = the nearest-due open task on it, or null if none scheduled. */
export async function getNextActionForJourney(db: Db, journeyId: string) {
  const [row] = await db
    .select({ dueAt: tasks.dueAt, type: tasks.type })
    .from(tasks)
    .where(and(eq(tasks.journeyId, journeyId), or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress"))))
    .orderBy(tasks.dueAt)
    .limit(1);
  return row ?? null;
}
