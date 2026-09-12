import { and, count, eq, gte, lt, sql, sum, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { appointments, journeys, patients, tasks, users } from "../../db/schema.js";
import type {
  AttentionItem,
  BranchDoctorRow,
  ConversionStage,
  MarketingSourceRow,
  PatientFlowCount,
  TeamWorkloadRow,
  TodayStrip,
} from "@pulseos/types";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getTodayStrip(db: Db, tenantId: string): Promise<TodayStrip> {
  const { start, end } = todayRange();

  const [[newEnquiries], [uncontacted], [followUpsDue], [appointmentsToday], [waitingNow], [noShows], [consultationsCompleted], [treatmentPending]] =
    await Promise.all([
      db.select({ c: count() }).from(journeys).where(and(eq(journeys.tenantId, tenantId), gte(journeys.createdAt, start), lt(journeys.createdAt, end))),
      db.select({ c: count() }).from(journeys).where(and(eq(journeys.tenantId, tenantId), eq(journeys.stage, "enquiry"), isNull(journeys.contactedAt))),
      db.select({ c: count() }).from(tasks).where(and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending"), lt(tasks.dueAt, end))),
      db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end))),
      db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "checked_in"))),
      db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "no_show"), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end))),
      db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "completed"), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end))),
      db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.outcomeRecorded, true), eq(appointments.treatmentRecommended, true))),
    ]);

  return {
    newEnquiries: newEnquiries.c,
    uncontacted: uncontacted.c,
    followUpsDue: followUpsDue.c,
    appointmentsToday: appointmentsToday.c,
    waitingNow: waitingNow.c,
    noShows: noShows.c,
    consultationsCompleted: consultationsCompleted.c,
    treatmentDecisionsPending: treatmentPending.c,
  };
}

const CONVERSION_STAGES: { key: ConversionStage["key"]; label: string }[] = [
  { key: "enquiry", label: "Enquiry" },
  { key: "contacted", label: "Contacted" },
  { key: "booked", label: "Booked" },
  { key: "attended", label: "Attended" },
  { key: "consulted", label: "Consulted" },
  { key: "treatment_advised", label: "Treatment Advised" },
  { key: "scheduled", label: "Scheduled" },
  { key: "completed", label: "Completed" },
];

export async function getConversionFunnel(db: Db, tenantId: string): Promise<ConversionStage[]> {
  const rows = await db
    .select({ stage: journeys.stage, c: count() })
    .from(journeys)
    .where(eq(journeys.tenantId, tenantId))
    .groupBy(journeys.stage);

  const counts = new Map(rows.map((r) => [r.stage, r.c]));

  // A journey's current stage implies it has passed through every earlier stage
  // (lost/declined journeys are excluded from the funnel, not counted at any stage).
  // So funnel[i] = number of journeys whose current stage index is >= i.
  const perStageCounts = CONVERSION_STAGES.map((s) => counts.get(s.key) ?? 0);
  return CONVERSION_STAGES.map((s, idx) => {
    const reachedOrPast = perStageCounts.slice(idx).reduce((sum, c) => sum + c, 0);
    return { key: s.key, label: s.label, count: reachedOrPast };
  });
}

export async function getPatientFlow(db: Db, tenantId: string): Promise<PatientFlowCount[]> {
  const statusToBucket: Record<string, PatientFlowCount["bucket"]> = {
    checked_in: "checked_in",
    with_doctor: "with_doctor",
    completed: "consultation_complete",
  };

  const rows = await db
    .select({ status: appointments.status, c: count() })
    .from(appointments)
    .where(eq(appointments.tenantId, tenantId))
    .groupBy(appointments.status);

  const buckets: Record<PatientFlowCount["bucket"], number> = {
    waiting: 0,
    checked_in: 0,
    with_doctor: 0,
    consultation_complete: 0,
    follow_up_required: 0,
  };

  for (const row of rows) {
    const bucket = statusToBucket[row.status];
    if (bucket) buckets[bucket] += row.c;
    if (row.status === "scheduled") buckets.waiting += row.c;
  }

  const [followUp] = await db
    .select({ c: count() })
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending")));
  buckets.follow_up_required = followUp.c;

  return (Object.keys(buckets) as PatientFlowCount["bucket"][]).map((bucket) => ({ bucket, count: buckets[bucket] }));
}

