import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { PerformanceDashboard, Role } from "@pulseos/types";
import { buildApp } from "../app.js";
import { db, queryClient } from "../db/client.js";
import { appointments, calls, consultationOutcomes, customFieldValues, journeys, patients, tasks, treatmentOpportunities } from "../db/schema.js";
import { createTestTenant, destroyTestTenant, type TestTenant } from "./helpers/edition-tenant.js";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

// Namokar's follow-up sheet kept lead quality, call result, follow-up, appointment, visit and procedure in free text. PulseOS keeps
// each as a real record. These are SYNTHETIC cases of the patterns found there (never the sheet's names or numbers).
describe.skipIf(!DEMO_PASSWORD)("real-world Namokar lead patterns (integration)", () => {
  let app: FastifyInstance;
  let t: TestTenant;
  let n = 0;
  let slot = 0;
  let doctorId = "";

  const as = (role: Role, method: "GET" | "POST" | "PATCH", url: string, payload?: object) => app.inject({ method, url, cookies: { pulseos_session: t.cookie[role]! }, ...(payload ? { payload } : {}) });
  const phone = () => `+9199${String(10000000 + ++n * 61).padStart(8, "0")}`;
  const lead = async (over: object = {}) => {
    const res = await as("FRONT_DESK", "POST", "/leads", { phone: phone(), name: "QA Sheet", specialtyKey: "GENERAL_EYE_CONSULTATION", branchId: t.branchId, journeyType: "General Eye Consultation", sourceKey: "google", customFieldValues: {}, ...over });
    expect(res.statusCode, JSON.stringify(res.json())).toBe(201);
    return res.json() as { patientId: string; journeyId: string; isNewPatient: boolean };
  };
  const log = (journeyId: string, body: object, role: Role = "FRONT_DESK") => as(role, "POST", `/journeys/${journeyId}/interactions`, body);
  const perf = async () => (await as("SUPER_ADMIN", "GET", "/dashboard/performance?range=30d")).json() as PerformanceDashboard;
  const insight = (p: PerformanceDashboard, key: string) => p.insights.find((i) => i.key === key)?.count ?? 0;
  const inTwoDays = () => new Date(Date.now() + 2 * 86_400_000 + ++slot * 60_000).toISOString();
  const stageOf = async (journeyId: string) => (await db.select({ s: journeys.stage }).from(journeys).where(eq(journeys.id, journeyId)))[0]!.s;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    t = await createTestTenant(db, app, "BETA_V1_CORE", DEMO_PASSWORD!);
    await as("HOSPITAL_ADMIN", "POST", "/departments/install", { templateKey: "ophthalmology" });
    await as("HOSPITAL_ADMIN", "GET", "/crm/outcomes"); // installs the default outcomes
    expect((await as("HOSPITAL_ADMIN", "POST", "/crm/outcomes", { key: "junk_invalid", label: "Junk / invalid lead", stage: "lost", asksReason: true, invalid: true })).statusCode).toBe(201);
    expect((await as("HOSPITAL_ADMIN", "POST", "/lead-sources", { label: "Unknown / not recorded" })).statusCode).toBe(201);
    for (const f of [
      { key: "patient_type", label: "Patient type", fieldType: "SELECT", options: ["New Patient", "Existing Patient"] },
      { key: "clinic_uid", label: "Clinic UID", fieldType: "TEXT", filterable: true, rules: [{ when: { field: "patient_type", equals: ["Existing Patient"] }, then: "show" }] },
    ]) expect((await as("HOSPITAL_ADMIN", "POST", "/crm/fields", { specialtyKey: "*", placements: ["add_lead", "journey_detail"], ...f })).statusCode).toBe(201);
    const lk = (await as("FRONT_DESK", "GET", "/lookups")).json() as { doctors: { id: string }[] };
    doctorId = lk.doctors[0]!.id;
  });
  afterAll(async () => {
    await db.delete(customFieldValues).where(eq(customFieldValues.tenantId, t.tenantId));
    await db.update(calls).set({ callbackTaskId: null }).where(eq(calls.tenantId, t.tenantId));
    await db.delete(tasks).where(eq(tasks.tenantId, t.tenantId));
    await db.delete(treatmentOpportunities).where(eq(treatmentOpportunities.tenantId, t.tenantId));
    await db.delete(consultationOutcomes).where(eq(consultationOutcomes.tenantId, t.tenantId));
    await db.delete(appointments).where(eq(appointments.tenantId, t.tenantId));
    await destroyTestTenant(db, t);
    await app.close();
    await queryClient.end();
  });

  it("A. an accidental click is JUNK / invalid - closed as lost, counted apart from 'not interested', never a conversion", async () => {
    const a = await lead({ sourceKey: "instagram", name: "QA Junk" });
    expect((await log(a.journeyId, { outcomeKey: "junk_invalid", reason: "random click" })).statusCode).toBe(201);
    expect(await stageOf(a.journeyId)).toBe("lost");
    const p = await perf();
    expect(insight(p, "junk")).toBe(1);
    expect(insight(p, "lost")).toBe(0);
    expect(p.funnel.find((s) => s.key === "booked")!.count).toBe(0);
  });

  it("E. a real enquiry that later says no is NOT INTERESTED - lost, but never counted as junk", async () => {
    const e = await lead({ name: "QA Not Interested" });
    expect((await log(e.journeyId, { outcomeKey: "not_interested", reason: "chose another hospital" })).statusCode).toBe(201);
    expect(await stageOf(e.journeyId)).toBe("lost");
    const p = await perf();
    expect(insight(p, "lost")).toBe(1);
    expect(insight(p, "junk")).toBe(1); // still only case A
  });

  it("D. 'not responding' is a call outcome with a follow-up: a task for tomorrow in My Work, the service untouched", async () => {
    const d = await lead({ name: "QA No Answer" });
    const tomorrow = new Date(Date.now() + 26 * 3_600_000).toISOString();
    const res = await as("FRONT_DESK", "POST", `/journeys/${d.journeyId}/calls`, { direction: "outbound", connected: false, outcomeKey: "no_answer", callback: { dueAt: tomorrow, note: "try again" } });
    expect(res.statusCode).toBe(201);
    const mine = (await db.select().from(tasks).where(eq(tasks.journeyId, d.journeyId)))[0]!;
    expect(mine).toMatchObject({ status: "pending", type: "CALLBACK" });
    expect(Math.abs(mine.dueAt.getTime() - new Date(tomorrow).getTime())).toBeLessThan(60_000);
    const list = (await as("HOSPITAL_ADMIN", "GET", "/tasks?status=open")).json() as { rows?: { journeyId: string }[] } | { journeyId: string }[];
    const rows = Array.isArray(list) ? list : (list.rows ?? []);
    expect(rows.some((r) => r.journeyId === d.journeyId)).toBe(true);
    const j = (await db.select().from(journeys).where(eq(journeys.id, d.journeyId)))[0]!;
    expect(j.journeyType).toBe("General Eye Consultation"); // "Not responding" never corrupts the service
  });

  it("B. 'booked appointment' is a real, confirmed appointment (and the doctor's day shows it), not text", async () => {
    const b = await lead({ name: "QA Booked", sourceKey: "google" });
    const res = await as("FRONT_DESK", "POST", `/journeys/${b.journeyId}/calls`, { direction: "inbound", connected: true, staffFeedback: "wants a check-up", appointment: { scheduledAt: inTwoDays(), doctorId, branchId: t.branchId, confirmed: true } });
    expect(res.statusCode).toBe(201);
    const [a] = await db.select().from(appointments).where(eq(appointments.journeyId, b.journeyId));
    expect(a!.status).toBe("confirmed");
    const day = (await as("FRONT_DESK", "GET", `/appointments?journeyId=${b.journeyId}`)).json() as { id: string }[];
    expect(day.map((x) => x.id)).toContain(a!.id);
    expect((await perf()).funnel.find((s) => s.key === "booked")!.count).toBe(1);
  });

  it("G. a walk-in keeps its Walk-in source and follows the visit workflow: check in -> waiting -> doctor -> done", async () => {
    const g = await lead({ name: "QA Walk In", sourceKey: "walk_in", channel: "WALK_IN" });
    const booked = (await as("FRONT_DESK", "POST", "/appointments", { patientId: g.patientId, journeyId: g.journeyId, branchId: t.branchId, doctorId, scheduledAt: inTwoDays(), reason: "Consultation" })).json() as { id: string };
    expect((await as("FRONT_DESK", "PATCH", `/appointments/${booked.id}/action`, { action: "confirm" })).statusCode).toBe(200);
    expect((await as("FRONT_DESK", "PATCH", `/appointments/${booked.id}/action`, { action: "check_in", queue: true })).json()).toMatchObject({ status: "waiting" });
    expect((await as("FRONT_DESK", "PATCH", `/appointments/${booked.id}/action`, { action: "send_to_doctor" })).json()).toMatchObject({ status: "with_doctor" });
    expect((await as("DOCTOR", "PATCH", `/appointments/${booked.id}/complete`, { next: { kind: "none" } })).statusCode).toBe(200);
    const p = await perf();
    expect(p.sources.find((s) => s.label === "Walk-in")).toMatchObject({ enquiries: 1, attended: 1, consulted: 1 });
  });

  it("F. 'surgery booked' lives in Treatments: SCHEDULED counts as scheduled, never as done", async () => {
    const f = await lead({ name: "QA Surgery", sourceKey: "google" });
    const [appt] = await db.insert(appointments).values({ tenantId: t.tenantId, patientId: f.patientId, journeyId: f.journeyId, branchId: t.branchId, doctorUserId: t.userIds.DOCTOR!, scheduledAt: new Date(Date.now() - 3_600_000), status: "completed", checkedInAt: new Date(), completedAt: new Date() }).returning();
    const [outcome] = await db.insert(consultationOutcomes).values({ tenantId: t.tenantId, patientId: f.patientId, journeyId: f.journeyId, appointmentId: appt!.id, outcome: "TREATMENT_ADVISED", recordedBy: t.userIds.DOCTOR! }).returning();
    await db.insert(treatmentOpportunities).values({ tenantId: t.tenantId, patientId: f.patientId, journeyId: f.journeyId, consultationOutcomeId: outcome!.id, treatmentLabel: "Cataract Surgery", status: "SCHEDULED", estimatedValue: 0 });
    const p = await perf();
    expect(p.funnel.find((s) => s.key === "scheduled")!.count).toBe(1);
    expect(p.funnel.find((s) => s.key === "done")!.count).toBe(0);
  });

  it("C. an Existing patient with a UID is the SAME person with a NEW journey, found by UID", async () => {
    const p = phone();
    const first = await lead({ phone: p, name: "QA Existing", customFieldValues: { patient_type: "Existing Patient", clinic_uid: "QA-UID-100" } });
    const again = await lead({ phone: p, name: "QA Existing", journeyType: "Cataract (second enquiry)", customFieldValues: { patient_type: "Existing Patient", clinic_uid: "QA-UID-100" } });
    expect(again.patientId).toBe(first.patientId);
    expect(again.journeyId).not.toBe(first.journeyId);
    expect(again.isNewPatient).toBe(false);
    const found = (await as("FRONT_DESK", "GET", "/patients/search?q=QA-UID-100")).json() as { id: string }[];
    expect(found.map((r) => r.id)).toEqual([first.patientId]);
  });

  it("H. the same phone typed four ways is one person", async () => {
    const digits = "98765" + String(10000 + (n++ % 80000)).padStart(5, "0");
    const variants = [digits, `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`, `${digits.slice(0, 5)}-${digits.slice(5)}`, `0${digits}`];
    const ids = new Set<string>();
    for (const v of variants) ids.add((await lead({ phone: v, name: "QA Formatting" })).patientId);
    expect(ids.size).toBe(1);
    expect((await db.select().from(patients).where(eq(patients.id, [...ids][0]!)))[0]!.phoneE164).toBe(`+91${digits}`);
  });

  it("I. a lead whose source nobody knows says so - 'Unknown / not recorded' - and analytics show it", async () => {
    const sources = (await as("FRONT_DESK", "GET", "/lead-sources")).json() as { key: string; label: string }[];
    const unknown = sources.find((s) => s.label === "Unknown / not recorded")!;
    expect(unknown).toBeTruthy();
    await lead({ name: "QA Unknown Source", sourceKey: unknown.key });
    expect((await perf()).sources.map((s) => s.label)).toContain("Unknown / not recorded");
  });

  it("J. an unclear enquiry has a safe service: General Eye Consultation is offered", async () => {
    const services = (await as("FRONT_DESK", "GET", "/specialties")).json() as { key: string; displayName: string }[];
    expect(services.map((s) => s.displayName)).toContain("General Eye Consultation");
  });

  it("who logs a call (Performed by) is not who owns the journey (Assigned Team Member): a colleague's call never reassigns it", async () => {
    const own = await lead({ name: "QA Owner", ownerId: t.userIds.FRONT_DESK });
    const res = await as("PATIENT_COORDINATOR", "POST", `/journeys/${own.journeyId}/calls`, { direction: "outbound", connected: true, staffFeedback: "spoke to patient" });
    expect(res.statusCode).toBe(201);
    expect((await db.select().from(journeys).where(eq(journeys.id, own.journeyId)))[0]!.ownerUserId).toBe(t.userIds.FRONT_DESK);
    expect((await db.select().from(calls).where(eq(calls.journeyId, own.journeyId)))[0]!.loggedByUserId).toBe(t.userIds.PATIENT_COORDINATOR);
  });
});
