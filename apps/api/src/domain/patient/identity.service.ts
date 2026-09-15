import { and, desc, eq, ne } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { journeys, patients } from "../../db/schema.js";
import { normalizePhone, resolveDefaultPhoneRegion } from "./phone.js";

export interface ResolveOrCreatePatientInput {
  tenantId: string;
  phone: string;
  name: string;
  email?: string | null;
  preferredLanguage?: string;
  branchId?: string | null;
}

export interface ResolveOrCreatePatientResult {
  patient: typeof patients.$inferSelect;
  isNewPatient: boolean;
}

/**
 * The ONE identity resolution path every entry point converges onto — manual
 * Add Patient, manual Add Lead, WhatsApp/Runo webhook identity resolution,
 * and (once ported) Website/Meta/Google Ads lead ingestion. Normalizes the
 * raw phone to canonical E.164 using the tenant's default region and
 * matches on that — so "+91 98765 43210", "919876543210" and "09876543210"
 * all resolve to the same Patient regardless of which source captured them.
 * When normalization fails (an invalid/unparseable number), there is no
 * reliable canonical key, so the fallback is an exact match on the raw
 * string — never a fuzzy match, never an automatic merge of two uncertain
 * identities. "When identity is uncertain: store/match conservatively."
 *
 * Callers own their own post-creation side effects (Timeline events differ
 * by source, Journey creation only happens for acquisition-first flows) —
 * this function only ever touches the Patient row itself.
 */
export async function resolveOrCreatePatient(db: Db, input: ResolveOrCreatePatientInput): Promise<ResolveOrCreatePatientResult> {
  const defaultRegion = await resolveDefaultPhoneRegion(db, input.tenantId);
  const normalized = normalizePhone(input.phone, defaultRegion);

  const [existing] = normalized.e164
    ? await db.select().from(patients).where(and(eq(patients.tenantId, input.tenantId), eq(patients.phoneE164, normalized.e164))).limit(1)
    : await db.select().from(patients).where(and(eq(patients.tenantId, input.tenantId), eq(patients.phone, input.phone))).limit(1);
  if (existing) return { patient: existing, isNewPatient: false };

  const [created] = await db
    .insert(patients)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      phone: input.phone,
      phoneE164: normalized.e164,
      phoneCountry: normalized.country,
      email: input.email ?? null,
      preferredLanguage: input.preferredLanguage ?? "English",
      branchId: input.branchId ?? null,
    })
    .returning();
  return { patient: created, isNewPatient: true };
}

/**
 * Thin compatibility wrapper for the inbound-connector call sites
 * (WhatsApp/Runo webhooks), which only ever have a phone + display name and
 * want the bare Patient row back, not the richer isNewPatient result.
 */
export async function findOrCreatePatientByPhone(db: Db, tenantId: string, phone: string, name: string | null) {
  const { patient } = await resolveOrCreatePatient(db, { tenantId, phone, name: name ?? "Unknown caller" });
  return patient;
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
