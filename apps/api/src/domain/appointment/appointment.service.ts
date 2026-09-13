import { and, asc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { appointments, branches, patients, timelineEvents, users } from "../../db/schema.js";
import type { AppointmentAction, AppointmentRow, AppointmentStatus, CreateAppointmentInput, FrontDeskDashboard } from "@pulseos/types";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export interface AppointmentFilters {
  branchId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  date?: string;
  search?: string;
}

function toRow(r: {
  id: string; patientId: string; patientName: string; journeyId: string; branchName: string | null;
  doctorId: string; doctorName: string | null; status: AppointmentStatus; scheduledAt: Date; reason: string | null;
}): AppointmentRow {
  return {
    id: r.id, patientId: r.patientId, patientName: r.patientName, journeyId: r.journeyId, branchName: r.branchName,
    doctorId: r.doctorId, doctorName: r.doctorName, status: r.status, scheduledAt: r.scheduledAt.toISOString(), reason: r.reason,
  };
}

async function selectAppointments(db: Db, tenantId: string, filters: AppointmentFilters, range?: { start: Date; end: Date }) {
  const resolvedRange =
    range ??
    (filters.date
      ? (() => {
          const start = new Date(filters.date + "T00:00:00");
          const end = new Date(start);
          end.setDate(end.getDate() + 1);
          return { start, end };
        })()
      : undefined);
  const dayClause = resolvedRange ? and(gte(appointments.scheduledAt, resolvedRange.start), lt(appointments.scheduledAt, resolvedRange.end)) : undefined;

  const rows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      patientName: patients.name,
      journeyId: appointments.journeyId,
      branchName: branches.name,
      doctorId: appointments.doctorUserId,
      doctorName: users.name,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      reason: appointments.reason,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(branches, eq(appointments.branchId, branches.id))
    .innerJoin(users, eq(appointments.doctorUserId, users.id))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        filters.branchId ? eq(appointments.branchId, filters.branchId) : undefined,
        filters.doctorId ? eq(appointments.doctorUserId, filters.doctorId) : undefined,
        filters.status ? eq(appointments.status, filters.status) : undefined,
        dayClause,
      ),
    )
    .orderBy(asc(appointments.scheduledAt));

  const search = filters.search?.trim().toLowerCase();
  return search ? rows.filter((r) => r.patientName.toLowerCase().includes(search)) : rows;
}

export async function listAppointments(db: Db, tenantId: string, filters: AppointmentFilters): Promise<AppointmentRow[]> {
  const rows = await selectAppointments(db, tenantId, filters);
  return rows.map(toRow);
}

