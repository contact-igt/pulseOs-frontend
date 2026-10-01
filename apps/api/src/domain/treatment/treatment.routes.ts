import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { TreatmentStatus } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import { listTreatments, rescheduleSurgery, scheduleSurgery, updateTreatmentStatus } from "./treatment.service.js";

const REASON_STATUS: Record<string, number> = {
  treatment_not_found: 404,
  invalid_transition: 409,
  conflict: 409,
  invalid_request: 400,
  journey_not_found: 404,
  treatment_invalid: 422,
  resource_invalid: 422,
  branch_invalid: 422,
  scheduled_in_past: 422,
  surgery_already_scheduled: 409,
};

const scheduleBody = z.object({
  treatmentDefinitionId: z.string().uuid(),
  scheduledAt: z.string(),
  resourceId: z.string().uuid(),
  branchId: z.string().uuid(),
  note: z.string().max(500).optional(),
});
const rescheduleBody = z.object({ scheduledAt: z.string(), resourceId: z.string().uuid().optional(), branchId: z.string().uuid().optional(), note: z.string().max(500).optional() });

const listQuery = z.object({
  status: z.enum(["ADVISED", "DECISION_PENDING", "ACCEPTED", "SCHEDULED", "COMPLETED", "DECLINED", "CANCELLED", "LOST"]).optional(),
  ownerId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  treatmentDefinitionId: z.string().uuid().optional(),
  service: z.string().min(1).optional(),
});

export async function treatmentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_TREATMENT"));

  app.get("/treatments", async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    return listTreatments(app.db, tenantId, parsed.data);
  });

  app.patch("/treatments/:id/status", { preHandler: requirePermission("MANAGE_TREATMENT") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const actorId = request.sessionUser!.id;
    const { id } = request.params as { id: string };
    const { status, plannedDate } = request.body as { status: TreatmentStatus; plannedDate?: string };
    const result = await updateTreatmentStatus(app.db, tenantId, id, actorId, status, plannedDate);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return result;
  });

  // Schedule a procedure for a Journey (the same record the Treatments table, pipeline and calendar show).
  app.post("/journeys/:id/surgery", { preHandler: requirePermission("MANAGE_TREATMENT") }, async (request, reply) => {
    const user = request.sessionUser!;
    const id = z.string().uuid().safeParse((request.params as { id: string }).id);
    const parsed = scheduleBody.safeParse(request.body);
    if (!id.success || !parsed.success) return reply.status(400).send({ error: "invalid_request" });
    const result = await scheduleSurgery(app.db, user.tenantId, user.id, id.data, parsed.data, user.timezone);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return reply.status(201).send({ ok: true, treatmentId: result.treatmentId });
  });

  app.patch("/treatments/:id/schedule", { preHandler: requirePermission("MANAGE_TREATMENT") }, async (request, reply) => {
    const user = request.sessionUser!;
    const id = z.string().uuid().safeParse((request.params as { id: string }).id);
    const parsed = rescheduleBody.safeParse(request.body);
    if (!id.success || !parsed.success) return reply.status(400).send({ error: "invalid_request" });
    const result = await rescheduleSurgery(app.db, user.tenantId, user.id, id.data, parsed.data, user.timezone);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return result;
  });
}
