import type { FastifyInstance } from "fastify";
import { and, eq, or } from "drizzle-orm";
import { branches, users } from "../../db/schema.js";

export async function lookupRoutes(app: FastifyInstance) {
  app.get("/lookups", async (request) => {
    const tenantId = request.sessionUser!.tenantId;

    const [branchRows, doctorRows, ownerRows] = await Promise.all([
      app.db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.tenantId, tenantId)),
      app.db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.tenantId, tenantId), eq(users.role, "DOCTOR"))),
      app.db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), or(eq(users.role, "FRONT_DESK"), eq(users.role, "PATIENT_COORDINATOR")))),
    ]);

    return { branches: branchRows, doctors: doctorRows, owners: ownerRows };
  });
}
