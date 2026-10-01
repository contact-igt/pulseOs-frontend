import Fastify, { type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import { db } from "./db/client.js";
import { resolveSession } from "./domain/auth/auth.service.js";
import { authRoutes, SESSION_COOKIE } from "./domain/auth/auth.routes.js";
import { dashboardRoutes } from "./domain/dashboard/dashboard.routes.js";
import { doctorDashboardRoutes } from "./domain/dashboard/doctor.routes.js";
import { patientRoutes } from "./domain/patient/patient.routes.js";
import { journeyRoutes } from "./domain/journey/journey.routes.js";
import { outcomeRoutes } from "./domain/consultation/outcome.routes.js";
import { lookupRoutes } from "./domain/lookup/lookup.routes.js";
import { taskRoutes } from "./domain/task/task.routes.js";
import { appointmentRoutes } from "./domain/appointment/appointment.routes.js";
import { treatmentRoutes } from "./domain/treatment/treatment.routes.js";
import { conversationRoutes } from "./domain/conversation/conversation.routes.js";
import { connectorRoutes, communicationEndpointReadRoutes } from "./domain/connector/connector.routes.js";
import { callRoutes } from "./domain/connector/call.routes.js";
import { webhookRoutes } from "./domain/connector/webhook.routes.js";
import { leadRoutes } from "./domain/lead/lead.routes.js";
import { specialtyRoutes } from "./domain/specialty/specialty.routes.js";
import { crmFieldRoutes } from "./domain/crm/crm-field.routes.js";
import { crmOutcomeRoutes } from "./domain/crm/crm-outcome.routes.js";
import { crmAllocationRoutes } from "./domain/crm/crm-allocation.routes.js";
import { conversationSummaryRoutes } from "./domain/conversation/summary/conversation-summary.routes.js";
import { campaignRoutes } from "./domain/campaign/campaign.routes.js";
import { analyticsRoutes } from "./domain/analytics/analytics.routes.js";
import { websiteFormRoutes } from "./domain/acquisition/website-form.routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Unexpected failures are logged in full server-side but answered with a
  // generic body — a raw error message (e.g. a failed SQL query with table
  // names and ids) must never reach the browser. Expected 4xx errors keep
  // their specific, non-sensitive Fastify codes/messages.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err: error }, "unhandled error");
      return reply.status(status).send({ error: "internal_error" });
    }
    return reply.status(status).send({ statusCode: status, code: error.code, error: error.name, message: error.message });
  });

  app.decorate("db", db);

  await app.register(cookie);

  app.decorateRequest("sessionUser", null);

  app.addHook("onRequest", async (request) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (!sessionId) return;
    request.sessionUser = await resolveSession(app.db, sessionId);
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", process.env.WEB_ORIGIN ?? "http://localhost:3000");
    reply.header("Access-Control-Allow-Credentials", "true");
    reply.header("Access-Control-Allow-Headers", "content-type");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    if (request.method === "OPTIONS") {
      reply.status(204).send();
    }
  });

  function requireAuth(request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply, done: () => void) {
    if (!request.sessionUser) {
      reply.status(401).send({ error: "unauthenticated" });
      return;
    }
    done();
  }

  await app.register(authRoutes);
  await app.register(webhookRoutes);
  await app.register(websiteFormRoutes);
  await app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", (request, reply, done) => requireAuth(request, reply, done));
    await protectedApp.register(dashboardRoutes);
    await protectedApp.register(doctorDashboardRoutes);
    await protectedApp.register(patientRoutes);
    await protectedApp.register(journeyRoutes);
    await protectedApp.register(outcomeRoutes);
    await protectedApp.register(lookupRoutes);
    await protectedApp.register(taskRoutes);
    await protectedApp.register(appointmentRoutes);
    await protectedApp.register(treatmentRoutes);
    await protectedApp.register(conversationRoutes);
    await protectedApp.register(connectorRoutes);
    await protectedApp.register(communicationEndpointReadRoutes);
    await protectedApp.register(callRoutes);
    await protectedApp.register(leadRoutes);
    await protectedApp.register(specialtyRoutes);
    await protectedApp.register(crmFieldRoutes);
    await protectedApp.register(crmOutcomeRoutes);
    await protectedApp.register(crmAllocationRoutes);
    await protectedApp.register(conversationSummaryRoutes);
    await protectedApp.register(campaignRoutes);
    await protectedApp.register(analyticsRoutes);
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}
