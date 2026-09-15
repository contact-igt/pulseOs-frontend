import { and, desc, eq, ilike, or } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import {
  appointments,
  branches,
  campaignTouchpoints,
  journeys,
  marketingCampaigns,
  patients,
  revenueEvents,
  tasks,
  timelineEvents,
  treatmentOpportunities,
  users,
} from "../../db/schema.js";
import { allocatedAcquisitionCost } from "../marketing/formulas.js";
import { normalizePhone, resolveDefaultPhoneRegion } from "./phone.js";
import type { CreatePatientInput, CreatePatientResult, JourneyCardVm, Patient360, PatientListRow } from "@pulseos/types";

/**
 * Identity-first creation — no Journey, no source/specialty context. For
 * importing/registering an existing hospital patient directly, as distinct
 * from Add Lead (acquisition-first, always creates a Journey). Resolves by
 * phone the same way Add Lead does: never creates a duplicate identity.
 */
export async function createPatient(db: Db, tenantId: string, actorId: string, input: CreatePatientInput): Promise<CreatePatientResult> {
  const defaultRegion = await resolveDefaultPhoneRegion(db, tenantId);
  const normalized = normalizePhone(input.phone, defaultRegion);

  // When normalization fails (an invalid/unparseable number) there is no
  // reliable canonical key, so the fallback is an exact match on the raw
  // string — never a fuzzy match, never an automatic merge of two
  // uncertain identities.
  const [existing] = normalized.e164
    ? await db.select({ id: patients.id }).from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.phoneE164, normalized.e164))).limit(1)
    : await db.select({ id: patients.id }).from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.phone, input.phone))).limit(1);
  if (existing) {
    return { patientId: existing.id, isNewPatient: false };
  }

  const [created] = await db
    .insert(patients)
    .values({
      tenantId,
      name: input.name,
      phone: input.phone,
      phoneE164: normalized.e164,
      phoneCountry: normalized.country,
      email: input.email ?? null,
      preferredLanguage: input.preferredLanguage ?? "English",
      branchId: input.branchId,
    })
    .returning();

  await db.insert(timelineEvents).values({
    tenantId,
    patientId: created.id,
    actorType: "user",
    actorId,
    eventType: "patient_created",
    title: "Patient created",
  });

  return { patientId: created.id, isNewPatient: true };
}

export interface PatientListFilters {
  search?: string;
  branchId?: string;
  source?: string;
  stage?: string;
  ownerId?: string;
}

