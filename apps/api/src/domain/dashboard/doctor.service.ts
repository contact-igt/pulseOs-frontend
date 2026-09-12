import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { appointments, journeys, patients } from "../../db/schema.js";
import type { DoctorDashboard, DoctorRecentPatient, DoctorTodayItem } from "@pulseos/types";

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
      outcomeRecorded: appointments.outcomeRecorded,
      treatmentRecommended: appointments.treatmentRecommended,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(journeys, eq(appointments.journeyId, journeys.id))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.doctorUserId, doctorUserId),
        gte(appointments.scheduledAt, start),
        lt(appointments.scheduledAt, end),
      ),
    )
    .orderBy(appointments.scheduledAt);

  const today: DoctorTodayItem[] = rows.map((r) => ({
    appointmentId: r.id,
    patientName: r.patientName,
    time: r.scheduledAt.toISOString(),
    status: r.status,
  }));

  const waitingNow = rows.filter((r) => r.status === "checked_in").length;
  const withMeCount = rows.filter((r) => r.status === "with_doctor").length;
  const checkedInCount = rows.filter((r) => r.status === "checked_in" || r.status === "with_doctor" || r.status === "completed").length;
  const completedCount = rows.filter((r) => r.status === "completed").length;
  const eligibleForCompletion = rows.filter((r) => r.status !== "cancelled").length;
  const completionPct = eligibleForCompletion > 0 ? Math.round((completedCount / eligibleForCompletion) * 100) : 0;

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
    .filter((r) => r.status === "completed" && !r.outcomeRecorded)
    .map((r) => ({ appointmentId: r.id, patientName: r.patientName, time: r.scheduledAt.toISOString(), status: r.status }));

  const treatmentFollowUps: DoctorTodayItem[] = rows
    .filter((r) => r.treatmentRecommended)
    .map((r) => ({ appointmentId: r.id, patientName: r.patientName, time: r.scheduledAt.toISOString(), status: r.status }));

  const pastRows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      patientName: patients.name,
      journeyType: journeys.journeyType,
      outcomeRecorded: appointments.outcomeRecorded,
      treatmentRecommended: appointments.treatmentRecommended,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(journeys, eq(appointments.journeyId, journeys.id))
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.doctorUserId, doctorUserId), eq(appointments.status, "completed"), lt(appointments.scheduledAt, start)))
    .orderBy(desc(appointments.scheduledAt))
    .limit(10);

  const postCare: DoctorTodayItem[] = pastRows
    .filter((r) => r.outcomeRecorded && !r.treatmentRecommended)
    .map((r) => ({ appointmentId: r.id, patientName: r.patientName, time: r.scheduledAt.toISOString(), status: r.status }));

  const recentPatients: DoctorRecentPatient[] = pastRows.map((r) => ({
    appointmentId: r.id,
    patientName: r.patientName,
    journeyType: r.journeyType,
    time: r.scheduledAt.toISOString(),
  }));

  return {
    todayCount: rows.length,
    checkedInCount,
    waitingNow,
    withMeCount,
    completionPct,
    nextPatient,
    today,
    awaitingOutcome,
    treatmentFollowUps,
    postCare,
    recentPatients,
  };
}
