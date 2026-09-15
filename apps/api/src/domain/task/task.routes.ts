import type { FastifyInstance } from "fastify";
import type { CreateTaskInput, TaskView } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import {
  addTaskNote,
  completeTask,
  createTask,
  getTaskById,
  listTasks,
  reassignTask,
  rescheduleTask,
} from "./task.service.js";

const REASON_STATUS: Record<string, number> = {
  task_not_found: 404,
  already_completed: 409,
};

export async function taskRoutes(app: FastifyInstance) {
  // Reading a task list (esp. "My Work" — tasks assigned to yourself) is a
  // narrower capability than managing the task queue org-wide, so it gets
  // its own VIEW_TASKS permission (e.g. Doctor has it but not MANAGE_TASKS)
  // — every mutation below still requires the stronger MANAGE_TASKS.
  app.addHook("preHandler", requirePermission("VIEW_TASKS"));

  app.get("/tasks", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as { view?: TaskView; assignedTo?: string; patientId?: string };
    return listTasks(app.db, tenantId, { view: query.view, assignedTo: query.assignedTo, patientId: query.patientId });
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
    const result = await rescheduleTask(app.db, tenantId, id, actorId, dueAt);
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
