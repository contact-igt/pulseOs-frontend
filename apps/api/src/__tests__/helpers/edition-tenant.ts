import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Edition, Role } from "@pulseos/types";
import type { Db } from "../../db/client.js";
import { branches, calls, connectorSecrets, connectors, patients, tenants, users, sessions } from "../../db/schema.js";
import { hashPassword } from "../../domain/auth/auth.service.js";
import { purgePatientData } from "./purge.js";

export interface TestTenant {
  tenantId: string;
  branchId: string;
  edition: Edition;
  /** session cookie by role */
  cookie: Partial<Record<Role, string>>;
  connectorId: string;
  patientId: string;
  callId: string;
  recordingUrl: string;
}

const ROLES: { role: Role; slug: string }[] = [
  { role: "SUPER_ADMIN", slug: "superadmin" },
  { role: "HOSPITAL_ADMIN", slug: "admin" },
  { role: "FRONT_DESK", slug: "frontdesk" },
  { role: "PATIENT_COORDINATOR", slug: "coordinator" },
  { role: "DOCTOR", slug: "doctor" },
];

/**
 * A throwaway tenant with one user per role, one telephony connector and one recorded call — isolated from the
 * seeded demo tenants so edition/permission tests can assert on exactly the data they created.
 */
export async function createTestTenant(db: Db, app: FastifyInstance, edition: Edition, password: string): Promise<TestTenant> {
  const tag = randomUUID().slice(0, 8);
  const [tenant] = await db.insert(tenants).values({ name: `Edition Test ${edition} ${tag}`, edition }).returning();
  const [branch] = await db.insert(branches).values({ tenantId: tenant.id, name: "Test Branch", city: "Bengaluru" }).returning();
  const passwordHash = await hashPassword(password);
  const cookie: TestTenant["cookie"] = {};
  for (const { role, slug } of ROLES) {
    const email = `${slug}.${tag}@edition-test.local`;
    await db.insert(users).values({ tenantId: tenant.id, branchId: branch.id, name: `${slug} ${tag}`, email, passwordHash, role });
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    cookie[role] = res.cookies.find((c) => c.name === "pulseos_session")!.value;
  }
  const [connector] = await db
    .insert(connectors)
    .values({ tenantId: tenant.id, type: "TELEPHONY", provider: "runo", displayName: "Test telephony", capabilities: ["RECEIVE_CALL_EVENT", "RECEIVE_RECORDING"], configuration: { accountRef: "test" } })
    .returning();
  const [patient] = await db.insert(patients).values({ tenantId: tenant.id, name: `Patient ${tag}`, phone: "+91 90000 00000", phoneE164: `+9190${Math.floor(10000000 + Math.random() * 89999999)}` }).returning();
  const recordingUrl = `https://recordings.example.test/${tag}.mp3`;
  const [call] = await db
    .insert(calls)
    .values({ tenantId: tenant.id, connectorId: connector.id, patientId: patient.id, externalCallId: `ext-${tag}`, direction: "inbound", phone: patient.phone, status: "completed", durationSeconds: 61, recordingUrl })
    .returning();
  return { tenantId: tenant.id, branchId: branch.id, edition, cookie, connectorId: connector.id, patientId: patient.id, callId: call.id, recordingUrl };
}

export async function destroyTestTenant(db: Db, t: TestTenant): Promise<void> {
  await db.delete(calls).where(eq(calls.tenantId, t.tenantId));
  await purgePatientData(db, [t.patientId]);
  await db.delete(connectorSecrets).where(eq(connectorSecrets.connectorId, t.connectorId));
  await db.delete(connectors).where(eq(connectors.tenantId, t.tenantId));
  const userRows = await db.select({ id: users.id }).from(users).where(eq(users.tenantId, t.tenantId));
  if (userRows.length) await db.delete(sessions).where(inArray(sessions.userId, userRows.map((u) => u.id)));
  await db.delete(users).where(eq(users.tenantId, t.tenantId));
  await db.delete(branches).where(eq(branches.tenantId, t.tenantId));
  await db.delete(tenants).where(eq(tenants.id, t.tenantId));
}