export async function listPatients(db: Db, tenantId: string, filters: PatientListFilters): Promise<PatientListRow[]> {
  const patientRows = await db
    .select({
      id: patients.id,
      name: patients.name,
      phone: patients.phone,
      branchName: branches.name,
    })
    .from(patients)
    .leftJoin(branches, eq(patients.branchId, branches.id))
    .where(
      and(
        eq(patients.tenantId, tenantId),
        filters.branchId ? eq(patients.branchId, filters.branchId) : undefined,
        filters.search ? or(ilike(patients.name, `%${filters.search}%`), ilike(patients.phone, `%${filters.search}%`)) : undefined,
      ),
    )
    .orderBy(patients.name);

  const journeyRows = await db
    .select({
      patientId: journeys.patientId,
      id: journeys.id,
      journeyType: journeys.journeyType,
      stage: journeys.stage,
      source: journeys.source,
      ownerUserId: journeys.ownerUserId,
      ownerName: users.name,
      createdAt: journeys.createdAt,
    })
    .from(journeys)
    .leftJoin(users, eq(journeys.ownerUserId, users.id))
    .where(eq(journeys.tenantId, tenantId));

  const taskRows = await db
    .select({ patientId: tasks.patientId, dueAt: tasks.dueAt })
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending")));

  const timelineRows = await db
    .select({ patientId: timelineEvents.patientId, occurredAt: timelineEvents.occurredAt })
    .from(timelineEvents)
    .where(eq(timelineEvents.tenantId, tenantId));

  const apptRows = await db
    .select({ patientId: appointments.patientId, status: appointments.status, scheduledAt: appointments.scheduledAt })
    .from(appointments)
    .where(eq(appointments.tenantId, tenantId));

  const journeysByPatient = new Map<string, typeof journeyRows>();
  for (const j of journeyRows) {
    const list = journeysByPatient.get(j.patientId) ?? [];
    list.push(j);
    journeysByPatient.set(j.patientId, list);
  }

  const nextActionByPatient = new Map<string, Date>();
  for (const t of taskRows) {
    const existing = nextActionByPatient.get(t.patientId);
    if (!existing || t.dueAt < existing) nextActionByPatient.set(t.patientId, t.dueAt);
  }

  const lastInteractionByPatient = new Map<string, Date>();
  for (const t of timelineRows) {
    const existing = lastInteractionByPatient.get(t.patientId);
    if (!existing || t.occurredAt > existing) lastInteractionByPatient.set(t.patientId, t.occurredAt);
  }

  const latestApptByPatient = new Map<string, { status: string; scheduledAt: Date }>();
  for (const a of apptRows) {
    const existing = latestApptByPatient.get(a.patientId);
    if (!existing || a.scheduledAt > existing.scheduledAt) latestApptByPatient.set(a.patientId, a);
  }

  const rows = patientRows.map((p) => {
    const patientJourneys = (journeysByPatient.get(p.id) ?? []).filter((j) => j.stage !== "lost");
    const current = [...patientJourneys].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const nextAction = nextActionByPatient.get(p.id);
    const lastInteraction = lastInteractionByPatient.get(p.id);
    const latestAppt = latestApptByPatient.get(p.id);

    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      branchName: p.branchName,
      activeJourneyCount: patientJourneys.length,
      currentJourneyType: current?.journeyType ?? null,
      currentStage: current?.stage ?? null,
      source: current?.source ?? null,
      lastInteractionAt: lastInteraction ? lastInteraction.toISOString() : null,
      nextActionDueAt: nextAction ? nextAction.toISOString() : null,
      ownerName: current?.ownerName ?? null,
      ownerUserId: current?.ownerUserId ?? null,
      appointmentStatus: latestAppt?.status ?? null,
    };
  });

  return rows
    .filter((r) => {
      if (filters.source && r.source !== filters.source) return false;
      if (filters.stage && r.currentStage !== filters.stage) return false;
      if (filters.ownerId && r.ownerUserId !== filters.ownerId) return false;
      return true;
    })
    .map(({ ownerUserId: _ownerUserId, ...rest }) => rest);
}

