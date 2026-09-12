import { and, asc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { appointments, consultationOutcomes, journeys, patients } from "../../db/schema.js";
import type { DoctorDashboard, DoctorTodayItem } from "@pulseos/types";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getDoctorDashboard(db: Db, tenantId: string, doctorUserId: string): Promise<DoctorDashboard> {
  const { start, end } = todayRange();

  const rows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      patientName: patients.name,
      journeyType: journeys.journeyType,
      reason: appointments.reason,
      hasOutcome: consultationOutcomes.id,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(journeys, eq(appointments.journeyId, journeys.id))
    .leftJoin(consultationOutcomes, eq(consultationOutcomes.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.doctorUserId, doctorUserId),
        gte(appointments.scheduledAt, start),
        lt(appointments.scheduledAt, end),
      ),
    )
    .orderBy(asc(appointments.scheduledAt));

  const today: DoctorTodayItem[] = rows.map((r) => ({
    appointmentId: r.id,
    patientName: r.patientName,
    time: r.scheduledAt.toISOString(),
    status: r.status,
  }));

  const waitingCount = rows.filter((r) => r.status === "checked_in").length;
  const checkedInCount = rows.filter((r) => r.status === "checked_in" || r.status === "with_doctor").length;

  const nextRow = rows.find((r) => r.status === "scheduled" || r.status === "checked_in");
  const nextPatient = nextRow
    ? {
        appointmentId: nextRow.id,
        patientName: nextRow.patientName,
        journeyType: nextRow.journeyType,
        appointmentTime: nextRow.scheduledAt.toISOString(),
        reason: nextRow.reason,
      }
    : null;

  const awaitingOutcome: DoctorTodayItem[] = rows
    .filter((r) => r.status === "completed" && !r.hasOutcome)
    .map((r) => ({ appointmentId: r.id, patientName: r.patientName, time: r.scheduledAt.toISOString(), status: r.status }));

  return {
    todayCount: rows.length,
    waitingCount,
    checkedInCount,
    nextPatient,
    today,
    awaitingOutcome,
  };
}
