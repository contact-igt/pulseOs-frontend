import { and, eq, or } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { appointments, journeys, patients, tasks, timelineEvents, treatmentOpportunities, users } from "../../db/schema.js";
import type { TreatmentRow, TreatmentStatus } from "@pulseos/types";

export interface TreatmentFilters {
  status?: TreatmentStatus;
  ownerId?: string;
}

export async function listTreatments(db: Db, tenantId: string, filters: TreatmentFilters): Promise<TreatmentRow[]> {
  const rows = await db
    .select({
      id: treatmentOpportunities.id,
      patientId: treatmentOpportunities.patientId,
      patientName: patients.name,
      journeyId: treatmentOpportunities.journeyId,
      treatmentLabel: treatmentOpportunities.treatmentLabel,
      estimatedValue: treatmentOpportunities.estimatedValue,
      status: treatmentOpportunities.status,
      ownerName: users.name,
      plannedDate: treatmentOpportunities.plannedDate,
    })
    .from(treatmentOpportunities)
    .innerJoin(patients, eq(treatmentOpportunities.patientId, patients.id))
    .leftJoin(users, eq(treatmentOpportunities.ownerUserId, users.id))
    .where(
      and(
        eq(treatmentOpportunities.tenantId, tenantId),
        filters.status ? eq(treatmentOpportunities.status, filters.status) : undefined,
        filters.ownerId ? eq(treatmentOpportunities.ownerUserId, filters.ownerId) : undefined,
      ),
    )
    .orderBy(treatmentOpportunities.updatedAt);

  const journeyIds = rows.map((r) => r.journeyId);
  if (journeyIds.length === 0) return [];

  const doctorRows = await db
    .select({ journeyId: appointments.journeyId, doctorName: users.name, scheduledAt: appointments.scheduledAt })
    .from(appointments)
    .leftJoin(users, eq(appointments.doctorUserId, users.id))
    .where(eq(appointments.tenantId, tenantId));
  const latestApptByJourney = new Map<string, Date>();
  const doctorByJourney = new Map<string, string | null>();
  for (const d of doctorRows) {
    const existing = latestApptByJourney.get(d.journeyId);
    if (!existing || d.scheduledAt > existing) {
      latestApptByJourney.set(d.journeyId, d.scheduledAt);
      doctorByJourney.set(d.journeyId, d.doctorName);
    }
  }

  const taskRows = await db
    .select({ journeyId: tasks.journeyId, dueAt: tasks.dueAt })
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress"))));
  const nextActionByJourney = new Map<string, Date>();
  for (const t of taskRows) {
    if (!t.journeyId) continue;
    const existing = nextActionByJourney.get(t.journeyId);
    if (!existing || t.dueAt < existing) nextActionByJourney.set(t.journeyId, t.dueAt);
  }

  const timelineRows = await db
    .select({ journeyId: timelineEvents.journeyId, occurredAt: timelineEvents.occurredAt })
    .from(timelineEvents)
    .where(eq(timelineEvents.tenantId, tenantId));
  const lastContactByJourney = new Map<string, Date>();
  for (const t of timelineRows) {
    if (!t.journeyId) continue;
    const existing = lastContactByJourney.get(t.journeyId);
    if (!existing || t.occurredAt > existing) lastContactByJourney.set(t.journeyId, t.occurredAt);
  }

  return rows.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    patientName: r.patientName,
    journeyId: r.journeyId,
    doctorName: doctorByJourney.get(r.journeyId) ?? null,
    treatmentLabel: r.treatmentLabel,
    estimatedValue: r.estimatedValue,
    status: r.status,
    ownerName: r.ownerName,
    nextActionDueAt: nextActionByJourney.get(r.journeyId)?.toISOString() ?? null,
    lastContactAt: lastContactByJourney.get(r.journeyId)?.toISOString() ?? null,
    plannedDate: r.plannedDate?.toISOString() ?? null,
  }));
}

const VALID_TRANSITIONS: Record<TreatmentStatus, TreatmentStatus[]> = {
  ADVISED: ["DECISION_PENDING", "ACCEPTED", "DECLINED", "CANCELLED"],
  DECISION_PENDING: ["ACCEPTED", "DECLINED", "CANCELLED"],
  ACCEPTED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  DECLINED: [],
  CANCELLED: [],
  LOST: [],
};

export async function updateTreatmentStatus(
  db: Db,
  tenantId: string,
  treatmentId: string,
  actorId: string,
  nextStatus: TreatmentStatus,
  plannedDate?: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [existing] = await db.select().from(treatmentOpportunities).where(and(eq(treatmentOpportunities.tenantId, tenantId), eq(treatmentOpportunities.id, treatmentId))).limit(1);
  if (!existing) return { ok: false, reason: "treatment_not_found" };
  if (!VALID_TRANSITIONS[existing.status].includes(nextStatus)) return { ok: false, reason: "invalid_transition" };

  await db
    .update(treatmentOpportunities)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
      decisionDate: nextStatus === "ACCEPTED" || nextStatus === "DECLINED" ? new Date() : existing.decisionDate,
      plannedDate: plannedDate ? new Date(plannedDate) : existing.plannedDate,
    })
    .where(eq(treatmentOpportunities.id, treatmentId));

  await db.insert(timelineEvents).values({
    tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
    actorType: "user", actorId, eventType: "treatment_status_changed",
    title: `Treatment "${existing.treatmentLabel}" — ${nextStatus.replace(/_/g, " ").toLowerCase()}`,
    relatedEntityType: "treatment_opportunity", relatedEntityId: existing.id,
  });

  if (nextStatus === "ACCEPTED") {
    const [journey] = await db.select().from(journeys).where(eq(journeys.id, existing.journeyId)).limit(1);
    await db.update(journeys).set({ stage: "treatment_advised" }).where(eq(journeys.id, existing.journeyId));
    if (journey) {
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 2);
      await db.insert(tasks).values({
        tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
        assignedTo: existing.ownerUserId ?? journey.ownerUserId, reason: "treatment_decision_pending",
        type: "TREATMENT_DECISION", priority: "high", status: "pending", dueAt, createdBy: actorId,
        notes: "Schedule accepted treatment",
      });
    }
  }

  return { ok: true };
}
