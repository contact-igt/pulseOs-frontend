import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { queryClient } from "../db/client.js";
import type { FastifyInstance } from "fastify";
import type { JourneyListRow, SessionUser, TaskRow } from "@pulseos/types";

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

  it("aggregates task counts per view for the current session's own tasks in one efficient query, respecting tenant + assignment", async () => {
    const session = await app.inject({ method: "GET", url: "/auth/session", cookies: { pulseos_session: coordinatorCookie } });
    const { user } = session.json() as { user: SessionUser };

    const before = await app.inject({ method: "GET", url: "/tasks/counts", cookies: { pulseos_session: coordinatorCookie } });
    expect(before.statusCode).toBe(200);
    const beforeCounts = before.json() as { mine: number; overdue: number; today: number; upcoming: number; completed: number };

    const overdueDue = new Date(Date.now() - 2 * 86400000).toISOString();
    const todayDue = new Date(Date.now() + 3600000).toISOString();
    const upcomingDue = new Date(Date.now() + 5 * 86400000).toISOString();

    await app.inject({ method: "POST", url: "/tasks", cookies: { pulseos_session: coordinatorCookie }, payload: { patientId: somePatientId, journeyId: someJourneyId, type: "CALLBACK", dueAt: overdueDue, assignedTo: user.id } });
    await app.inject({ method: "POST", url: "/tasks", cookies: { pulseos_session: coordinatorCookie }, payload: { patientId: somePatientId, journeyId: someJourneyId, type: "CALLBACK", dueAt: todayDue, assignedTo: user.id } });
    await app.inject({ method: "POST", url: "/tasks", cookies: { pulseos_session: coordinatorCookie }, payload: { patientId: somePatientId, journeyId: someJourneyId, type: "CALLBACK", dueAt: upcomingDue, assignedTo: user.id } });
    const toComplete = await app.inject({ method: "POST", url: "/tasks", cookies: { pulseos_session: coordinatorCookie }, payload: { patientId: somePatientId, journeyId: someJourneyId, type: "CALLBACK", dueAt: upcomingDue, assignedTo: user.id } });
    await app.inject({ method: "PATCH", url: `/tasks/${(toComplete.json() as TaskRow).id}/complete`, cookies: { pulseos_session: coordinatorCookie } });

    const after = await app.inject({ method: "GET", url: "/tasks/counts", cookies: { pulseos_session: coordinatorCookie } });
    expect(after.statusCode).toBe(200);
    const afterCounts = after.json() as typeof beforeCounts;

    expect(afterCounts.mine).toBe(beforeCounts.mine + 4);
    expect(afterCounts.overdue).toBe(beforeCounts.overdue + 1);
    expect(afterCounts.today).toBe(beforeCounts.today + 1);
    expect(afterCounts.upcoming).toBe(beforeCounts.upcoming + 1);
    expect(afterCounts.completed).toBe(beforeCounts.completed + 1);
  });

  it("task counts are scoped to the caller's own assignment — a doctor's counts never include a coordinator's tasks", async () => {
    const coordinatorSession = await app.inject({ method: "GET", url: "/auth/session", cookies: { pulseos_session: coordinatorCookie } });
    const { user: coordinatorUser } = coordinatorSession.json() as { user: SessionUser };

    const before = await app.inject({ method: "GET", url: "/tasks/counts", cookies: { pulseos_session: doctorCookie } });
    const beforeCounts = before.json() as { mine: number };

    // Explicitly assigned to the coordinator, not the doctor — must not move the doctor's count.
    await app.inject({
      method: "POST",
      url: "/tasks",
      cookies: { pulseos_session: coordinatorCookie },
      payload: { patientId: somePatientId, journeyId: someJourneyId, type: "CALLBACK", dueAt: new Date(Date.now() + 86400000).toISOString(), assignedTo: coordinatorUser.id },
    });

    const after = await app.inject({ method: "GET", url: "/tasks/counts", cookies: { pulseos_session: doctorCookie } });
    const afterCounts = after.json() as { mine: number };
    expect(afterCounts.mine).toBe(beforeCounts.mine);
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
