import { and, count, eq, gte, lt, sql, sum } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { appointments, journeys, patients, tasks, users, sourceSpend, branches } from "../../db/schema.js";
import type {
  AttentionItem,
  Branch,
  BranchDoctorRow,
  ConversionStage,
  JourneyHealth,
  JourneyHealthKey,
  JourneyPerformancePoint,
  MarketingSourceRow,
  PatientFlowCount,
  SpendAtRisk,
  TeamWorkloadRow,
  TodayStrip,
} from "@pulseos/types";

export interface DashboardFilters {
  branchId?: string;
  journeyType?: string;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function listBranches(db: Db, tenantId: string): Promise<Branch[]> {
  const rows = await db.select().from(branches).where(eq(branches.tenantId, tenantId));
  return rows.map((r) => ({ id: r.id, name: r.name, city: r.city }));
}

export async function listJourneyTypes(db: Db, tenantId: string): Promise<string[]> {
  const rows = await db.selectDistinct({ journeyType: journeys.journeyType }).from(journeys).where(eq(journeys.tenantId, tenantId));
  return rows.map((r) => r.journeyType).sort();
}

export async function getTodayStrip(db: Db, tenantId: string, filters: DashboardFilters = {}): Promise<TodayStrip> {
  const { start, end } = todayRange();
  const branchClause = filters.branchId ? eq(patients.branchId, filters.branchId) : undefined;
  const apptBranchClause = filters.branchId ? eq(appointments.branchId, filters.branchId) : undefined;
  const journeyTypeClause = filters.journeyType ? eq(journeys.journeyType, filters.journeyType) : undefined;

  const [[newEnquiries], [appointmentsToday], [waitingNow], [consultationsCompleted], [treatmentPending], [revenueRow]] =
    await Promise.all([
      db
        .select({ c: count() })
        .from(journeys)
        .innerJoin(patients, eq(journeys.patientId, patients.id))
        .where(and(eq(journeys.tenantId, tenantId), gte(journeys.createdAt, start), lt(journeys.createdAt, end), branchClause, journeyTypeClause)),
      db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), apptBranchClause)),
      db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "checked_in"), apptBranchClause)),
      db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "completed"), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), apptBranchClause)),
      db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.outcomeRecorded, true), eq(appointments.treatmentRecommended, true), apptBranchClause)),
      db
        .select({ total: sum(appointments.revenueAmount) })
        .from(appointments)
        .where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "completed"), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), apptBranchClause)),
    ]);

  return {
    newEnquiries: newEnquiries.c,
    appointmentsToday: appointmentsToday.c,
    waitingNow: waitingNow.c,
    consultationsCompleted: consultationsCompleted.c,
    treatmentDecisionsPending: treatmentPending.c,
    attributedRevenue: Number(revenueRow?.total ?? 0),
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

async function getStageReachedCounts(db: Db, tenantId: string, filters: DashboardFilters): Promise<Map<string, number>> {
  const branchClause = filters.branchId ? eq(patients.branchId, filters.branchId) : undefined;
  const journeyTypeClause = filters.journeyType ? eq(journeys.journeyType, filters.journeyType) : undefined;
  const rows = await db
    .select({ stage: journeys.stage, c: count() })
    .from(journeys)
    .innerJoin(patients, eq(journeys.patientId, patients.id))
    .where(and(eq(journeys.tenantId, tenantId), branchClause, journeyTypeClause))
    .groupBy(journeys.stage);

  const counts = new Map(rows.map((r) => [r.stage, r.c]));
  const perStageCounts = CONVERSION_STAGES.map((s) => counts.get(s.key) ?? 0);
  const reached = new Map<string, number>();
  CONVERSION_STAGES.forEach((s, idx) => {
    reached.set(s.key, perStageCounts.slice(idx).reduce((sum, c) => sum + c, 0));
  });
  return reached;
}

export async function getConversionFunnel(db: Db, tenantId: string, filters: DashboardFilters = {}): Promise<ConversionStage[]> {
  const reached = await getStageReachedCounts(db, tenantId, filters);
  return CONVERSION_STAGES.map((s) => ({ key: s.key, label: s.label, count: reached.get(s.key) ?? 0 }));
}

const JOURNEY_HEALTH_STAGES: { key: JourneyHealthKey; label: string }[] = [
  { key: "contacted", label: "Contacted" },
  { key: "booked", label: "Appointment Booked" },
  { key: "attended", label: "Attended" },
  { key: "consulted", label: "Consulted" },
  { key: "treatment_advised", label: "Treatment Converted" },
];

export async function getJourneyHealth(db: Db, tenantId: string, filters: DashboardFilters = {}): Promise<JourneyHealth> {
  const reached = await getStageReachedCounts(db, tenantId, filters);
  const totalJourneys = reached.get("enquiry") ?? 0;

  const segments = JOURNEY_HEALTH_STAGES.map((s) => {
    const c = reached.get(s.key) ?? 0;
    return { key: s.key, label: s.label, count: c, pct: totalJourneys > 0 ? Math.round((c / totalJourneys) * 100) : 0 };
  });

  const overallPct = totalJourneys > 0 ? Math.round(((reached.get("treatment_advised") ?? 0) / totalJourneys) * 100) : 0;

  return { segments, totalJourneys, overallPct };
}

export async function getJourneyPerformanceSeries(
  db: Db,
  tenantId: string,
  days: number,
  filters: DashboardFilters = {},
): Promise<JourneyPerformancePoint[]> {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const branchClause = filters.branchId ? eq(patients.branchId, filters.branchId) : undefined;
  const apptBranchClause = filters.branchId ? eq(appointments.branchId, filters.branchId) : undefined;
  const journeyTypeClause = filters.journeyType ? eq(journeys.journeyType, filters.journeyType) : undefined;

  const enquiryRows = await db
    .select({ day: sql<string>`date_trunc('day', ${journeys.createdAt})::date`, c: count() })
    .from(journeys)
    .innerJoin(patients, eq(journeys.patientId, patients.id))
    .where(and(eq(journeys.tenantId, tenantId), gte(journeys.createdAt, start), lt(journeys.createdAt, end), branchClause, journeyTypeClause))
    .groupBy(sql`date_trunc('day', ${journeys.createdAt})::date`);

  const apptRows = await db
    .select({ day: sql<string>`date_trunc('day', ${appointments.scheduledAt})::date`, c: count() })
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), apptBranchClause))
    .groupBy(sql`date_trunc('day', ${appointments.scheduledAt})::date`);

  const consultRows = await db
    .select({ day: sql<string>`date_trunc('day', ${appointments.scheduledAt})::date`, c: count() })
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "completed"), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), apptBranchClause))
    .groupBy(sql`date_trunc('day', ${appointments.scheduledAt})::date`);

  const treatmentRows = await db
    .select({ day: sql<string>`date_trunc('day', ${appointments.scheduledAt})::date`, c: count() })
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.treatmentRecommended, true), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), apptBranchClause))
    .groupBy(sql`date_trunc('day', ${appointments.scheduledAt})::date`);

  const toMap = (rows: { day: string; c: number }[]) => new Map(rows.map((r) => [new Date(r.day).toISOString().slice(0, 10), r.c]));
  const enquiryMap = toMap(enquiryRows);
  const apptMap = toMap(apptRows);
  const consultMap = toMap(consultRows);
  const treatmentMap = toMap(treatmentRows);

  const points: JourneyPerformancePoint[] = [];
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    points.push({
      date: key,
      enquiries: enquiryMap.get(key) ?? 0,
      appointments: apptMap.get(key) ?? 0,
      consultations: consultMap.get(key) ?? 0,
      treatments: treatmentMap.get(key) ?? 0,
    });
  }
  return points;
}

