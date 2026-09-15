import { and, desc, eq, ne } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { journeys, patients } from "../../db/schema.js";
import { normalizePhone, resolveDefaultPhoneRegion } from "../patient/phone.js";

// Conservative identity resolution shared by every inbound connector
// (WhatsApp, Runo, website forms, Meta/Google leads): normalizes the raw
// phone to canonical E.164 using the tenant's default region and matches on
// that — so "+91 98765 43210", "919876543210" and "09876543210" all resolve
// to the same Patient. When normalization fails (an invalid/unparseable
// number), there's no reliable canonical key, so the fallback is an exact
// match on the raw string — never a fuzzy match, never an automatic merge of
// two uncertain identities. "When identity is uncertain: store/match
// conservatively."
export async function findOrCreatePatientByPhone(db: Db, tenantId: string, phone: string, name: string | null) {
  const defaultRegion = await resolveDefaultPhoneRegion(db, tenantId);
  const normalized = normalizePhone(phone, defaultRegion);

  const [existing] = normalized.e164
    ? await db.select().from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.phoneE164, normalized.e164))).limit(1)
    : await db.select().from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.phone, phone))).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(patients)
    .values({ tenantId, phone, phoneE164: normalized.e164, phoneCountry: normalized.country, name: name ?? "Unknown caller" })
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
