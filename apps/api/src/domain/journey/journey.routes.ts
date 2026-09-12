import type { FastifyInstance } from "fastify";
import { getJourneysSummary, listJourneys } from "./journey.service.js";

export async function journeyRoutes(app: FastifyInstance) {
  app.get("/journeys", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as Record<string, string | undefined>;
    return listJourneys(app.db, tenantId, {
      source: query.source,
      campaignId: query.campaignId,
      branchId: query.branchId,
      stage: query.stage,
      ownerId: query.ownerId,
      doctorId: query.doctorId,
    });
  });

  app.get("/journeys/summary", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getJourneysSummary(app.db, tenantId);
  });
}
