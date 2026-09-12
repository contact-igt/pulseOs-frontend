import type { FastifyInstance } from "fastify";
import type { SpendAtRiskCategoryKey } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import { getJourneysSummary, listJourneys } from "./journey.service.js";

export async function journeyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_JOURNEYS"));

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
      atRisk: query.atRisk as SpendAtRiskCategoryKey | undefined,
    });
  });

  app.get("/journeys/summary", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getJourneysSummary(app.db, tenantId);
  });
}
