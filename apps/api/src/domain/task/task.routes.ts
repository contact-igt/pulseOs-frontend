import type { FastifyInstance } from "fastify";
import type { CreateTaskInput, TaskReason, TaskView } from "@pulseos/types";
import { hasPermission } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import {
  addTaskNote,
  completeTask,
  createTask,
  getTaskById,
  getTaskCounts,
  listTasks,
  reassignTask,
  rescheduleTask,
} from "./task.service.js";

const REASON_STATUS: Record<string, number> = {
  task_not_found: 404,
  already_completed: 409,
  invalid_due_at: 400,
};

export async function taskRoutes(app: FastifyInstance) {
  // Reading a task list (esp. "My Work" — tasks assigned to yourself) is a
  // narrower capability than managing the task queue org-wide, so it gets
  // its own VIEW_TASKS permission (e.g. Doctor has it but not MANAGE_TASKS)
  // — every mutation below still requires the stronger MANAGE_TASKS.
  app.addHook("preHandler", requirePermission("VIEW_TASKS"));

  app.get("/tasks", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as { view?: TaskView; assignedTo?: string; patientId?: string; reason?: TaskReason };
    // A caller without MANAGE_TASKS (e.g. Doctor: VIEW_TASKS only) gets a
    // narrower capability than the tenant-wide task queue — server-side,
    // never UI-only. Force their assignedTo to themselves regardless of what
    // the query string asks for, so a spoofed `assignedTo` can never be used
    // to read another staff member's (PHI-adjacent) task notes. Gated off the
    // MANAGE_TASKS permission itself, not a role-name check, so it stays
    // correct if the permission matrix changes later.
    //
    // This same override also gates the `unassigned` view (the team-attention
    // queue for system-generated tasks with no journey owner): listTasks ANDs
    // `assignedTo` together with the view condition, and the `unassigned`
    // view's condition is `assignedTo IS NULL` — so a non-MANAGE_TASKS caller
    // forced to `assignedTo = <their own id>` can never match a row that is
    // simultaneously NULL, and always gets an empty result, never the
    // tenant-wide unassigned queue. No separate gate is needed for that view;
    // it composes automatically from this one override (see
    // tasks.integration.test.ts's "unassigned view" describe block for proof).
    const canManageTasks = hasPermission(request.sessionUser!.role, "MANAGE_TASKS");
    const assignedTo = canManageTasks ? query.assignedTo : request.sessionUser!.id;
    return listTasks(app.db, tenantId, { view: query.view, assignedTo, patientId: query.patientId, reason: query.reason }, request.sessionUser!.timezone);
  });

  // Registered ahead of nothing conflicting — "/tasks/:id/..." mutation
  // routes below are all PATCH with a fixed suffix, so this GET is unambiguous.
  app.get("/tasks/counts", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const userId = request.sessionUser!.id;
    const canManageTasks = hasPermission(request.sessionUser!.role, "MANAGE_TASKS");
    return getTaskCounts(app.db, tenantId, userId, canManageTasks, request.sessionUser!.timezone);
  });

  app.post("/tasks", { preHandler: requirePermission("MANAGE_TASKS") }, async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const createdBy = request.sessionUser!.id;
    const input = request.body as CreateTaskInput;
    return createTask(app.db, tenantId, createdBy, input);
  });

  app.patch("/tasks/:id/note", { preHandler: requirePermission("MANAGE_TASKS") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const { id } = request.params as { id: string };
    const { notes } = request.body as { notes: string };
    const result = await addTaskNote(app.db, tenantId, id, notes);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return getTaskById(app.db, tenantId, id);
  });

  app.patch("/tasks/:id/reschedule", { preHandler: requirePermission("MANAGE_TASKS") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const actorId = request.sessionUser!.id;
    const { id } = request.params as { id: string };
    const { dueAt } = request.body as { dueAt: string };
    const result = await rescheduleTask(app.db, tenantId, id, actorId, dueAt, request.sessionUser!.timezone);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return getTaskById(app.db, tenantId, id);
  });

  app.patch("/tasks/:id/reassign", { preHandler: requirePermission("MANAGE_TASKS") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const actorId = request.sessionUser!.id;
    const { id } = request.params as { id: string };
    const { assignedTo } = request.body as { assignedTo: string };
    const result = await reassignTask(app.db, tenantId, id, actorId, assignedTo);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return getTaskById(app.db, tenantId, id);
  });

  app.patch("/tasks/:id/complete", { preHandler: requirePermission("MANAGE_TASKS") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const actorId = request.sessionUser!.id;
    const { id } = request.params as { id: string };
    const result = await completeTask(app.db, tenantId, id, actorId);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return getTaskById(app.db, tenantId, id);
  });
}
