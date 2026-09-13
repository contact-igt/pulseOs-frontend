import Fastify from "fastify";
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
import { connectorRoutes } from "./domain/connector/connector.routes.js";
import { webhookRoutes } from "./domain/connector/webhook.routes.js";
import { leadRoutes } from "./domain/lead/lead.routes.js";
import { specialtyRoutes } from "./domain/specialty/specialty.routes.js";
import { campaignRoutes } from "./domain/campaign/campaign.routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

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
    reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
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
    await protectedApp.register(leadRoutes);
    await protectedApp.register(specialtyRoutes);
    await protectedApp.register(campaignRoutes);
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}