export async function createAppointment(db: Db, tenantId: string, actorId: string, input: CreateAppointmentInput): Promise<AppointmentRow> {
  const [row] = await db
    .insert(appointments)
    .values({
      tenantId,
      patientId: input.patientId,
      journeyId: input.journeyId,
      branchId: input.branchId,
      doctorUserId: input.doctorId,
      scheduledAt: new Date(input.scheduledAt),
      reason: input.reason ?? null,
      status: "scheduled",
    })
    .returning();

  await db.insert(timelineEvents).values({
    tenantId,
    patientId: input.patientId,
    journeyId: input.journeyId,
    actorType: "user",
    actorId,
    eventType: "appointment_created",
    title: `Appointment booked for ${new Date(input.scheduledAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
  });

  const [full] = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      patientName: patients.name,
      journeyId: appointments.journeyId,
      branchName: branches.name,
      doctorId: appointments.doctorUserId,
      doctorName: users.name,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      reason: appointments.reason,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(branches, eq(appointments.branchId, branches.id))
    .innerJoin(users, eq(appointments.doctorUserId, users.id))
    .where(eq(appointments.id, row.id))
    .limit(1);

  return toRow(full);
}

export async function getFrontDeskDashboard(db: Db, tenantId: string, branchId?: string): Promise<FrontDeskDashboard> {
  const { start, end } = todayRange();
  const todayRows = await selectAppointments(db, tenantId, { branchId }, { start, end });

  const today = todayRows.map(toRow);
  const arrivals = todayRows.filter((r) => r.status === "checked_in" || r.status === "waiting" || r.status === "with_doctor" || r.status === "completed").map(toRow);
  const waitingQueue = todayRows.filter((r) => r.status === "checked_in" || r.status === "waiting").map(toRow);
  const noShows = todayRows.filter((r) => r.status === "no_show").map(toRow);
  const pendingConfirmations = todayRows.filter((r) => r.status === "requested" || r.status === "scheduled").map(toRow);

  return { today, arrivals, waitingQueue, noShows, pendingConfirmations };
}

const ACTION_STATUS: Record<AppointmentAction, AppointmentStatus> = {
  confirm: "confirmed",
  check_in: "checked_in",
  mark_waiting: "waiting",
  send_to_doctor: "with_doctor",
  mark_no_show: "no_show",
  cancel: "cancelled",
};

const ACTION_EVENT: Record<AppointmentAction, string> = {
  confirm: "appointment_confirmed",
  check_in: "appointment_checked_in",
  mark_waiting: "appointment_waiting",
  send_to_doctor: "appointment_with_doctor",
  mark_no_show: "appointment_no_show",
  cancel: "appointment_cancelled",
};

const ACTION_LABEL: Record<AppointmentAction, string> = {
  confirm: "Appointment confirmed",
  check_in: "Patient checked in",
  mark_waiting: "Patient moved to waiting",
  send_to_doctor: "Sent in to doctor",
  mark_no_show: "Marked as no-show",
  cancel: "Appointment cancelled",
};

export async function applyAppointmentAction(
  db: Db,
  tenantId: string,
  appointmentId: string,
  actorId: string,
  action: AppointmentAction,
): Promise<{ ok: true; status: AppointmentStatus } | { ok: false; reason: string }> {
  const [existing] = await db.select().from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, appointmentId))).limit(1);
  if (!existing) return { ok: false, reason: "appointment_not_found" };
  if (existing.status === "completed" || existing.status === "cancelled") return { ok: false, reason: "appointment_closed" };

  const nextStatus = ACTION_STATUS[action];
  await db.update(appointments).set({ status: nextStatus }).where(eq(appointments.id, appointmentId));
  await db.insert(timelineEvents).values({
    tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
    actorType: "user", actorId, eventType: ACTION_EVENT[action], title: ACTION_LABEL[action],
  });

  return { ok: true, status: nextStatus };
}

export async function completeAppointment(db: Db, tenantId: string, appointmentId: string, actorId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [existing] = await db.select().from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, appointmentId))).limit(1);
  if (!existing) return { ok: false, reason: "appointment_not_found" };
  if (existing.status !== "with_doctor") return { ok: false, reason: "not_with_doctor" };

  await db.update(appointments).set({ status: "completed" }).where(eq(appointments.id, appointmentId));
  await db.insert(timelineEvents).values({
    tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
    actorType: "user", actorId, eventType: "appointment_completed", title: "Appointment completed",
  });
  return { ok: true };
}

export async function rescheduleAppointment(db: Db, tenantId: string, appointmentId: string, actorId: string, newScheduledAt: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [existing] = await db.select().from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, appointmentId))).limit(1);
  if (!existing) return { ok: false, reason: "appointment_not_found" };

  await db.update(appointments).set({ scheduledAt: new Date(newScheduledAt), status: "scheduled" }).where(eq(appointments.id, appointmentId));
  await db.insert(timelineEvents).values({
    tenantId, patientId: existing.patientId, journeyId: existing.journeyId,
    actorType: "user", actorId, eventType: "appointment_rescheduled",
    title: `Appointment rescheduled to ${new Date(newScheduledAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
  });
  return { ok: true };
}
