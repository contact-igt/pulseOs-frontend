import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loginWithPassword, revokeSession } from "./auth.service.js";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SESSION_COOKIE = "pulseos_session";

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

    reply.setCookie(SESSION_COOKIE, result.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: result.expiresAt,
    });

    return reply.send({ user: result.user });
  });

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