export async function getPatientFlow(db: Db, tenantId: string, filters: DashboardFilters = {}): Promise<PatientFlowCount[]> {
  const apptBranchClause = filters.branchId ? eq(appointments.branchId, filters.branchId) : undefined;
  const { start, end } = todayRange();

  const rows = await db
    .select({ status: appointments.status, c: count() })
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), apptBranchClause))
    .groupBy(appointments.status);

  const buckets: Record<PatientFlowCount["bucket"], number> = {
    confirmed: 0,
    checked_in: 0,
    with_doctor: 0,
    completed: 0,
  };

  for (const row of rows) {
    if (row.status === "scheduled") buckets.confirmed += row.c;
    else if (row.status === "checked_in") buckets.checked_in += row.c;
    else if (row.status === "with_doctor") buckets.with_doctor += row.c;
    else if (row.status === "completed") buckets.completed += row.c;
  }

  return (Object.keys(buckets) as PatientFlowCount["bucket"][]).map((bucket) => ({ bucket, count: buckets[bucket] }));
}

export async function getAttentionQueue(db: Db, tenantId: string, filters: DashboardFilters = {}): Promise<AttentionItem[]> {
  const branchClause = filters.branchId ? eq(patients.branchId, filters.branchId) : undefined;
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
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending"), sql`${tasks.reason} != 'manual_task'`, branchClause))
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

export async function getSpendAtRisk(db: Db, tenantId: string, filters: DashboardFilters = {}): Promise<SpendAtRisk> {
  const branchClause = filters.branchId ? eq(patients.branchId, filters.branchId) : undefined;

  const [spendRow] = await db.select({ total: sum(sourceSpend.spendAmount) }).from(sourceSpend).where(eq(sourceSpend.tenantId, tenantId));
  const [enquiryRow] = await db.select({ c: count() }).from(journeys).where(eq(journeys.tenantId, tenantId));
  const totalSpend = Number(spendRow?.total ?? 0);
  const totalEnquiries = enquiryRow?.c ?? 0;
  const avgCostPerEnquiry = totalEnquiries > 0 ? totalSpend / totalEnquiries : 0;

  const rows = await db
    .select({ reason: tasks.reason, c: count() })
    .from(tasks)
    .innerJoin(patients, eq(tasks.patientId, patients.id))
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending"), sql`${tasks.reason} != 'manual_task'`, branchClause))
    .groupBy(tasks.reason);

  const byReason = rows.map((r) => ({
    reason: r.reason as AttentionItem["reason"],
    count: r.c,
    estimatedValue: Math.round(avgCostPerEnquiry * r.c),
  }));

  return {
    totalAtRisk: byReason.reduce((sum, r) => sum + r.estimatedValue, 0),
    byReason,
  };
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

  const spendRows = await db.select().from(sourceSpend).where(eq(sourceSpend.tenantId, tenantId));

  const apptMap = new Map(appointmentsBySource.map((r) => [r.source, r]));
  const consultMap = new Map(consultationsBySource.map((r) => [r.source, r.consultations]));
  const treatMap = new Map(treatmentBySource.map((r) => [r.source, r.treatments]));
  const spendMap = new Map(spendRows.map((r) => [r.source, r.spendAmount]));

  return rows.map((r) => {
    const appt = apptMap.get(r.source);
    const revenue = Number(appt?.revenue ?? 0);
    const spend = spendMap.get(r.source) ?? 0;
    return {
      source: r.source,
      volume: r.volume,
      appointments: appt?.appts ?? 0,
      consultations: consultMap.get(r.source) ?? 0,
      treatmentConversion: treatMap.get(r.source) ?? 0,
      revenue,
      spend,
      roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : null,
    };
  });
}

export async function getTeamWorkload(db: Db, tenantId: string, filters: DashboardFilters = {}): Promise<TeamWorkloadRow[]> {
  const branchClause = filters.branchId ? eq(users.branchId, filters.branchId) : undefined;
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      role: users.role,
      openTasks: count(tasks.id),
    })
    .from(users)
    .leftJoin(tasks, and(eq(tasks.assignedTo, users.id), eq(tasks.status, "pending")))
    .where(and(eq(users.tenantId, tenantId), sql`${users.role} IN ('FRONT_DESK', 'PATIENT_COORDINATOR')`, branchClause))
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

export async function getBranchDoctorPerformance(db: Db, tenantId: string, filters: DashboardFilters = {}): Promise<BranchDoctorRow[]> {
  const branchClause = filters.branchId ? eq(users.branchId, filters.branchId) : undefined;
  const rows = await db
    .select({
      doctorId: users.id,
      name: users.name,
      appointments: count(appointments.id),
    })
    .from(users)
    .leftJoin(appointments, eq(appointments.doctorUserId, users.id))
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "DOCTOR"), branchClause))
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
