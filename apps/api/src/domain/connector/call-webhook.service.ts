import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { calls, journeys, tasks, timelineEvents } from "../../db/schema.js";
import { findMostRecentActiveJourney, findOrCreatePatientByPhone } from "../patient/identity.service.js";
import type { InboundCallEvent } from "./types.js";

// Disposition → Next Action mapping lives on the connector's own (non-secret)
// configuration — "provider disposition mapping should be configurable at
// the Connector layer" — and is restricted to this fixed action vocabulary.
// Arbitrary provider text can never mutate clinical/operational data; only
// these whitelisted actions ever run, and only when the provider's
// disposition string exactly matches a configured key.
export type DispositionAction =
  | { action: "CREATE_CALLBACK_TASK"; dueInDays: number }
  | { action: "ADVANCE_JOURNEY_STAGE"; stage: "booked" | "lost" };

export type DispositionMapping = Record<string, DispositionAction>;

export const DEFAULT_DISPOSITION_MAPPING: DispositionMapping = {
  CALL_BACK_LATER: { action: "CREATE_CALLBACK_TASK", dueInDays: 1 },
  APPOINTMENT_BOOKED: { action: "ADVANCE_JOURNEY_STAGE", stage: "booked" },
  NOT_INTERESTED: { action: "ADVANCE_JOURNEY_STAGE", stage: "lost" },
};

async function applyDispositionMapping(
  db: Db,
  tenantId: string,
  patientId: string,
  journeyId: string | null,
  disposition: string | null,
  mapping: DispositionMapping,
): Promise<void> {
  if (!disposition) return;
  const rule = mapping[disposition];
  if (!rule) return;

  if (rule.action === "CREATE_CALLBACK_TASK") {
    const journey = journeyId ? await db.select().from(journeys).where(eq(journeys.id, journeyId)).limit(1).then((r) => r[0] ?? null) : null;
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + rule.dueInDays);
    await db.insert(tasks).values({
      tenantId,
      patientId,
      journeyId,
      assignedTo: journey?.ownerUserId ?? null,
      reason: "overdue_callback",
      type: "CALLBACK",
      priority: "normal",
      status: "pending",
      dueAt,
      notes: `Follow-up call requested (disposition: ${disposition})`,
    });
    return;
  }

  if (rule.action === "ADVANCE_JOURNEY_STAGE" && journeyId) {
    await db.update(journeys).set({ stage: rule.stage }).where(eq(journeys.id, journeyId));
  }
}

export async function persistInboundCall(db: Db, tenantId: string, connectorId: string, event: InboundCallEvent, mapping: DispositionMapping = DEFAULT_DISPOSITION_MAPPING): Promise<void> {
  const customerName = (event.metadata.customerName as string | null | undefined) ?? null;
  const patient = await findOrCreatePatientByPhone(db, tenantId, event.phone, customerName);
  const journey = await findMostRecentActiveJourney(db, tenantId, patient.id);

  await db.insert(calls).values({
    tenantId,
    connectorId,
    patientId: patient.id,
    journeyId: journey?.id ?? null,
    externalCallId: event.externalCallId,
    direction: event.direction,
    phone: event.phone,
    status: event.status,
    durationSeconds: event.durationSeconds,
    recordingUrl: event.recordingUrl,
    disposition: event.disposition,
    agentName: event.agentName,
    startedAt: event.startedAt,
    endedAt: event.endedAt,
    metadata: event.metadata,
  });

  await db.insert(timelineEvents).values({
    tenantId,
    patientId: patient.id,
    journeyId: journey?.id ?? null,
    actorType: "system",
    eventType: "call_logged",
    title: `Call ${event.status.replace(/_/g, " ")}${event.agentName ? ` · ${event.agentName}` : ""}`,
    description: event.disposition,
    occurredAt: event.endedAt ?? event.startedAt ?? new Date(),
    relatedEntityType: "call",
  });

  await applyDispositionMapping(db, tenantId, patient.id, journey?.id ?? null, event.disposition, mapping);
}
