import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/permission.middleware.js";
import { getConnectorDetail, listConnectors, upsertConnectorConfig } from "./connector.service.js";
import { syncConnectorCampaigns } from "../acquisition/campaign-sync.service.js";
import { syncConnectorPerformance } from "../acquisition/gbp-performance.service.js";

const REASON_STATUS: Record<string, number> = {
  connector_not_found: 404,
  unsupported_capability: 422,
  sync_failed: 502,
};

export async function connectorRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_INTEGRATIONS"));

  app.get("/connectors", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return listConnectors(app.db, tenantId);
  });

  app.get("/connectors/:id", async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const { id } = request.params as { id: string };
    const detail = await getConnectorDetail(app.db, tenantId, id);
    if (!detail) return reply.status(404).send({ error: "connector_not_found" });
    return detail;
  });

  app.patch("/connectors/:id", { preHandler: requirePermission("MANAGE_INTEGRATIONS") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const { id } = request.params as { id: string };
    const body = request.body as { displayName?: string; configuration?: Record<string, unknown>; secrets?: Record<string, unknown> };
    const result = await upsertConnectorConfig(app.db, tenantId, id, body);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return result;
  });

  app.post("/connectors/:id/sync-campaigns", { preHandler: requirePermission("MANAGE_INTEGRATIONS") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const { id } = request.params as { id: string };
    const result = await syncConnectorCampaigns(app.db, tenantId, id);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason, message: result.message });
    return result;
  });

  app.post("/connectors/:id/sync-performance", { preHandler: requirePermission("MANAGE_INTEGRATIONS") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const { id } = request.params as { id: string };
    const result = await syncConnectorPerformance(app.db, tenantId, id);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason, message: result.message });
    return result;
  });
}
