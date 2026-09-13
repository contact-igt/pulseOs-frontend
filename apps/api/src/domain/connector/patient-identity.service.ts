import { and, desc, eq, ne } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { journeys, patients } from "../../db/schema.js";

// Conservative identity resolution shared by every inbound connector
// (WhatsApp, Runo): exact phone match within the tenant only. A hospital
// wants every inbound contact captured, so a genuinely new number creates a
// new Patient — but nothing here ever fuzzy-matches or merges, since a wrong
// match would attach a stranger's conversation or call to someone else's
// record. "When identity is uncertain: store/match conservatively."
export async function findOrCreatePatientByPhone(db: Db, tenantId: string, phone: string, name: string | null) {
  const [existing] = await db.select().from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.phone, phone))).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(patients)
    .values({ tenantId, phone, name: name ?? "Unknown caller" })
    .returning();
  return created;
}

// "Resolve Journey where possible" — the patient's most recently created
// journey that hasn't already reached a terminal stage. No journey is
// created here; a call/message never fabricates a journey on its own.
export async function findMostRecentActiveJourney(db: Db, tenantId: string, patientId: string) {
  const [journey] = await db
    .select()
    .from(journeys)
    .where(and(eq(journeys.tenantId, tenantId), eq(journeys.patientId, patientId), ne(journeys.stage, "completed"), ne(journeys.stage, "lost")))
    .orderBy(desc(journeys.createdAt))
    .limit(1);
  return journey ?? null;
}
