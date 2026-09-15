import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../auth/permission.middleware.js";
import { createPatient, getPatient360, listPatients, searchPatients } from "./patient.service.js";
import { getPatientTimeline } from "../timeline/timeline.service.js";

const createPatientBody = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  preferredLanguage: z.string().optional(),
  branchId: z.string().uuid(),
});

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

  // The global-search typeahead's own lightweight endpoint — see
  // patient.service.ts's searchPatients for why this isn't listPatients.
  app.get("/patients/search", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const { q } = request.query as { q?: string };
    return searchPatients(app.db, tenantId, q ?? "");
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

  await app.register(async (manageApp) => {
    manageApp.addHook("preHandler", requirePermission("EDIT_PATIENTS"));

    manageApp.post("/patients", async (request, reply) => {
      const tenantId = request.sessionUser!.tenantId;
      const actorId = request.sessionUser!.id;
      const parsed = createPatientBody.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });

      const result = await createPatient(app.db, tenantId, actorId, parsed.data);
      return reply.status(201).send(result);
    });
  });
}
