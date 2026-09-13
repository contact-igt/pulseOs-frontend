import type { FastifyInstance, FastifyRequest } from "fastify";
import { getConnectorById, getConnectorSecrets, touchConnectorError, touchConnectorSuccess } from "./connector.service.js";
import { markEventFailed, markEventProcessed, recordConnectorEvent } from "./connector-event.service.js";
import { getMessagingAdapter, getTelephonyAdapter } from "./registry.js";
import { processInboundWhatsAppMessage, processWhatsAppStatusUpdate } from "./whatsapp-webhook.service.js";
import { persistInboundCall } from "./call-webhook.service.js";

interface RequestWithRawBody extends FastifyRequest {
  rawBody?: string;
}

// Webhooks are unauthenticated by session (the caller is Meta/Runo, not a
// PulseOS user) — every request is authenticated instead via the provider's
// own signature/shared-secret mechanism, verified against this tenant's
// connector secrets. Registered outside the session-auth protected group.
export async function webhookRoutes(app: FastifyInstance) {
  // Capture the raw request body before JSON parsing so WhatsApp's HMAC
  // signature (computed over the exact bytes Meta sent) can be verified.
  // Scoped to this plugin only via Fastify's encapsulation — the rest of
  // the app keeps the default JSON parser untouched.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as RequestWithRawBody).rawBody = body as string;
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.get("/webhooks/whatsapp/:connectorId", async (request, reply) => {
    const { connectorId } = request.params as { connectorId: string };
    const connector = await getConnectorById(app.db, connectorId);
    if (!connector) return reply.status(404).send("not_found");

    const adapter = getMessagingAdapter(connector.provider);
    if (!adapter) return reply.status(404).send("not_found");

    const secrets = await getConnectorSecrets(app.db, connectorId);
    if (!secrets) return reply.status(403).send("forbidden");

    const query = request.query as Record<string, string>;
    const challenge = adapter.verifyWebhookChallenge(query, secrets);
    if (challenge === null) return reply.status(403).send("forbidden");
    return reply.status(200).send(challenge);
  });

  app.post("/webhooks/whatsapp/:connectorId", async (request, reply) => {
    const { connectorId } = request.params as { connectorId: string };
    const connector = await getConnectorById(app.db, connectorId);
    if (!connector || connector.status === "DISABLED") return reply.status(200).send({ ok: true });

    const adapter = getMessagingAdapter(connector.provider);
    if (!adapter) return reply.status(200).send({ ok: true });

    const secrets = await getConnectorSecrets(app.db, connectorId);
    if (!secrets) return reply.status(200).send({ ok: true });

    const rawBody = (request as RequestWithRawBody).rawBody ?? "";
    const signatureHeader = request.headers["x-hub-signature-256"] as string | undefined;
    if (!adapter.verifyWebhookSignature(rawBody, signatureHeader, secrets)) {
      app.log.warn({ connectorId }, "WhatsApp webhook signature rejected");
      return reply.status(401).send({ error: "invalid_signature" });
    }

    const parsed = adapter.parseWebhookPayload(request.body);

    for (const msg of parsed.messages) {
      const { duplicate, eventId } = await recordConnectorEvent(app.db, {
        tenantId: connector.tenantId,
        connectorId,
        externalEventId: msg.externalEventId,
        direction: "inbound",
        payload: { type: "message" },
      });
      if (duplicate) continue;

      try {
        await processInboundWhatsAppMessage(app.db, connector.tenantId, connectorId, msg);
        await markEventProcessed(app.db, eventId);
        await touchConnectorSuccess(app.db, connectorId);
      } catch (err) {
        await markEventFailed(app.db, eventId, (err as Error).message);
        await touchConnectorError(app.db, connectorId, (err as Error).message);
      }
    }

    for (const status of parsed.statuses) {
      const { duplicate, eventId } = await recordConnectorEvent(app.db, {
        tenantId: connector.tenantId,
        connectorId,
        externalEventId: status.externalEventId,
        direction: "inbound",
        payload: { type: "status" },
      });
      if (duplicate) continue;

      try {
        await processWhatsAppStatusUpdate(app.db, connectorId, status);
        await markEventProcessed(app.db, eventId);
        await touchConnectorSuccess(app.db, connectorId);
      } catch (err) {
        await markEventFailed(app.db, eventId, (err as Error).message);
      }
    }

    return reply.status(200).send({ ok: true });
  });

  app.post("/webhooks/runo/:connectorId", async (request, reply) => {
    const { connectorId } = request.params as { connectorId: string };
    const connector = await getConnectorById(app.db, connectorId);
    if (!connector || connector.status === "DISABLED") return reply.status(200).send({ ok: true });

    const adapter = getTelephonyAdapter(connector.provider);
    if (!adapter) return reply.status(200).send({ ok: true });

    const secrets = await getConnectorSecrets(app.db, connectorId);
    if (!secrets) return reply.status(200).send({ ok: true });

    if (!adapter.verifyWebhook(request.body, request.headers as Record<string, string | undefined>, secrets)) {
      app.log.warn({ connectorId }, "Runo webhook authentication rejected");
      return reply.status(401).send({ error: "unauthorized" });
    }

    const calls = adapter.parseWebhookPayload(request.body);
    for (const call of calls) {
      const { duplicate, eventId } = await recordConnectorEvent(app.db, {
        tenantId: connector.tenantId,
        connectorId,
        externalEventId: call.externalEventId,
        direction: "inbound",
        payload: { type: "call" },
      });
      if (duplicate) continue;

      try {
        await persistInboundCall(app.db, connector.tenantId, connectorId, call);
        await markEventProcessed(app.db, eventId);
        await touchConnectorSuccess(app.db, connectorId);
      } catch (err) {
        await markEventFailed(app.db, eventId, (err as Error).message);
        await touchConnectorError(app.db, connectorId, (err as Error).message);
      }
    }

    return reply.status(200).send({ ok: true });
  });
}
