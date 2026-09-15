import { and, eq, ne, or } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import {
  appointments,
  campaignTouchpoints,
  customFieldDefinitions,
  customFieldValues,
  journeys,
  marketingCampaigns,
  patients,
  specialtyTemplates,
  tasks,
  timelineEvents,
  treatmentOpportunities,
  users,
} from "../../db/schema.js";
import { normalizePhone, resolveDefaultPhoneRegion } from "../patient/phone.js";
import { resolveOrCreatePatient } from "../patient/identity.service.js";
import { createTask } from "../task/task.service.js";
import type { CreateLeadInput, CreateLeadResult, LeadPhoneLookupResult, LeadRow, LeadStatus, LeadsSummary } from "@pulseos/types";

export async function lookupPatientByPhone(db: Db, tenantId: string, rawPhone: string): Promise<LeadPhoneLookupResult> {
  const defaultRegion = await resolveDefaultPhoneRegion(db, tenantId);
  const normalized = normalizePhone(rawPhone, defaultRegion);
  if (!normalized.e164) return { patient: null };

  const [patient] = await db
    .select({ id: patients.id, name: patients.name, phone: patients.phone })
    .from(patients)
    .where(and(eq(patients.tenantId, tenantId), eq(patients.phoneE164, normalized.e164)))
    .limit(1);
  if (!patient) return { patient: null };

  const journeyRows = await db.select({ id: journeys.id }).from(journeys).where(and(eq(journeys.tenantId, tenantId), eq(journeys.patientId, patient.id), ne(journeys.stage, "lost")));
  return { patient: { id: patient.id, name: patient.name, phone: patient.phone, activeJourneyCount: journeyRows.length } };
}

export async function createLead(db: Db, tenantId: string, actorId: string, input: CreateLeadInput): Promise<CreateLeadResult> {
  // Canonical duplicate-prevention check: always resolve by phone through
  // the one shared identity path, never trust a client-supplied patientId
  // blindly — a stale hint must not create a duplicate identity, and a
  // match must not be ignored.
  const { patient, isNewPatient } = await resolveOrCreatePatient(db, {
    tenantId,
    phone: input.phone,
    name: input.name,
    email: input.email,
    preferredLanguage: input.preferredLanguage,
    branchId: input.branchId,
  });
  const patientId = patient.id;

  if (isNewPatient) {
    await db.insert(timelineEvents).values({
      tenantId,
      patientId,
      actorType: "user",
      actorId,
      eventType: "patient_created",
      title: "Patient created",
      sourceChannel: input.source,
    });
  }

  const [journey] = await db
    .insert(journeys)
    .values({
      tenantId,
      patientId,
      journeyType: input.journeyType,
      specialtyKey: input.specialtyKey,
      source: input.source,
      ownerUserId: input.ownerId ?? null,
      priority: input.priority ?? "normal",
      notes: input.notes ?? null,
    })
    .returning();

  if (input.campaignId) {
    await db.insert(campaignTouchpoints).values({
      tenantId,
      patientId,
      journeyId: journey.id,
      campaignId: input.campaignId,
      source: input.source,
      touchType: "first_touch",
      occurredAt: new Date(),
    });
  }

  if (input.customFieldValues) {
    const definitions = await db
      .select()
      .from(customFieldDefinitions)
      .where(and(eq(customFieldDefinitions.tenantId, tenantId), eq(customFieldDefinitions.specialtyKey, input.specialtyKey), eq(customFieldDefinitions.archived, false)));
    const defByKey = new Map(definitions.map((d) => [d.key, d]));

    for (const [key, value] of Object.entries(input.customFieldValues)) {
      const def = defByKey.get(key);
      if (!def || value === undefined || value === null || value === "") continue;
      await db.insert(customFieldValues).values({ tenantId, journeyId: journey.id, fieldDefinitionId: def.id, value });
    }
  }

  await db.insert(timelineEvents).values({
    tenantId,
    patientId,
    journeyId: journey.id,
    actorType: "user",
    actorId,
    eventType: "lead_created",
    title: `Lead created — ${input.journeyType}`,
    sourceChannel: input.source,
  });

  if (input.followUp) {
    await createTask(db, tenantId, actorId, {
      patientId,
      journeyId: journey.id,
      assignedTo: input.followUp.assignedTo ?? input.ownerId,
      type: input.followUp.type,
      dueAt: input.followUp.dueAt,
    });
  }

  return { patientId, journeyId: journey.id, isNewPatient };
}

// ---------------------------------------------------------------------------
// Leads workspace — a VIEW over journeys/patients/tasks/appointments, not a
// separate workflow-state system. leadStatus is derived from existing
// stage/contactedAt/task/appointment/treatment data, never stored.
// ---------------------------------------------------------------------------

