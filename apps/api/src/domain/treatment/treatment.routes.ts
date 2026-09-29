import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { TreatmentStatus } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import { listTreatments, updateTreatmentStatus } from "./treatment.service.js";

const REASON_STATUS: Record<string, number> = {
  treatment_not_found: 404,
  invalid_transition: 409,
  conflict: 409,
};

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
}
