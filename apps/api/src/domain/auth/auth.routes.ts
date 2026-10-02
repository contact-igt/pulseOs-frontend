import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loginByRole, loginWithPassword, revokeSession } from "./auth.service.js";
import { LoginThrottle } from "./login-throttle.js";
import { DEFAULT_DEMO_ENVIRONMENT, DEMO_ENVIRONMENTS, DEMO_LOGIN_ROLES, type DemoEnvironmentKey } from "./demo-environments.js";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
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

function setSessionCookie(reply: import("fastify").FastifyReply, sessionId: string, expiresAt: Date, persistent = true) {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // A session cookie (no expiry) unless the person asked to be remembered; the server-side session expires either way.
    ...(persistent ? { expires: expiresAt } : {}),
  });
}

export async function authRoutes(app: FastifyInstance) {
  // Failed sign-ins are throttled per account+address and per address (see login-throttle.ts). Limits are env-tunable.
  const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);
  const throttle = new LoginThrottle({ maxPerAccount: num(process.env.LOGIN_MAX_FAILURES), maxPerAddress: num(process.env.LOGIN_MAX_FAILURES_PER_ADDRESS), windowMs: num(process.env.LOGIN_LOCK_WINDOW_MS) });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request" });
    }

    // The attempt is admitted and counted BEFORE the slow password check (so parallel guesses cannot all slip through),
    // and a lock is answered identically whether or not the account exists.
    const gate = throttle.begin(request.ip, parsed.data.email);
    if (!gate.allowed) {
      return reply.header("Retry-After", String(gate.retryAfterSeconds)).status(429).send({ error: "too_many_attempts", message: "Too many sign-in attempts. Please wait a few minutes and try again." });
    }

    const result = await loginWithPassword(app.db, parsed.data.email, parsed.data.password, parsed.data.remember === true);
    if (!result.ok) {
      return reply.status(401).send({ error: result.reason });
    }
    throttle.succeed(request.ip, parsed.data.email);

    setSessionCookie(reply, result.sessionId, result.expiresAt, result.remember);
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

      setSessionCookie(reply, result.sessionId, result.expiresAt, false);
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
