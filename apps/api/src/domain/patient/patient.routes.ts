import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/permission.middleware.js";
import { getPatient360, listPatients } from "./patient.service.js";
import { getPatientTimeline } from "../timeline/timeline.service.js";

export async function patientRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_PATIENTS"));

  app.get("/patients", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as Record<string, string | undefined>;
    return listPatients(app.db, tenantId, {
      search: query.search,
      branchId: query.branchId,
      source: query.source,
      stage: query.stage,
      ownerId: query.ownerId,
    });
  });

  app.get("/patients/:id/360", async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const { id } = request.params as { id: string };
    const result = await getPatient360(app.db, tenantId, id);
    if (!result) return reply.status(404).send({ error: "patient_not_found" });
    return result;
  });

  app.get("/patients/:id/timeline", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const { id } = request.params as { id: string };
    const { journeyId } = request.query as { journeyId?: string };
    return getPatientTimeline(app.db, tenantId, id, journeyId);
  });
}
