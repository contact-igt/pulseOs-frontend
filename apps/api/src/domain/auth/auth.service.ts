import { resolveTenantCapabilities } from "../capability/capability.service.js";
import { hash, verify } from "@node-rs/argon2";
import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { users, sessions, tenants, branches } from "../../db/schema.js";
import { DEFAULT_EDITION, type Role } from "@pulseos/types";
import { DEFAULT_DEMO_ENVIRONMENT, DEMO_ENVIRONMENTS, demoEmailForRole, type DemoEnvironmentKey } from "./demo-environments.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
/** "Remember me": stay signed in on this device for a week. Without it the session ends after 12 hours or when the browser closes. */
export const REMEMBER_TTL_MS = 1000 * 60 * 60 * 24 * 7;
// Session ids are uuids. Anything else in the cookie (tampered, truncated, set by a
// sibling domain) is simply "no session" — never a database error that would
// 500 every request, including the login and logout that would clear it.
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  return verify(hashValue, plain);
}

// Shared by password login and Dev Login — the only difference between them
// is how the target user is found (email+password vs. role lookup); once a
// `users` row is settled on, session creation is identical, so both go
// through one path rather than a parallel/weaker one for Dev Login.
async function createSessionFor(db: Db, user: typeof users.$inferSelect, remember = false) {
  const [session] = await db
    .insert(sessions)
    .values({ userId: user.id, expiresAt: new Date(Date.now() + (remember ? REMEMBER_TTL_MS : SESSION_TTL_MS)) })
    .returning();

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
  const branch = user.branchId ? (await db.select().from(branches).where(eq(branches.id, user.branchId)).limit(1))[0] : undefined;
  const capabilities = await resolveTenantCapabilities(db, user.tenantId, tenant?.edition ?? DEFAULT_EDITION);

  return {
    ok: true as const,
    remember,
    sessionId: session.id,
    expiresAt: session.expiresAt,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      tenantName: tenant?.name ?? "",
      timezone: tenant?.timezone ?? "Asia/Kolkata",
      edition: tenant?.edition ?? DEFAULT_EDITION,
      capabilities,
      branchId: user.branchId,
      branchName: branch?.name ?? null,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

// An unknown account still costs one password verification, so the response time does not reveal whether an email exists.
let decoyHash: Promise<string> | null = null;

export async function loginWithPassword(db: Db, email: string, password: string, remember = false) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    decoyHash ??= hashPassword("decoy-password-never-matches");
    await verifyPassword(await decoyHash, password);
    return { ok: false as const, reason: "invalid_credentials" as const };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) return { ok: false as const, reason: "invalid_credentials" as const };

  return createSessionFor(db, user, remember);
}

// Development convenience only — see auth.routes.ts for the env guard that
// decides whether this is even reachable. No password check: it exists
// specifically to skip typing one, for a fixed, non-secret set of seeded
// demo accounts, never a real credential.
export async function loginByRole(db: Db, role: Role, environment: DemoEnvironmentKey = DEFAULT_DEMO_ENVIRONMENT) {
  // Resolved to the environment's own seeded user: email AND tenant must both
  // match. Email alone is only unique per tenant, and "first user with this
  // role" would pick a user from an arbitrary tenant.
  const email = demoEmailForRole(environment, role);
  const tenantName = DEMO_ENVIRONMENTS.find((e) => e.key === environment)?.tenantName;
  if (!email || !tenantName) return { ok: false as const, reason: "no_seeded_user_for_role" as const };
  const [row] = await db
    .select({ user: users })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .where(and(eq(users.email, email), eq(tenants.name, tenantName)))
    .limit(1);
  const user = row?.user;
  if (!user) return { ok: false as const, reason: "no_seeded_user_for_role" as const };
  return createSessionFor(db, user);
}

export async function resolveSession(db: Db, sessionId: string) {
  if (!SESSION_ID.test(sessionId)) return null;
  const [row] = await db
    .select({ session: sessions, user: users, branch: branches, timezone: tenants.timezone, edition: tenants.edition })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .leftJoin(branches, eq(users.branchId, branches.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) return null;

  return {
    id: row.user.id,
    tenantId: row.user.tenantId,
    branchId: row.user.branchId,
    branchName: row.branch?.name ?? null,
    name: row.user.name,
    email: row.user.email,
    role: row.user.role,
    timezone: row.timezone,
    edition: row.edition,
    // Resolved on every request: a Super Admin's switch takes effect immediately, in the API and in the next UI refresh.
    capabilities: await resolveTenantCapabilities(db, row.user.tenantId, row.edition),
  };
}

export async function revokeSession(db: Db, sessionId: string) {
  if (!SESSION_ID.test(sessionId)) return;
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
