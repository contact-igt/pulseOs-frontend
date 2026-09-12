import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { db } from "./db/client.js";
import { resolveSession } from "./domain/auth/auth.service.js";
import { authRoutes, SESSION_COOKIE } from "./domain/auth/auth.routes.js";
import { dashboardRoutes } from "./domain/dashboard/dashboard.routes.js";
import { doctorDashboardRoutes } from "./domain/dashboard/doctor.routes.js";

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
  await app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", (request, reply, done) => requireAuth(request, reply, done));
    await protectedApp.register(dashboardRoutes);
    await protectedApp.register(doctorDashboardRoutes);
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}
