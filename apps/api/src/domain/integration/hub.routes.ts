import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hasPermission } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import { configureIntegration, getHubDetail, listHub, listIntegrationLogs } from "./hub.service.js";
import { createWebhook, deleteWebhook, listWebhooks, updateWebhook } from "./outbound-webhook.service.js";
import { webhookInputSchema } from "./webhook-rules.js";

const REASON_STATUS: Record<string, number> = {
  unknown_integration: 404,
  blocked: 409,
  unknown_field: 422,
  invalid_url: 422,
  https_required: 422,
  private_address: 422,
  credentials_in_url: 422,
  invalid_conditions: 422,
  webhook_not_found: 404,
};

const configureSchema = z.object({
  configuration: z.record(z.string().max(300)).optional(),
  secrets: z.record(z.string().max(2000)).optional(),
  mode: z.enum(["FIXTURE", "SANDBOX", "LIVE"]).optional(),
});

const logQuerySchema = z.object({
  provider: z.string().max(40).optional(),
  status: z.string().max(20).optional(),
  from: z.string().max(10).optional(),
  to: z.string().max(10).optional(),
});

export async function integrationHubRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_INTEGRATIONS"));

  app.get("/integrations/hub", async (request) => {
    const u = request.sessionUser!;
    return listHub(app.db, u.tenantId, u.role, u.capabilities);
  });

  app.get("/integrations/hub/:key", async (request, reply) => {
    const u = request.sessionUser!;
    const detail = await getHubDetail(app.db, u.tenantId, u.role, u.capabilities, (request.params as { key: string }).key);
    if (!detail) return reply.status(404).send({ error: "unknown_integration" });
    return detail;
  });

  // Operational settings: Admin and Super Admin. Credentials and the connection mode: Super Admin only — refused outright
  // (not silently stripped) so nobody thinks a secret was saved.
  app.put("/integrations/hub/:key/configuration", { preHandler: requirePermission("MANAGE_INTEGRATION_CONFIG") }, async (request, reply) => {
    const u = request.sessionUser!;
    const parsed = configureSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    if ((parsed.data.secrets !== undefined || parsed.data.mode !== undefined) && !hasPermission(u.role, "MANAGE_INTEGRATION_SECRETS")) {
      return reply.status(403).send({ error: "forbidden", requiredPermission: "MANAGE_INTEGRATION_SECRETS" });
    }
    const result = await configureIntegration(app.db, u.tenantId, (request.params as { key: string }).key, parsed.data);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    request.log.info({ integration: { key: (request.params as { key: string }).key, userId: u.id, tenantId: u.tenantId, changed: Object.keys(parsed.data) } }, "integration configured");
    return getHubDetail(app.db, u.tenantId, u.role, u.capabilities, (request.params as { key: string }).key);
  });

  app.get("/integrations/logs", async (request, reply) => {
    const u = request.sessionUser!;
    const parsed = logQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    return listIntegrationLogs(app.db, u.tenantId, parsed.data);
  });

  // Outbound webhooks: Super Admin only for everything, including reading the list.
  app.register(async (hooks) => {
    hooks.addHook("preHandler", requirePermission("MANAGE_INTEGRATION_SECRETS"));

    hooks.get("/integrations/webhooks", async (request) => listWebhooks(app.db, request.sessionUser!.tenantId));

    hooks.post("/integrations/webhooks", async (request, reply) => {
      const u = request.sessionUser!;
      const parsed = webhookInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
      const result = await createWebhook(app.db, u.tenantId, u.id, parsed.data);
      if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
      return reply.status(201).send({ webhook: result.webhook, signingSecret: result.signingSecret });
    });

    hooks.patch("/integrations/webhooks/:id", async (request, reply) => {
      const parsed = webhookInputSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
      const result = await updateWebhook(app.db, request.sessionUser!.tenantId, (request.params as { id: string }).id, parsed.data);
      if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
      return result.webhook;
    });

    hooks.delete("/integrations/webhooks/:id", async (request, reply) => {
      const ok = await deleteWebhook(app.db, request.sessionUser!.tenantId, (request.params as { id: string }).id);
      return ok ? reply.status(204).send() : reply.status(404).send({ error: "webhook_not_found" });
    });
  });
}
