import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { queryClient } from "../db/client.js";
import type { FastifyInstance } from "fastify";
import type { ConversationRow } from "@pulseos/types";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

async function loginAs(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: DEMO_PASSWORD } });
  return res.cookies.find((c) => c.name === "pulseos_session")!.value;
}

describe.skipIf(!DEMO_PASSWORD)("inbox / conversations (integration)", () => {
  let app: FastifyInstance;
  let coordinatorCookie: string;
  let doctorCookie: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    coordinatorCookie = await loginAs(app, "coordinator@pulseos.local");
    doctorCookie = await loginAs(app, "doctor@pulseos.local");
  });

  afterAll(async () => {
    await app.close();
    await queryClient.end();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/conversations" });
    expect(res.statusCode).toBe(401);
  });

  it("doctor role (no VIEW_INBOX) cannot view the inbox", async () => {
    const res = await app.inject({ method: "GET", url: "/conversations", cookies: { pulseos_session: doctorCookie } });
    expect(res.statusCode).toBe(403);
    expect(res.json().requiredPermission).toBe("VIEW_INBOX");
  });

  it("coordinator sees the conversation list across channels", async () => {
    const res = await app.inject({ method: "GET", url: "/conversations", cookies: { pulseos_session: coordinatorCookie } });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as ConversationRow[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.patientName).toBeTruthy();
      expect(["WHATSAPP", "CALL", "SMS", "EMAIL", "INTERNAL"]).toContain(row.channel);
    }
  });

  it("filters by ownership state", async () => {
    const res = await app.inject({ method: "GET", url: "/conversations?ownershipState=HUMAN_REQUIRED", cookies: { pulseos_session: coordinatorCookie } });
    const rows = res.json() as ConversationRow[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.ownershipState).toBe("HUMAN_REQUIRED");
  });

  it("full lifecycle on one conversation needing attention: claim, send a message, then return to AI", async () => {
    const list = await app.inject({ method: "GET", url: "/conversations?ownershipState=HUMAN_REQUIRED", cookies: { pulseos_session: coordinatorCookie } });
    const target = (list.json() as ConversationRow[])[0];

    const claim = await app.inject({ method: "PATCH", url: `/conversations/${target.id}/claim`, cookies: { pulseos_session: coordinatorCookie } });
    expect(claim.statusCode).toBe(200);

    const afterClaim = await app.inject({ method: "GET", url: `/conversations/${target.id}`, cookies: { pulseos_session: coordinatorCookie } });
    expect(afterClaim.statusCode).toBe(200);
    const detail = afterClaim.json();
    expect(detail.conversation.ownershipState).toBe("HUMAN_ACTIVE");
    expect(detail.conversation.ownerName).toBeTruthy();
    expect(Array.isArray(detail.messages)).toBe(true);

    const send = await app.inject({
      method: "POST", url: `/conversations/${target.id}/messages`, cookies: { pulseos_session: coordinatorCookie },
      payload: { body: "Thanks for waiting — here's the update on your treatment plan." },
    });
    expect(send.statusCode).toBe(200);

    const returnToAi = await app.inject({ method: "PATCH", url: `/conversations/${target.id}/return-to-ai`, cookies: { pulseos_session: coordinatorCookie } });
    expect(returnToAi.statusCode).toBe(200);

    const afterReturn = await app.inject({ method: "GET", url: `/conversations/${target.id}`, cookies: { pulseos_session: coordinatorCookie } });
    const finalDetail = afterReturn.json();
    expect(finalDetail.conversation.ownershipState).toBe("AI_ACTIVE");
    expect(finalDetail.conversation.ownerName).toBeNull();
    expect(finalDetail.messages.some((m: { body: string }) => m.body.includes("here's the update"))).toBe(true);

    const timeline = await app.inject({ method: "GET", url: `/patients/${target.patientId}/timeline`, cookies: { pulseos_session: coordinatorCookie } });
    const eventTypes = (timeline.json() as { eventType: string }[]).map((e) => e.eventType);
    expect(eventTypes).toContain("conversation_claimed");
    expect(eventTypes).toContain("conversation_returned_to_ai");
  });

  it("rejects claiming a conversation that does not exist", async () => {
    const res = await app.inject({ method: "PATCH", url: "/conversations/00000000-0000-0000-0000-000000000000/claim", cookies: { pulseos_session: coordinatorCookie } });
    expect(res.statusCode).toBe(404);
  });
});
