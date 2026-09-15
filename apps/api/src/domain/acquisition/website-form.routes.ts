import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getConnectorById, touchConnectorError, touchConnectorSuccess } from "../connector/connector.service.js";
import { markEventFailed, markEventProcessed, recordConnectorEvent } from "../connector/connector-event.service.js";
import { processWebsiteFormSubmission } from "./website-form.service.js";

const submissionBody = z.object({
  submissionId: z.string().min(1),
  formId: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().nullish(),
  service: z.string().nullish(),
  language: z.string().nullish(),
  branchId: z.string().uuid().nullish(),
  pageUrl: z.string().nullish(),
  utm: z.object({
    source: z.string().nullish(),
    medium: z.string().nullish(),
    campaign: z.string().nullish(),
    content: z.string().nullish(),
    term: z.string().nullish(),
  }).default({}),
  clickIds: z.object({
    gclid: z.string().nullish(),
    gbraid: z.string().nullish(),
    wbraid: z.string().nullish(),
    fbclid: z.string().nullish(),
  }).default({}),
});

// PulseOS's own public landing-page/website form endpoint — not a
// third-party adapter, so it doesn't go through a provider registry.
// Tenant-safe the same way every other webhook route is: the connector id
// in the URL is the only source of tenant identity, never a value from the
// request body. Unauthenticated by session by design — the caller is the
// tenant's own public website.
export async function websiteFormRoutes(app: FastifyInstance) {
  app.post("/forms/website/:connectorId", async (request, reply) => {
    const { connectorId } = request.params as { connectorId: string };
    const connector = await getConnectorById(app.db, connectorId);
    if (!connector || connector.type !== "ACQUISITION" || connector.provider !== "website_form") {
      return reply.status(404).send({ error: "not_found" });
    }
    if (connector.status === "DISABLED") {
      return reply.status(403).send({ error: "connector_disabled" });
    }

    const parsed = submissionBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "invalid_request" });
    }
    const data = parsed.data;

    const { duplicate, eventId } = await recordConnectorEvent(app.db, {
      tenantId: connector.tenantId,
      connectorId,
      externalEventId: data.submissionId,
      direction: "inbound",
      payload: { type: "website_form", formId: data.formId },
    });
    if (duplicate) {
      return reply.status(200).send({ ok: true, duplicate: true });
    }

    try {
      const result = await processWebsiteFormSubmission(app.db, connector.tenantId, {
        formId: data.formId,
        name: data.name,
        phone: data.phone,
        email: data.email ?? null,
        service: data.service ?? null,
        language: data.language ?? null,
        branchId: data.branchId ?? null,
        pageUrl: data.pageUrl ?? null,
        submissionId: data.submissionId,
        utm: {
          source: data.utm.source ?? null,
          medium: data.utm.medium ?? null,
          campaign: data.utm.campaign ?? null,
          content: data.utm.content ?? null,
          term: data.utm.term ?? null,
        },
        clickIds: {
          gclid: data.clickIds.gclid ?? null,
          gbraid: data.clickIds.gbraid ?? null,
          wbraid: data.clickIds.wbraid ?? null,
          fbclid: data.clickIds.fbclid ?? null,
        },
        occurredAt: new Date(),
      });
      await markEventProcessed(app.db, eventId);
      await touchConnectorSuccess(app.db, connectorId);
      return reply.status(200).send({ ok: true, duplicate: false, ...result });
    } catch (err) {
      await markEventFailed(app.db, eventId, (err as Error).message);
      await touchConnectorError(app.db, connectorId, (err as Error).message);
      return reply.status(500).send({ error: "processing_failed" });
    }
  });
}
