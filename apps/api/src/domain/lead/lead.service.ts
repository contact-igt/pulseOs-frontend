import { and, eq, ne, or } from "drizzle-orm";
import { dayKeyIn } from "../../lib/hospital-time.js";
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
import { recordTouchpoint } from "../acquisition/attribution.service.js";
import { createTask } from "../task/task.service.js";
import { listFieldsForEntry, resolveSubmittedValues } from "../crm/crm-field.service.js";
import { pickOwnerForNewJourney } from "../crm/crm-allocation.service.js";
import type { OwnerFilter } from "../journey/journey.service.js";
import type { CreateLeadInput, CreateLeadResult, LeadPhoneLookupResult, LeadRow, LeadStatus, LeadsSummary, Role } from "@pulseos/types";

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

export type CreateLeadOutcome = CreateLeadResult | { validationError: true; missingRequiredFields: string[]; invalidFields: string[] };

export async function createLead(db: Db, tenantId: string, actorId: string, input: CreateLeadInput, actorRole: Role = "HOSPITAL_ADMIN"): Promise<CreateLeadOutcome> {
  // Required-field enforcement happens before any write — server-side, not
  // just the Add Lead form's `required` attribute, so an API call that
  // bypasses the UI can't silently skip data Settings marked mandatory.
  // The fields on this form are the ones configured for Add Lead in this service scope, not
  // archived, and visible to the person submitting. Values are validated by field type.
  const entryFields = await listFieldsForEntry(db, tenantId, actorRole, { placement: "add_lead", specialtyKey: input.specialtyKey });
  const submitted = resolveSubmittedValues(entryFields, input.customFieldValues);
  if (!submitted.ok) {
    return { validationError: true, missingRequiredFields: submitted.missing, invalidFields: submitted.invalid };
  }

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

  // Nobody chosen: the first matching allocation rule (Settings → Allocation Rules) picks the owner.
  const allocated = input.ownerId ? null : await pickOwnerForNewJourney(db, tenantId, { source: input.source, specialtyKey: input.specialtyKey, journeyType: input.journeyType, branchId: input.branchId });
  const [journey] = await db
    .insert(journeys)
    .values({
      tenantId,
      patientId,
      journeyType: input.journeyType,
      specialtyKey: input.specialtyKey,
      source: input.source,
      ownerUserId: input.ownerId ?? allocated?.userId ?? null,
      priority: input.priority ?? "normal",
      notes: input.notes ?? null,
    })
    .returning();

  if (allocated) {
    await db.insert(timelineEvents).values({
      tenantId, patientId, journeyId: journey.id, actorType: "system", eventType: "journey_auto_assigned",
      title: `Auto-assigned to ${allocated.userName}`, description: `Allocation rule: ${allocated.ruleName}`,
    });
  }

  if (input.campaignId) {
    // Journey-scoped attribution (first touch immutable, later touches
    // become last_touch, full history preserved) rather than always writing
    // first_touch — see acquisition/attribution.service.ts. A brand-new
    // Journey has no prior touchpoints, so this call is always the first
    // touch for it; the first/last distinction only becomes visible once a
    // second touch is recorded against the same still-open Journey (e.g. by
    // a future adapter's webhook, or a subsequent Add Lead call that
    // resolves to this Journey).
    await recordTouchpoint(db, {
      tenantId,
      patientId,
      journeyId: journey.id,
      details: { source: input.source, occurredAt: new Date() },
      campaignId: input.campaignId,
    });
  }

  for (const { field, value } of submitted.values) {
    await db.insert(customFieldValues).values({ tenantId, journeyId: journey.id, fieldDefinitionId: field.id, value });
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
  owner?: OwnerFilter;
}

async function buildLeadRows(db: Db, tenantId: string, timezone: string): Promise<LeadRow[]> {
  const today = dayKeyIn(new Date(), timezone);
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
      ownerId: journeys.ownerUserId,
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
      leadStatus = dayKeyIn(r.createdAt, timezone) === today ? "new" : "uncontacted";
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
      ownerId: r.ownerId,
      ownerName: r.ownerName,
      priority: r.priority,
      lastInteractionAt: (lastInteractionByJourney.get(r.id) ?? r.createdAt).toISOString(),
      nextActionDueAt: nextTaskByJourney.get(r.id)?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
    return row;
  });
}

export async function listLeads(db: Db, tenantId: string, filters: LeadFilters, timezone: string): Promise<LeadRow[]> {
  const rows = await buildLeadRows(db, tenantId, timezone);
  return rows
    .filter((r) => !filters.status || r.leadStatus === filters.status)
    .filter((r) => !filters.specialtyKey || r.specialtyKey === filters.specialtyKey)
    .filter((r) => !filters.source || r.source === filters.source)
    .filter((r) => !filters.owner || (filters.owner.kind === "unassigned" ? r.ownerId === null : r.ownerId === filters.owner.userId));
}

export async function getLeadsSummary(db: Db, tenantId: string, timezone: string): Promise<LeadsSummary> {
  const rows = await buildLeadRows(db, tenantId, timezone);
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
