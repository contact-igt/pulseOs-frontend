import { and, eq, or } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { appointments, journeys, patients, revenueEvents, tasks, timelineEvents, treatmentOpportunities, users } from "../../db/schema.js";
import { recordConversionFeedbackEvent } from "../acquisition/conversion-feedback.service.js";
import type { TreatmentRow, TreatmentStatus } from "@pulseos/types";

// Postgres unique_violation SQLSTATE. Used to recognize a lost race against
// the revenue_events_treatment_opportunity_unique index as "already recorded"
// rather than a real error — defense-in-depth behind the conditional-update
// guard below, in case some future path ever bypasses it.
const POSTGRES_UNIQUE_VIOLATION = "23505";
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === POSTGRES_UNIQUE_VIOLATION;
}

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

  // The read above and the write below are two separate round-trips, so two
  // concurrent requests can both read the pre-transition status and both pass
  // the VALID_TRANSITIONS check before either commits (classic check-then-act
  // race). The UPDATE's WHERE clause re-guards on the exact status we just
  // validated against: under Postgres's normal row-locking behavior, the
  // second writer blocks on the first writer's row lock, then re-evaluates
  // WHERE against the now-committed (changed) row and affects zero rows — so
  // at most one caller ever proceeds past this point for a given transition.
  const transitioned = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(treatmentOpportunities)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
        decisionDate: nextStatus === "ACCEPTED" || nextStatus === "DECLINED" ? new Date() : existing.decisionDate,
        plannedDate: plannedDate ? new Date(plannedDate) : existing.plannedDate,
      })
      .where(and(
        eq(treatmentOpportunities.id, treatmentId),
        eq(treatmentOpportunities.tenantId, tenantId),
        eq(treatmentOpportunities.status, existing.status),
      ))
      .returning();

    if (!updated) return null;

    await tx.insert(timelineEvents).values({
      tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
      actorType: "user", actorId, eventType: "treatment_status_changed",
      title: `Treatment "${existing.treatmentLabel}" — ${nextStatus.replace(/_/g, " ").toLowerCase()}`,
      relatedEntityType: "treatment_opportunity", relatedEntityId: existing.id,
    });

    if (nextStatus === "ACCEPTED") {
      const [journey] = await tx.select().from(journeys).where(eq(journeys.id, existing.journeyId)).limit(1);
      await tx.update(journeys).set({ stage: "treatment_advised" }).where(eq(journeys.id, existing.journeyId));
      if (journey) {
        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + 2);
        await tx.insert(tasks).values({
          tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
          assignedTo: existing.ownerUserId ?? journey.ownerUserId, reason: "treatment_decision_pending",
          type: "TREATMENT_DECISION", priority: "high", status: "pending", dueAt, createdBy: actorId,
          notes: "Schedule accepted treatment",
        });
      }
    }

    if (nextStatus === "COMPLETED") {
      const [journey] = await tx.select().from(journeys).where(eq(journeys.id, existing.journeyId)).limit(1);
      const assignedTo = existing.ownerUserId ?? journey?.ownerUserId ?? null;

      const postCareDueAt = new Date();
      postCareDueAt.setDate(postCareDueAt.getDate() + 1);
      const reviewDueAt = new Date();
      reviewDueAt.setDate(reviewDueAt.getDate() + 7);

      await tx.insert(tasks).values([
        {
          tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
          assignedTo, reason: "manual_task", type: "POST_CARE", priority: "normal",
          status: "pending", dueAt: postCareDueAt, createdBy: actorId,
          notes: `Post-care call — check on patient after "${existing.treatmentLabel}"`,
        },
        {
          tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
          assignedTo, reason: "manual_task", type: "RECALL", priority: "normal",
          status: "pending", dueAt: reviewDueAt, createdBy: actorId,
          notes: `Schedule review appointment for "${existing.treatmentLabel}"`,
        },
      ]);

      // Revenue attribution write path: a completed treatment is real,
      // attributable revenue. estimatedValue is the only amount available at
      // completion time today (no separate "actual paid amount" field yet).
      // treatmentOpportunities.journeyId is NOT NULL, so existing.journeyId is
      // always a real journey here — never defaulted or guessed. Idempotency
      // is primarily the conditional UPDATE above (only one concurrent caller
      // ever reaches this insert for a given treatment); the unique index on
      // revenue_events.treatment_opportunity_id is DB-backed defense-in-depth,
      // handled gracefully via a savepoint so a stray violation can't abort
      // the rest of this transaction.
      try {
        await tx.transaction(async (tx2) => {
          await tx2.insert(revenueEvents).values({
            tenantId,
            patientId: existing.patientId,
            journeyId: existing.journeyId,
            treatmentOpportunityId: existing.id,
            amount: existing.estimatedValue,
            currency: "INR",
            type: "treatment_payment",
            occurredAt: new Date(),
            sourceSystem: "treatment_completion",
          });
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Already recorded for this treatment — idempotent no-op.
      }
    }

    return updated;
  });

  if (!transitioned) return { ok: false, reason: "conflict" };

  if (nextStatus === "COMPLETED") {
    // A completed treatment is the checkpoint-specified trigger point for
    // conversion feedback — this only ever builds a candidate record
    // (consent-gated, idempotent), never sends anything to a real provider.
    // Best-effort, matching its own doc comment: the status transition and
    // revenue event above are already durably committed by this point, so a
    // failure here must never surface as if the completion itself failed —
    // the caller would see a false 500 on an already-successful change with
    // no way to tell (a retry would just hit "already completed").
    try {
      await recordConversionFeedbackEvent(db, tenantId, existing.journeyId, "TREATMENT_COMPLETED", existing.estimatedValue, "INR");
    } catch (err) {
      console.error(`recordConversionFeedbackEvent failed for treatment ${treatmentId} after completion was already committed`, err);
    }
  }

  return { ok: true };
}
