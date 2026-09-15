import type { Db } from "../../db/client.js";
import { journeys, tasks, timelineEvents } from "../../db/schema.js";
import { findMostRecentActiveJourney, resolveOrCreatePatient } from "../patient/identity.service.js";
import { recordTouchpoint } from "./attribution.service.js";
import type { NormalizedLead } from "./types.js";

export interface IngestLeadOptions {
  branchId?: string | null;
  journeyTypeFallback: string;
  campaignNameFallback: string;
  sourceLabel: string;
  taskDueInHours: number;
  firstTouchEventType: string;
  firstTouchTitle: string;
  additionalTouchEventType: string;
  additionalTouchTitle: string;
  description?: string | null;
  // The connector that produced this lead — stamped on any campaign this
  // ingestion auto-creates, so it stays traceable to its connector's mode
  // (see attribution.service.resolveCampaign).
  connectorId?: string | null;
}

// The single place a NormalizedLead — from any acquisition source (website
// form, Meta Lead Ads, Google Ads Lead Forms) — becomes a Patient, a
// Journey, a Timeline entry, a follow-up Task, and a touchpoint. Uses the
// same canonical identity path as manual Add Lead/Add Patient
// (resolveOrCreatePatient) and reuses the patient's most-recent non-terminal
// journey exactly the way every other inbound connector (WhatsApp, Runo)
// already does — a second lead for the same patient while their enquiry is
// still open is another touch on the SAME journey, not a fabricated new
// one. This is also what makes cross-provider multi-touch attribution
// (Meta then Google on one journey) fall out naturally rather than needing
// special-case logic — see recordTouchpoint.
export async function ingestNormalizedLead(
  db: Db,
  tenantId: string,
  lead: NormalizedLead,
  opts: IngestLeadOptions,
): Promise<{ patientId: string; journeyId: string; touchpointId: string; journeyReused: boolean }> {
  const { patient } = await resolveOrCreatePatient(db, {
    tenantId,
    phone: lead.phone ?? "",
    name: lead.name ?? "Unknown contact",
    branchId: opts.branchId,
  });

  const existingJourney = await findMostRecentActiveJourney(db, tenantId, patient.id);
  const journeyReused = existingJourney !== null;

  const journey = existingJourney ?? (await db
    .insert(journeys)
    .values({
      tenantId,
      patientId: patient.id,
      journeyType: opts.journeyTypeFallback,
      source: lead.source,
      stage: "enquiry",
    })
    .returning())[0];

  if (!journeyReused) {
    await db.insert(timelineEvents).values({
      tenantId,
      patientId: patient.id,
      journeyId: journey.id,
      actorType: "system",
      eventType: "journey_created",
      title: `${journey.journeyType} journey opened`,
      sourceChannel: lead.source,
      occurredAt: lead.occurredAt,
    });

    await db.insert(tasks).values({
      tenantId,
      patientId: patient.id,
      journeyId: journey.id,
      reason: "manual_task",
      type: "CALLBACK",
      priority: "normal",
      status: "pending",
      notes: `New ${opts.sourceLabel} enquiry — first response due`,
      dueAt: new Date(lead.occurredAt.getTime() + opts.taskDueInHours * 60 * 60 * 1000),
    });
  }

  await db.insert(timelineEvents).values({
    tenantId,
    patientId: patient.id,
    journeyId: journey.id,
    actorType: "system",
    eventType: journeyReused ? opts.additionalTouchEventType : opts.firstTouchEventType,
    title: journeyReused ? opts.additionalTouchTitle : opts.firstTouchTitle,
    description: opts.description ?? null,
    sourceChannel: lead.source,
    occurredAt: lead.occurredAt,
  });

  const { touchpointId } = await recordTouchpoint(db, {
    tenantId,
    patientId: patient.id,
    journeyId: journey.id,
    details: lead,
    campaignName: lead.utmCampaign ?? opts.campaignNameFallback,
    connectorId: opts.connectorId,
  });

  return { patientId: patient.id, journeyId: journey.id, touchpointId, journeyReused };
}