export interface LeadFilters {
  status?: LeadStatus;
  specialtyKey?: string;
  source?: string;
  ownerId?: string;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

async function buildLeadRows(db: Db, tenantId: string): Promise<LeadRow[]> {
  const rows = await db
    .select({
      id: journeys.id,
      patientId: journeys.patientId,
      patientName: patients.name,
      phone: patients.phone,
      specialtyKey: journeys.specialtyKey,
      source: journeys.source,
      stage: journeys.stage,
      priority: journeys.priority,
      contactedAt: journeys.contactedAt,
      createdAt: journeys.createdAt,
      ownerName: users.name,
    })
    .from(journeys)
    .innerJoin(patients, eq(journeys.patientId, patients.id))
    .leftJoin(users, eq(journeys.ownerUserId, users.id))
    .where(eq(journeys.tenantId, tenantId));

  const specialties = await db.select({ key: specialtyTemplates.key, displayName: specialtyTemplates.displayName }).from(specialtyTemplates).where(eq(specialtyTemplates.tenantId, tenantId));
  const specialtyLabelByKey = new Map(specialties.map((s) => [s.key, s.displayName]));

  const campaignTouchpointRows = await db
    .select({ journeyId: campaignTouchpoints.journeyId, campaignId: campaignTouchpoints.campaignId })
    .from(campaignTouchpoints)
    .where(and(eq(campaignTouchpoints.tenantId, tenantId), eq(campaignTouchpoints.touchType, "first_touch")));
  const campaignByJourney = new Map(campaignTouchpointRows.map((c) => [c.journeyId, c.campaignId]));

  const campaignRows = await db.select({ id: marketingCampaigns.id, name: marketingCampaigns.name }).from(marketingCampaigns).where(eq(marketingCampaigns.tenantId, tenantId));
  const campaignNameById = new Map(campaignRows.map((c) => [c.id, c.name]));

  const apptRows = await db
    .select({ journeyId: appointments.journeyId, status: appointments.status })
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), ne(appointments.status, "cancelled"), ne(appointments.status, "no_show")));
  const journeysWithAppointment = new Set(apptRows.map((a) => a.journeyId));

  const treatmentRows = await db
    .select({ journeyId: treatmentOpportunities.journeyId, status: treatmentOpportunities.status })
    .from(treatmentOpportunities)
    .where(and(eq(treatmentOpportunities.tenantId, tenantId), or(eq(treatmentOpportunities.status, "ACCEPTED"), eq(treatmentOpportunities.status, "COMPLETED"))));
  const journeysConverted = new Set(treatmentRows.map((t) => t.journeyId));

  const pendingTaskRows = await db
    .select({ journeyId: tasks.journeyId, dueAt: tasks.dueAt })
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress"))));
  const nextTaskByJourney = new Map<string, Date>();
  for (const t of pendingTaskRows) {
    if (!t.journeyId) continue;
    const existing = nextTaskByJourney.get(t.journeyId);
    if (!existing || t.dueAt < existing) nextTaskByJourney.set(t.journeyId, t.dueAt);
  }

  const lastEventRows = await db.select({ journeyId: timelineEvents.journeyId, occurredAt: timelineEvents.occurredAt }).from(timelineEvents).where(eq(timelineEvents.tenantId, tenantId));
  const lastInteractionByJourney = new Map<string, Date>();
  for (const e of lastEventRows) {
    if (!e.journeyId) continue;
    const existing = lastInteractionByJourney.get(e.journeyId);
    if (!existing || e.occurredAt > existing) lastInteractionByJourney.set(e.journeyId, e.occurredAt);
  }

  return rows.map((r) => {
    let leadStatus: LeadStatus;
    if (r.stage === "lost") {
      leadStatus = "lost";
    } else if (journeysConverted.has(r.id) || r.stage === "completed") {
      leadStatus = "converted";
    } else if (journeysWithAppointment.has(r.id)) {
      leadStatus = "appointment_booked";
    } else if (!r.contactedAt) {
      leadStatus = isToday(r.createdAt) ? "new" : "uncontacted";
    } else if (nextTaskByJourney.has(r.id)) {
      leadStatus = "follow_up_due";
    } else {
      leadStatus = "no_response";
    }

    const campaignId = campaignByJourney.get(r.id) ?? null;

    const row: LeadRow = {
      id: r.id,
      patientId: r.patientId,
      patientName: r.patientName,
      phone: r.phone,
      specialtyKey: r.specialtyKey,
      specialtyLabel: r.specialtyKey ? (specialtyLabelByKey.get(r.specialtyKey) ?? r.specialtyKey) : null,
      source: r.source,
      campaignName: campaignId ? (campaignNameById.get(campaignId) ?? null) : null,
      stage: r.stage,
      leadStatus,
      ownerName: r.ownerName,
      priority: r.priority,
      lastInteractionAt: (lastInteractionByJourney.get(r.id) ?? r.createdAt).toISOString(),
      nextActionDueAt: nextTaskByJourney.get(r.id)?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
    return row;
  });
}

export async function listLeads(db: Db, tenantId: string, filters: LeadFilters): Promise<LeadRow[]> {
  const rows = await buildLeadRows(db, tenantId);
  return rows
    .filter((r) => !filters.status || r.leadStatus === filters.status)
    .filter((r) => !filters.specialtyKey || r.specialtyKey === filters.specialtyKey)
    .filter((r) => !filters.source || r.source === filters.source);
}

export async function getLeadsSummary(db: Db, tenantId: string): Promise<LeadsSummary> {
  const rows = await buildLeadRows(db, tenantId);
  const count = (status: LeadStatus) => rows.filter((r) => r.leadStatus === status).length;
  return {
    newToday: count("new"),
    uncontacted: count("uncontacted"),
    followUpsDue: count("follow_up_due"),
    appointmentsBooked: count("appointment_booked"),
    noResponse: count("no_response"),
    converted: count("converted"),
  };
}
