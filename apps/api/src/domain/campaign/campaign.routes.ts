import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/permission.middleware.js";
import { getCampaignPerformance, getCampaignSpendAtRisk, getMarketingEfficiency } from "./campaign.service.js";
import type { SourceChannel } from "@pulseos/types";

export async function campaignRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_MARKETING"));

  app.get("/campaigns/performance", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as { branchId?: string; specialtyKey?: string; source?: SourceChannel; campaignId?: string };
    return getCampaignPerformance(app.db, tenantId, query);
  });

  app.get("/campaigns/marketing-efficiency", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as { branchId?: string; specialtyKey?: string; source?: SourceChannel; campaignId?: string };
    return getMarketingEfficiency(app.db, tenantId, query);
  });

  app.get("/campaigns/spend-at-risk", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getCampaignSpendAtRisk(app.db, tenantId);
  });
}
