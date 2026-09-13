import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { timelineEvents } from "../../db/schema.js";

const CATEGORY_BY_EVENT_TYPE: Record<string, "communication" | "appointments" | "clinical" | "tasks" | "other"> = {
  journey_created: "other",
  source_captured: "other",
  whatsapp_message: "communication",
  call_logged: "communication",
  note_added: "communication",
  appointment_scheduled: "appointments",
  appointment_confirmed: "appointments",
  appointment_checked_in: "appointments",
  appointment_waiting: "appointments",
  appointment_with_doctor: "appointments",
  appointment_completed: "appointments",
  appointment_no_show: "appointments",
  appointment_rescheduled: "appointments",
  appointment_cancelled: "appointments",
  consultation_outcome_recorded: "clinical",
  treatment_status_changed: "clinical",
  revenue_recorded: "clinical",
  task_created: "tasks",
  task_completed: "tasks",
  conversation_claimed: "communication",
  conversation_assigned: "communication",
  conversation_closed: "communication",
  conversation_returned_to_ai: "communication",
};

export interface TimelineEventVm {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  sourceChannel: string | null;
  occurredAt: string;
  category: "communication" | "appointments" | "clinical" | "tasks" | "other";
}

export async function getPatientTimeline(db: Db, tenantId: string, patientId: string, journeyId?: string): Promise<TimelineEventVm[]> {
  const rows = await db
    .select()
    .from(timelineEvents)
    .where(
      and(
        eq(timelineEvents.tenantId, tenantId),
        eq(timelineEvents.patientId, patientId),
        journeyId ? eq(timelineEvents.journeyId, journeyId) : undefined,
      ),
    )
    .orderBy(asc(timelineEvents.occurredAt));

  return rows.map((r) => ({
    id: r.id,
    eventType: r.eventType,
    title: r.title,
    description: r.description,
    sourceChannel: r.sourceChannel,
    occurredAt: r.occurredAt.toISOString(),
    category: CATEGORY_BY_EVENT_TYPE[r.eventType] ?? "other",
  }));
}
