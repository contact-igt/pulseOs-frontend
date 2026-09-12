import { hash, verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { users, sessions, tenants, branches } from "../../db/schema.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  return verify(hashValue, plain);
}

export async function loginWithPassword(db: Db, email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return { ok: false as const, reason: "invalid_credentials" as const };

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) return { ok: false as const, reason: "invalid_credentials" as const };

  const [session] = await db
    .insert(sessions)
    .values({ userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
    .returning();

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
  const branch = user.branchId ? (await db.select().from(branches).where(eq(branches.id, user.branchId)).limit(1))[0] : undefined;

  return {
    ok: true as const,
    sessionId: session.id,
    expiresAt: session.expiresAt,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      tenantName: tenant?.name ?? "",
      branchId: user.branchId,
      branchName: branch?.name ?? null,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function resolveSession(db: Db, sessionId: string) {
  const [row] = await db
    .select({ session: sessions, user: users, branch: branches })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
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
  };
}

export async function revokeSession(db: Db, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
