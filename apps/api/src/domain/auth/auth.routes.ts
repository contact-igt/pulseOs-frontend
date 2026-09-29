import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loginByRole, loginWithPassword, revokeSession } from "./auth.service.js";
import { DEFAULT_DEMO_ENVIRONMENT, DEMO_ENVIRONMENTS, DEMO_LOGIN_ROLES, type DemoEnvironmentKey } from "./demo-environments.js";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SESSION_COOKIE = "pulseos_session";

// Evaluated once, at route-registration time (buildApp), not per-request —
// so in production, or with the flag off, these routes don't exist at all
// rather than existing and 403ing. NODE_ENV !== "production" alone is not
// enough: every local/staging box already runs non-production, so the
// second, explicit opt-in flag is what actually keeps this off by default.
function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";
}

const devLoginBody = z.object({
  role: z.enum(["SUPER_ADMIN", "HOSPITAL_ADMIN", "FRONT_DESK", "PATIENT_COORDINATOR", "DOCTOR"]),
  environment: z.enum(DEMO_ENVIRONMENTS.map((e) => e.key) as [DemoEnvironmentKey, ...DemoEnvironmentKey[]]).optional(),
});

function setSessionCookie(reply: import("fastify").FastifyReply, sessionId: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request" });
    }

    const result = await loginWithPassword(app.db, parsed.data.email, parsed.data.password);
    if (!result.ok) {
      return reply.status(401).send({ error: result.reason });
    }

    setSessionCookie(reply, result.sessionId, result.expiresAt);
    return reply.send({ user: result.user });
  });

  // Development-only convenience — see devLoginEnabled() above. Registered
  // conditionally so these two routes simply don't exist unless explicitly
  // opted into outside production, never merely permission-gated.
  if (devLoginEnabled()) {
    app.get("/auth/dev-login/roles", async (_request, reply) => {
      // Only roles with an actual seeded demo account belong here (there's
      // no seeded SUPER_ADMIN, so it's deliberately absent).
      return reply.send(DEMO_LOGIN_ROLES.map(({ role, label }) => ({ role, label })));
    });

    app.get("/auth/dev-login/environments", async (_request, reply) => {
      return reply.send(DEMO_ENVIRONMENTS.map(({ key, label }) => ({ key, label })));
    });

    app.post("/auth/dev-login", async (request, reply) => {
      const parsed = devLoginBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "invalid_request" });
      }

      const result = await loginByRole(app.db, parsed.data.role, parsed.data.environment ?? DEFAULT_DEMO_ENVIRONMENT);
      if (!result.ok) {
        return reply.status(404).send({ error: result.reason });
      }

      setSessionCookie(reply, result.sessionId, result.expiresAt);
      return reply.send({ user: result.user });
    });
  }

  app.post("/auth/logout", async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId) {
      await revokeSession(app.db, sessionId);
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/auth/session", async (request, reply) => {
    if (!request.sessionUser) {
      return reply.status(401).send({ error: "unauthenticated" });
    }
    return reply.send({ user: request.sessionUser });
  });
}

export { SESSION_COOKIE };
