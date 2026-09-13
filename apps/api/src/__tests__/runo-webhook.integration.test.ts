import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { queryClient } from "../db/client.js";
import type { FastifyInstance } from "fastify";
import type { ConnectorRow } from "@pulseos/types";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const SHARED_SECRET = "pulseos-fixture-runo-secret";

function runoCallPayload(opts: { callId: string; phone: string; status?: string; disposition?: string | null; name?: string | null }) {
  return {
    call_id: opts.callId,
    phone_number: opts.phone,
    customer_name: opts.name ?? null,
    agent_name: "Test Agent",
    direction: "inbound",
    status: opts.status ?? "completed",
    duration_seconds: 120,
    recording_url: "https://fixture.example/recording.mp3",
    disposition: opts.disposition ?? null,
    started_at: new Date(Date.now() - 130_000).toISOString(),
    ended_at: new Date().toISOString(),
  };
}

async function loginAs(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: DEMO_PASSWORD } });
  return res.cookies.find((c) => c.name === "pulseos_session")!.value;
}

describe.skipIf(!DEMO_PASSWORD)("Runo webhook (integration, fixture mode)", () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let connectorId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    adminCookie = await loginAs(app, "admin@pulseos.local");
    const list = await app.inject({ method: "GET", url: "/connectors", cookies: { pulseos_session: adminCookie } });
    const runo = (list.json() as ConnectorRow[]).find((c) => c.provider === "runo");
    connectorId = runo!.id;
  });

  afterAll(async () => {
    await app.close();
    await queryClient.end();
  });

  it("rejects a call event with a missing/wrong x-api-key", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/webhooks/runo/${connectorId}`,
      payload: runoCallPayload({ callId: "call-noauth-1", phone: "919100000001" }),
      headers: { "x-api-key": "wrong-key" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts a correctly authenticated call, persists it, resolves a Patient, and writes a Timeline event", async () => {
    const phone = "919100000002";
    const res = await app.inject({
      method: "POST",
      url: `/webhooks/runo/${connectorId}`,
      payload: runoCallPayload({ callId: "call-fixture-1", phone, name: "Runo Fixture Caller" }),
      headers: { "x-api-key": SHARED_SECRET },
    });
    expect(res.statusCode).toBe(200);

    const patients = await app.inject({ method: "GET", url: `/patients?search=${encodeURIComponent("Runo Fixture Caller")}`, cookies: { pulseos_session: adminCookie } });
    const rows = patients.json() as { id: string; name: string }[];
    expect(rows.length).toBeGreaterThan(0);
    const patient = rows[0];

    const timeline = await app.inject({ method: "GET", url: `/patients/${patient.id}/timeline`, cookies: { pulseos_session: adminCookie } });
    const events = timeline.json() as { eventType: string }[];
    expect(events.some((e) => e.eventType === "call_logged")).toBe(true);
  });

  it("a duplicate delivery of the same call_id is idempotent — only one Timeline event is written", async () => {
    const phone = "919100000003";
    const payload = runoCallPayload({ callId: "call-fixture-dup", phone, name: "Runo Dup Caller" });

    const first = await app.inject({ method: "POST", url: `/webhooks/runo/${connectorId}`, payload, headers: { "x-api-key": SHARED_SECRET } });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: "POST", url: `/webhooks/runo/${connectorId}`, payload, headers: { "x-api-key": SHARED_SECRET } });
    expect(second.statusCode).toBe(200);

    const patients = await app.inject({ method: "GET", url: `/patients?search=${encodeURIComponent("Runo Dup Caller")}`, cookies: { pulseos_session: adminCookie } });
    const patient = (patients.json() as { id: string }[])[0];
    const timeline = await app.inject({ method: "GET", url: `/patients/${patient.id}/timeline`, cookies: { pulseos_session: adminCookie } });
    const callEvents = (timeline.json() as { eventType: string }[]).filter((e) => e.eventType === "call_logged");
    expect(callEvents.length).toBe(1);
  });

  it("a CALL_BACK_LATER disposition creates a CALLBACK task (deterministic disposition mapping)", async () => {
    const phone = "919100000004";
    const res = await app.inject({
      method: "POST",
      url: `/webhooks/runo/${connectorId}`,
      payload: runoCallPayload({ callId: "call-fixture-cb", phone, name: "Runo Callback Caller", disposition: "CALL_BACK_LATER" }),
      headers: { "x-api-key": SHARED_SECRET },
    });
    expect(res.statusCode).toBe(200);

    const patients = await app.inject({ method: "GET", url: `/patients?search=${encodeURIComponent("Runo Callback Caller")}`, cookies: { pulseos_session: adminCookie } });
    const patient = (patients.json() as { id: string }[])[0];

    const tasks = await app.inject({ method: "GET", url: `/tasks?patientId=${patient.id}`, cookies: { pulseos_session: adminCookie } });
    const taskRows = tasks.json() as { type: string }[];
    expect(taskRows.some((t) => t.type === "CALLBACK")).toBe(true);
  });
});