export async function getPatient360(db: Db, tenantId: string, patientId: string): Promise<Patient360 | null> {
  const [patient] = await db
    .select({ id: patients.id, name: patients.name, phone: patients.phone, preferredLanguage: patients.preferredLanguage, branchName: branches.name })
    .from(patients)
    .leftJoin(branches, eq(patients.branchId, branches.id))
    .where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)))
    .limit(1);
  if (!patient) return null;

  const journeyRows = await db
    .select({
      id: journeys.id, journeyType: journeys.journeyType, stage: journeys.stage, source: journeys.source,
      ownerName: users.name, createdAt: journeys.createdAt,
    })
    .from(journeys)
    .leftJoin(users, eq(journeys.ownerUserId, users.id))
    .where(and(eq(journeys.tenantId, tenantId), eq(journeys.patientId, patientId)))
    .orderBy(desc(journeys.createdAt));

  const journeyCards: JourneyCardVm[] = [];
  for (const j of journeyRows) {
    const [nextTask] = await db
      .select({ dueAt: tasks.dueAt })
      .from(tasks)
      .where(and(eq(tasks.journeyId, j.id), eq(tasks.status, "pending")))
      .orderBy(tasks.dueAt)
      .limit(1);

    const [appt] = await db
      .select({ scheduledAt: appointments.scheduledAt, status: appointments.status, doctorName: users.name })
      .from(appointments)
      .leftJoin(users, eq(appointments.doctorUserId, users.id))
      .where(eq(appointments.journeyId, j.id))
      .orderBy(desc(appointments.scheduledAt))
      .limit(1);

    const [treatment] = await db
      .select({ status: treatmentOpportunities.status, label: treatmentOpportunities.treatmentLabel })
      .from(treatmentOpportunities)
      .where(eq(treatmentOpportunities.journeyId, j.id))
      .orderBy(desc(treatmentOpportunities.createdAt))
      .limit(1);

    const [lastEvent] = await db
      .select({ occurredAt: timelineEvents.occurredAt })
      .from(timelineEvents)
      .where(eq(timelineEvents.journeyId, j.id))
      .orderBy(desc(timelineEvents.occurredAt))
      .limit(1);

    journeyCards.push({
      id: j.id,
      journeyType: j.journeyType,
      stage: j.stage,
      source: j.source,
      ownerName: j.ownerName,
      nextActionDueAt: nextTask ? nextTask.dueAt.toISOString() : null,
      appointmentTime: appt ? appt.scheduledAt.toISOString() : null,
      appointmentStatus: appt?.status ?? null,
      doctorName: appt?.doctorName ?? null,
      treatmentStatus: treatment?.status ?? null,
      treatmentLabel: treatment?.label ?? null,
      lastInteractionAt: lastEvent ? lastEvent.occurredAt.toISOString() : null,
    });
  }

  // Acquisition context: first-touch campaign on the patient's most recent journey.
  const primaryJourneyId = journeyRows[0]?.id;
  let acquisition: Patient360["acquisition"] = {
    source: journeyRows[0]?.source ?? null,
    campaignName: null,
    firstTouchAt: null,
    allocatedAcquisitionCost: null,
    estimatedTreatmentValue: 0,
    attributedRevenue: 0,
  };

  if (primaryJourneyId) {
    const [touchpoint] = await db
      .select({ occurredAt: campaignTouchpoints.occurredAt, campaignId: campaignTouchpoints.campaignId, source: campaignTouchpoints.source })
      .from(campaignTouchpoints)
      .where(and(eq(campaignTouchpoints.journeyId, primaryJourneyId), eq(campaignTouchpoints.touchType, "first_touch")))
      .limit(1);

    let allocatedCost: number | null = null;
    let campaignName: string | null = null;
    if (touchpoint?.campaignId) {
      const [campaign] = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, touchpoint.campaignId)).limit(1);
      if (campaign) {
        campaignName = campaign.name;
        const campaignTouchpointRows = await db
          .select({ id: campaignTouchpoints.id })
          .from(campaignTouchpoints)
          .where(eq(campaignTouchpoints.campaignId, campaign.id));
        allocatedCost = allocatedAcquisitionCost(campaign.spendAmount, campaignTouchpointRows.length);
      }
    }

    const treatmentRows = await db
      .select({ estimatedValue: treatmentOpportunities.estimatedValue })
      .from(treatmentOpportunities)
      .where(eq(treatmentOpportunities.patientId, patientId));
    const estimatedTreatmentValue = treatmentRows.reduce((sum, t) => sum + t.estimatedValue, 0);

    const revenueRows = await db.select({ amount: revenueEvents.amount }).from(revenueEvents).where(eq(revenueEvents.patientId, patientId));
    const attributedRevenue = revenueRows.reduce((sum, r) => sum + r.amount, 0);

    acquisition = {
      source: touchpoint?.source ?? journeyRows[0]?.source ?? null,
      campaignName,
      firstTouchAt: touchpoint ? touchpoint.occurredAt.toISOString() : null,
      allocatedAcquisitionCost: allocatedCost,
      estimatedTreatmentValue,
      attributedRevenue,
    };
  }

  return {
    patient: { id: patient.id, name: patient.name, phone: patient.phone, preferredLanguage: patient.preferredLanguage, branchName: patient.branchName },
    journeys: journeyCards,
    acquisition,
  };
}
