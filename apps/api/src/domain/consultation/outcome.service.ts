import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { appointments, consultationOutcomes, journeys, tasks, timelineEvents, treatmentOpportunities } from "../../db/schema.js";
import type { ConsultationOutcomeValue } from "@pulseos/types";
import { findActiveTreatmentDefinition } from "../specialty/treatment-catalog.service.js";

export interface RecordOutcomeParams {
  tenantId: string;
  appointmentId: string;
  doctorUserId: string;
  outcome: ConsultationOutcomeValue;
  notes?: string;
  treatmentLabel?: string;
  /** Catalog procedure; must be an active entry of params.tenantId's catalog. Wins over treatmentLabel. */
  treatmentDefinitionId?: string;
  estimatedValue?: number;
}

const STAGE_BY_OUTCOME: Partial<Record<ConsultationOutcomeValue, (typeof journeys.stage.enumValues)[number]>> = {
  CONSULTED: "consulted",
  NO_TREATMENT_REQUIRED: "consulted",
  FOLLOW_UP_REQUIRED: "consulted",
  DECISION_PENDING: "consulted",
  REFERRED: "consulted",
  TREATMENT_ADVISED: "treatment_advised",
};

export async function recordConsultationOutcome(db: Db, params: RecordOutcomeParams) {
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.tenantId, params.tenantId), eq(appointments.id, params.appointmentId)))
    .limit(1);
  if (!appointment) return { ok: false as const, reason: "appointment_not_found" as const };

  // Validated before anything is written: an unknown, inactive or other-tenant definition is a 422, never a partial outcome.
  const definition = params.treatmentDefinitionId ? await findActiveTreatmentDefinition(db, params.tenantId, params.treatmentDefinitionId) : null;
  if (params.treatmentDefinitionId && !definition) return { ok: false as const, reason: "invalid_treatment_definition" as const };

  const [existing] = await db
    .select({ id: consultationOutcomes.id })
    .from(consultationOutcomes)
    .where(eq(consultationOutcomes.appointmentId, params.appointmentId))
    .limit(1);
  if (existing) return { ok: false as const, reason: "outcome_already_recorded" as const };

  const [outcome] = await db
    .insert(consultationOutcomes)
    .values({
      tenantId: params.tenantId,
      patientId: appointment.patientId,
      journeyId: appointment.journeyId,
      appointmentId: appointment.id,
      outcome: params.outcome,
      recordedBy: params.doctorUserId,
      notes: params.notes,
    })
    .returning();

  const nextStage = STAGE_BY_OUTCOME[params.outcome];
  if (nextStage) {
    await db.update(journeys).set({ stage: nextStage }).where(eq(journeys.id, appointment.journeyId));
  }

  let treatmentOpportunity = null;
  if (params.outcome === "TREATMENT_ADVISED" || params.outcome === "DECISION_PENDING") {
    const [journey] = await db.select().from(journeys).where(eq(journeys.id, appointment.journeyId)).limit(1);
    [treatmentOpportunity] = await db
      .insert(treatmentOpportunities)
      .values({
        tenantId: params.tenantId,
        patientId: appointment.patientId,
        journeyId: appointment.journeyId,
        consultationOutcomeId: outcome.id,
        treatmentLabel: definition?.label ?? params.treatmentLabel ?? "Treatment",
        treatmentDefinitionId: definition?.id ?? null,
        status: params.outcome === "TREATMENT_ADVISED" ? "ADVISED" : "DECISION_PENDING",
        estimatedValue: params.estimatedValue ?? definition?.defaultEstimatedValue ?? 0,
        ownerUserId: journey?.ownerUserId ?? null,
      })
      .returning();
  }

  let followUpTask = null;
  if (params.outcome === "FOLLOW_UP_REQUIRED") {
    const [journey] = await db.select().from(journeys).where(eq(journeys.id, appointment.journeyId)).limit(1);
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 3);
    [followUpTask] = await db
      .insert(tasks)
      .values({
        tenantId: params.tenantId,
        patientId: appointment.patientId,
        journeyId: appointment.journeyId,
        assignedTo: journey?.ownerUserId ?? null,
        reason: "missed_follow_up",
        status: "pending",
        dueAt,
      })
      .returning();
  }

  const timelineRows: (typeof timelineEvents.$inferInsert)[] = [
    {
      tenantId: params.tenantId,
      patientId: appointment.patientId,
      journeyId: appointment.journeyId,
      actorType: "user",
      actorId: params.doctorUserId,
      eventType: "consultation_outcome_recorded",
      title: `Consultation outcome: ${params.outcome.replace(/_/g, " ").toLowerCase()}`,
      description: params.notes ?? null,
      relatedEntityType: "consultation_outcome",
      relatedEntityId: outcome.id,
      occurredAt: outcome.recordedAt,
    },
  ];
  if (treatmentOpportunity) {
    timelineRows.push({
      tenantId: params.tenantId,
      patientId: appointment.patientId,
      journeyId: appointment.journeyId,
      actorType: "system",
      eventType: "treatment_status_changed",
      title: `Treatment "${treatmentOpportunity.treatmentLabel}" — ${treatmentOpportunity.status.replace(/_/g, " ").toLowerCase()}`,
      relatedEntityType: "treatment_opportunity",
      relatedEntityId: treatmentOpportunity.id,
      occurredAt: new Date(),
    });
  }
  await db.insert(timelineEvents).values(timelineRows);

  return { ok: true as const, outcome, treatmentOpportunity, followUpTask };
}
