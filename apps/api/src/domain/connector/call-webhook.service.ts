import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { calls, communicationEndpoints, connectors, journeys, tasks, timelineEvents } from "../../db/schema.js";
import { findMostRecentActiveJourney, findOrCreatePatientByPhone } from "../patient/identity.service.js";
import { getSoleActiveEndpointForConnector } from "./communication-endpoint.service.js";
import type { InboundCallEvent } from "./types.js";
import type { CallVm } from "@pulseos/types";

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

// A missed call has no disposition to key off (the patient never got to
// state one) — previously fell straight through applyDispositionMapping's
// `if (!disposition) return` guard and created nothing at all, for every
// missed call, silently. `missed_follow_up` already existed in
// taskReasonEnum for exactly this case; it was just never used from here.
async function createMissedCallTask(db: Db, tenantId: string, patientId: string, journeyId: string | null): Promise<void> {
  const journey = journeyId ? await db.select().from(journeys).where(eq(journeys.id, journeyId)).limit(1).then((r) => r[0] ?? null) : null;
  const dueAt = new Date();
  dueAt.setHours(dueAt.getHours() + 2);
  await db.insert(tasks).values({
    tenantId,
    patientId,
    journeyId,
    assignedTo: journey?.ownerUserId ?? null,
    reason: "missed_follow_up",
    type: "CALLBACK",
    priority: "high",
    status: "pending",
    dueAt,
    notes: "Missed call — call back to complete this enquiry",
  });
}

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
  // Runo's real API never reports which hospital line took the call
  // (confirmed against their live OpenAPI spec) — only resolvable when the
  // connector has exactly one active endpoint, a real default, never a guess
  // among several (see getSoleActiveEndpointForConnector).
  const endpoint = await getSoleActiveEndpointForConnector(db, tenantId, connectorId);

  const [insertedCall] = await db
    .insert(calls)
    .values({
      tenantId,
      connectorId,
      patientId: patient.id,
      journeyId: journey?.id ?? null,
      communicationEndpointId: endpoint?.id ?? null,
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
    })
    .returning();

  await db.insert(timelineEvents).values({
    tenantId,
    patientId: patient.id,
    journeyId: journey?.id ?? null,
    actorType: "system",
    eventType: "call_logged",
    channel: "IVR_CALL",
    title: `Call ${event.status.replace(/_/g, " ")}${event.agentName ? ` · ${event.agentName}` : ""}`,
    description: event.disposition,
    occurredAt: event.endedAt ?? event.startedAt ?? new Date(),
    // Previously set relatedEntityType with no relatedEntityId — the
    // Timeline event existed but couldn't actually be traced back to its
    // own `calls` row, unlike the equivalent treatment-status Timeline
    // events (relatedEntityType + relatedEntityId together).
    relatedEntityType: "call",
    relatedEntityId: insertedCall.id,
  });

  // Mutually exclusive, not "also": a missed call's disposition (if any
  // provider ever sends one) doesn't reflect a real conversation, so it
  // must never ALSO trigger a disposition-mapped task — that would double
  // up the follow-up task for one missed call.
  if (event.status === "missed") {
    await createMissedCallTask(db, tenantId, patient.id, journey?.id ?? null);
  } else {
    await applyDispositionMapping(db, tenantId, patient.id, journey?.id ?? null, event.disposition, mapping);
  }
}

// Calls have been written correctly since this table's introduction, but
// nothing ever read them back — no API route existed at all. This is the
// one read path: newest first, joined to the connector for a human-readable
// provider label (never expose connector secrets — only `provider`/`mode`,
// the same pair already treated as safe-to-return elsewhere).
export async function listCallsForPatient(db: Db, tenantId: string, patientId: string): Promise<CallVm[]> {
  const rows = await db
    .select({
      id: calls.id,
      journeyId: calls.journeyId,
      provider: connectors.provider,
      connectorMode: connectors.mode,
      direction: calls.direction,
      phone: calls.phone,
      status: calls.status,
      durationSeconds: calls.durationSeconds,
      recordingUrl: calls.recordingUrl,
      disposition: calls.disposition,
      agentName: calls.agentName,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
      endpointLabel: communicationEndpoints.displayLabel,
    })
    .from(calls)
    .innerJoin(connectors, eq(calls.connectorId, connectors.id))
    .leftJoin(communicationEndpoints, eq(calls.communicationEndpointId, communicationEndpoints.id))
    .where(and(eq(calls.tenantId, tenantId), eq(calls.patientId, patientId)))
    .orderBy(desc(calls.startedAt));

  return rows.map((r) => ({
    id: r.id,
    journeyId: r.journeyId,
    provider: r.provider,
    connectorMode: r.connectorMode,
    direction: r.direction,
    phone: r.phone,
    status: r.status,
    durationSeconds: r.durationSeconds,
    hasRecording: !!r.recordingUrl,
    disposition: r.disposition,
    agentName: r.agentName,
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    endedAt: r.endedAt ? r.endedAt.toISOString() : null,
    endpointLabel: r.endpointLabel ?? null,
  }));
}

/** The provider's recording URL for one call in this tenant, or null when the call or its recording does not exist. */
export async function getCallRecordingUrl(db: Db, tenantId: string, callId: string): Promise<string | null> {
  const [row] = await db.select({ url: calls.recordingUrl }).from(calls).where(and(eq(calls.tenantId, tenantId), eq(calls.id, callId))).limit(1);
  return row?.url ?? null;
}