export async function getAttentionQueue(db: Db, tenantId: string): Promise<AttentionItem[]> {
  const rows = await db
    .select({
      id: tasks.id,
      patientName: patients.name,
      journeyType: journeys.journeyType,
      reason: tasks.reason,
      dueAt: tasks.dueAt,
      ownerName: users.name,
    })
    .from(tasks)
    .innerJoin(patients, eq(tasks.patientId, patients.id))
    .leftJoin(journeys, eq(tasks.journeyId, journeys.id))
    .leftJoin(users, eq(tasks.assignedTo, users.id))
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending"), sql`${tasks.reason} != 'manual_task'`))
    .orderBy(tasks.dueAt)
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    patientName: r.patientName,
    journeyType: r.journeyType ?? "general",
    reason: r.reason as AttentionItem["reason"],
    dueAt: r.dueAt.toISOString(),
    ownerName: r.ownerName,
  }));
}

export async function getMarketingSources(db: Db, tenantId: string): Promise<MarketingSourceRow[]> {
  const rows = await db
    .select({
      source: journeys.source,
      volume: count(journeys.id),
    })
    .from(journeys)
    .where(eq(journeys.tenantId, tenantId))
    .groupBy(journeys.source);

  const appointmentsBySource = await db
    .select({ source: journeys.source, appts: count(appointments.id), revenue: sum(appointments.revenueAmount) })
    .from(journeys)
    .leftJoin(appointments, eq(appointments.journeyId, journeys.id))
    .where(eq(journeys.tenantId, tenantId))
    .groupBy(journeys.source);

  const consultationsBySource = await db
    .select({ source: journeys.source, consultations: count(appointments.id) })
    .from(journeys)
    .leftJoin(appointments, and(eq(appointments.journeyId, journeys.id), eq(appointments.status, "completed")))
    .where(eq(journeys.tenantId, tenantId))
    .groupBy(journeys.source);

  const treatmentBySource = await db
    .select({ source: journeys.source, treatments: count(appointments.id) })
    .from(journeys)
    .leftJoin(appointments, and(eq(appointments.journeyId, journeys.id), eq(appointments.treatmentRecommended, true)))
    .where(eq(journeys.tenantId, tenantId))
    .groupBy(journeys.source);

  const apptMap = new Map(appointmentsBySource.map((r) => [r.source, r]));
  const consultMap = new Map(consultationsBySource.map((r) => [r.source, r.consultations]));
  const treatMap = new Map(treatmentBySource.map((r) => [r.source, r.treatments]));

  return rows.map((r) => {
    const appt = apptMap.get(r.source);
    return {
      source: r.source,
      volume: r.volume,
      appointments: appt?.appts ?? 0,
      consultations: consultMap.get(r.source) ?? 0,
      treatmentConversion: treatMap.get(r.source) ?? 0,
      revenue: Number(appt?.revenue ?? 0),
    };
  });
}

export async function getTeamWorkload(db: Db, tenantId: string): Promise<TeamWorkloadRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      role: users.role,
      openTasks: count(tasks.id),
    })
    .from(users)
    .leftJoin(tasks, and(eq(tasks.assignedTo, users.id), eq(tasks.status, "pending")))
    .where(and(eq(users.tenantId, tenantId), sql`${users.role} IN ('FRONT_DESK', 'PATIENT_COORDINATOR')`))
    .groupBy(users.id, users.name, users.role);

  const now = new Date();
  const overdueRows = await db
    .select({ userId: tasks.assignedTo, overdue: count(tasks.id) })
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending"), lt(tasks.dueAt, now)))
    .groupBy(tasks.assignedTo);

  const overdueMap = new Map(overdueRows.map((r) => [r.userId, r.overdue]));

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    role: r.role,
    openTasks: r.openTasks,
    overdueTasks: overdueMap.get(r.userId) ?? 0,
  }));
}

export async function getBranchDoctorPerformance(db: Db, tenantId: string): Promise<BranchDoctorRow[]> {
  const rows = await db
    .select({
      doctorId: users.id,
      name: users.name,
      appointments: count(appointments.id),
    })
    .from(users)
    .leftJoin(appointments, eq(appointments.doctorUserId, users.id))
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "DOCTOR")))
    .groupBy(users.id, users.name);

  const waitingRows = await db
    .select({ doctorId: appointments.doctorUserId, waiting: count(appointments.id) })
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "checked_in")))
    .groupBy(appointments.doctorUserId);

  const consultRows = await db
    .select({ doctorId: appointments.doctorUserId, consultations: count(appointments.id) })
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "completed")))
    .groupBy(appointments.doctorUserId);

  const waitingMap = new Map(waitingRows.map((r) => [r.doctorId, r.waiting]));
  const consultMap = new Map(consultRows.map((r) => [r.doctorId, r.consultations]));

  return rows.map((r) => ({
    id: r.doctorId,
    name: r.name,
    kind: "doctor" as const,
    appointments: r.appointments,
    waitingLoad: waitingMap.get(r.doctorId) ?? 0,
    consultations: consultMap.get(r.doctorId) ?? 0,
  }));
}
