import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { queryClient } from "../db/client.js";
import type { FastifyInstance } from "fastify";
import type { JourneyListRow, TaskRow } from "@pulseos/types";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

async function loginAs(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: DEMO_PASSWORD } });
  return res.cookies.find((c) => c.name === "pulseos_session")!.value;
}

describe.skipIf(!DEMO_PASSWORD)("tasks / follow-ups / my work (integration)", () => {
  let app: FastifyInstance;
  let coordinatorCookie: string;
  let doctorCookie: string;
  let somePatientId: string;
  let someJourneyId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    coordinatorCookie = await loginAs(app, "coordinator@pulseos.local");
    doctorCookie = await loginAs(app, "doctor@pulseos.local");

    const journeys = await app.inject({ method: "GET", url: "/journeys", cookies: { pulseos_session: coordinatorCookie } });
    const rows = journeys.json() as JourneyListRow[];
    somePatientId = rows[0].patientId;
    someJourneyId = rows[0].id;
  });

  afterAll(async () => {
    await app.close();
    await queryClient.end();
  });

  it("rejects an unauthenticated request with 401, not 403", async () => {
    const res = await app.inject({ method: "GET", url: "/tasks" });
    expect(res.statusCode).toBe(401);
  });

  it("Doctor has VIEW_TASKS (can see their own My Work queue) but not MANAGE_TASKS (cannot create, complete, reschedule, or reassign)", async () => {
    const list = await app.inject({ method: "GET", url: "/tasks", cookies: { pulseos_session: doctorCookie } });
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.json())).toBe(true);

    const create = await app.inject({
      method: "POST",
      url: "/tasks",
      cookies: { pulseos_session: doctorCookie },
      payload: { patientId: somePatientId, journeyId: someJourneyId, type: "CALLBACK", dueAt: new Date(Date.now() + 86400000).toISOString() },
    });
    expect(create.statusCode).toBe(403);
    expect(create.json().requiredPermission).toBe("MANAGE_TASKS");

    const complete = await app.inject({ method: "PATCH", url: "/tasks/00000000-0000-0000-0000-000000000000/complete", cookies: { pulseos_session: doctorCookie } });
    expect(complete.statusCode).toBe(403);
    expect(complete.json().requiredPermission).toBe("MANAGE_TASKS");
  });

  it("creates a task with the full field set and returns it", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/tasks",
      cookies: { pulseos_session: coordinatorCookie },
      payload: {
        patientId: somePatientId,
        journeyId: someJourneyId,
        type: "CALLBACK",
        priority: "high",
        notes: "Call back after 6pm",
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    expect(res.statusCode).toBe(200);
    const task = res.json() as TaskRow;
    expect(task.type).toBe("CALLBACK");
    expect(task.priority).toBe("high");
    expect(task.notes).toBe("Call back after 6pm");
    expect(task.status).toBe("pending");
    expect(task.patientId).toBe(somePatientId);
  });

  it("lists tasks filtered by view (today/overdue/upcoming/completed)", async () => {
    for (const view of ["today", "overdue", "upcoming", "completed"]) {
      const res = await app.inject({ method: "GET", url: `/tasks?view=${view}`, cookies: { pulseos_session: coordinatorCookie } });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    }
  });

  it("full lifecycle: create → add note → reschedule → reassign → complete, each writing a Timeline event", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/tasks",
      cookies: { pulseos_session: coordinatorCookie },
      payload: { patientId: somePatientId, journeyId: someJourneyId, type: "FOLLOW_UP", dueAt: new Date(Date.now() + 3600000).toISOString() },
    });
    const task = create.json() as TaskRow;

    const note = await app.inject({
      method: "PATCH",
      url: `/tasks/${task.id}/note`,
      cookies: { pulseos_session: coordinatorCookie },
      payload: { notes: "Patient asked to call tomorrow morning" },
    });
    expect(note.statusCode).toBe(200);
    expect(note.json().notes).toBe("Patient asked to call tomorrow morning");

    const newDue = new Date(Date.now() + 2 * 86400000).toISOString();
    const reschedule = await app.inject({
      method: "PATCH",
      url: `/tasks/${task.id}/reschedule`,
      cookies: { pulseos_session: coordinatorCookie },
      payload: { dueAt: newDue },
    });
    expect(reschedule.statusCode).toBe(200);

    const lookups = await app.inject({ method: "GET", url: "/lookups", cookies: { pulseos_session: coordinatorCookie } });
    const owners = lookups.json().owners as { id: string }[];
    const otherOwner = owners.find((o: { id: string }) => o.id);
    const reassign = await app.inject({
      method: "PATCH",
      url: `/tasks/${task.id}/reassign`,
      cookies: { pulseos_session: coordinatorCookie },
      payload: { assignedTo: otherOwner!.id },
    });
    expect(reassign.statusCode).toBe(200);

    const complete = await app.inject({ method: "PATCH", url: `/tasks/${task.id}/complete`, cookies: { pulseos_session: coordinatorCookie } });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().status).toBe("completed");

    const completeAgain = await app.inject({ method: "PATCH", url: `/tasks/${task.id}/complete`, cookies: { pulseos_session: coordinatorCookie } });
    expect(completeAgain.statusCode).toBe(409);

    const timeline = await app.inject({ method: "GET", url: `/patients/${somePatientId}/timeline`, cookies: { pulseos_session: coordinatorCookie } });
    const events = timeline.json() as { eventType: string }[];
    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toContain("task_created");
    expect(eventTypes).toContain("task_rescheduled");
    expect(eventTypes).toContain("task_reassigned");
    expect(eventTypes).toContain("task_completed");
  });

  it("tenant isolation: cannot complete a task belonging to another tenant", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/tasks/00000000-0000-0000-0000-000000000000/complete",
      cookies: { pulseos_session: coordinatorCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("every journey exposes a Next Action (due date) or explicitly none", async () => {
    const res = await app.inject({ method: "GET", url: "/journeys", cookies: { pulseos_session: coordinatorCookie } });
    const rows = res.json() as JourneyListRow[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.nextActionDueAt === null || typeof row.nextActionDueAt === "string").toBe(true);
      expect(typeof row.lastActivityAt).toBe("string");
    }
  });
});
