import type { FastifyInstance } from "fastify";
import type { TreatmentStatus } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import { listTreatments, updateTreatmentStatus } from "./treatment.service.js";

const REASON_STATUS: Record<string, number> = {
  treatment_not_found: 404,
  invalid_transition: 409,
  conflict: 409,
};

export async function treatmentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_TREATMENT"));

  app.get("/treatments", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as { status?: TreatmentStatus; ownerId?: string };
    return listTreatments(app.db, tenantId, query);
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
