import { and, count, eq, gte, inArray, lt, sql, sum, isNull, isNotNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import {
  appointments,
  campaignTouchpoints,
  consultationOutcomes,
  journeys,
  marketingCampaigns,
  patients,
  revenueEvents,
  tasks,
  treatmentOpportunities,
  users,
} from "../../db/schema.js";
import { allocatedAcquisitionCost, costPer, roas as roasOf } from "../marketing/formulas.js";
import type {
  AttentionItem,
  BranchDoctorRow,
  ConversionStage,
  ExecutiveStrip,
  PatientFlowCount,
  SourcePerformanceRow,
  SpendAtRiskCategory,
  SpendAtRiskCategoryKey,
  SpendAtRiskSummary,
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
      db.select({ c: count() }).from(treatmentOpportunities).where(and(eq(treatmentOpportunities.tenantId, tenantId), eq(treatmentOpportunities.status, "DECISION_PENDING"))),
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

/**
 * Total marketing spend across all of a tenant's campaigns — the denominator
 * for every cost-per-outcome and ROAS figure on the dashboard.
 */
async function getTotalSpend(db: Db, tenantId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(marketingCampaigns.spendAmount) })
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.tenantId, tenantId));
  return Number(row?.total ?? 0);
}

export async function getExecutiveStrip(db: Db, tenantId: string): Promise<ExecutiveStrip> {
  const [spend, [enquiries], [consultations], [treatmentsCompleted], [revenue], spendAtRisk] = await Promise.all([
    getTotalSpend(db, tenantId),
    db.select({ c: count() }).from(journeys).where(eq(journeys.tenantId, tenantId)),
    db.select({ c: count() }).from(consultationOutcomes).where(eq(consultationOutcomes.tenantId, tenantId)),
    db.select({ c: count() }).from(treatmentOpportunities).where(and(eq(treatmentOpportunities.tenantId, tenantId), eq(treatmentOpportunities.status, "COMPLETED"))),
    db.select({ total: sum(revenueEvents.amount) }).from(revenueEvents).where(eq(revenueEvents.tenantId, tenantId)),
    getSpendAtRisk(db, tenantId),
  ]);

  const attributedRevenue = Number(revenue?.total ?? 0);

  return {
    marketingSpend: spend,
    enquiries: enquiries.c,
    consultations: consultations.c,
    treatmentsCompleted: treatmentsCompleted.c,
    attributedRevenue,
    roas: roasOf(attributedRevenue, spend),
    spendAtRisk: spendAtRisk.total,
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

// Stages that get a "cost per outcome" figure — the ones a hospital admin
// actually reasons about acquisition cost against.
const COST_TRACKED_STAGES = new Set<ConversionStage["key"]>(["enquiry", "booked", "consulted", "completed"]);

export async function getConversionFunnel(db: Db, tenantId: string): Promise<ConversionStage[]> {
  const rows = await db
    .select({ stage: journeys.stage, c: count() })
    .from(journeys)
    .where(eq(journeys.tenantId, tenantId))
    .groupBy(journeys.stage);

  const counts = new Map(rows.map((r) => [r.stage, r.c]));
  const totalSpend = await getTotalSpend(db, tenantId);

  // A journey's current stage implies it has passed through every earlier stage
  // (lost/declined journeys are excluded from the funnel, not counted at any stage).
  // So funnel[i] = number of journeys whose current stage index is >= i.
  const perStageCounts = CONVERSION_STAGES.map((s) => counts.get(s.key) ?? 0);
  return CONVERSION_STAGES.map((s, idx) => {
    const reachedOrPast = perStageCounts.slice(idx).reduce((sum, c) => sum + c, 0);
    return {
      key: s.key,
      label: s.label,
      count: reachedOrPast,
      costPerOutcome: COST_TRACKED_STAGES.has(s.key) ? costPer(totalSpend, reachedOrPast) : null,
    };
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

// Spend-At-Risk categories map 1:1 onto the existing task-reason catalog —
// each reason IS an operational failure keeping acquisition spend unrealized.
export const SPEND_AT_RISK_CATEGORIES: { key: SpendAtRiskCategoryKey; label: string; taskReason: string }[] = [
  { key: "uncontacted", label: "Uncontacted", taskReason: "high_intent_uncontacted" },
  { key: "overdue_follow_up", label: "Overdue follow-up", taskReason: "overdue_callback" },
  { key: "no_show_recovery", label: "No-show recovery", taskReason: "no_show" },
  { key: "treatment_decision_pending", label: "Treatment decision pending", taskReason: "treatment_decision_pending" },
  { key: "post_consultation_follow_up_overdue", label: "Post-consultation follow-up overdue", taskReason: "missed_follow_up" },
];

/**
 * A journey's allocated acquisition cost = its attributed campaign's average
 * cost-per-enquiry (campaign spend / campaign enquiry count). Journeys with
 * no campaign touchpoint (organic/walk-in/referral) allocate 0 — there is no
 * spend to protect. See north-star addendum §"Spend At Risk" for the formula.
 */
async function getCampaignAllocationByJourney(db: Db, tenantId: string): Promise<Map<string, number>> {
  const campaignEnquiryCounts = await db
    .select({ campaignId: campaignTouchpoints.campaignId, c: count() })
    .from(campaignTouchpoints)
    .where(and(eq(campaignTouchpoints.tenantId, tenantId), isNotNull(campaignTouchpoints.campaignId)))
    .groupBy(campaignTouchpoints.campaignId);
  const enquiryCountMap = new Map(campaignEnquiryCounts.map((r) => [r.campaignId as string, r.c]));

  const campaigns = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.tenantId, tenantId));
  const allocationByCampaign = new Map<string, number>();
  for (const c of campaigns) {
    const alloc = allocatedAcquisitionCost(c.spendAmount, enquiryCountMap.get(c.id) ?? 0);
    allocationByCampaign.set(c.id, alloc ?? 0);
  }

  const touchpoints = await db
    .select({ journeyId: campaignTouchpoints.journeyId, campaignId: campaignTouchpoints.campaignId })
    .from(campaignTouchpoints)
    .where(and(eq(campaignTouchpoints.tenantId, tenantId), eq(campaignTouchpoints.touchType, "first_touch")));

  const byJourney = new Map<string, number>();
  for (const tp of touchpoints) {
    if (tp.campaignId) byJourney.set(tp.journeyId, allocationByCampaign.get(tp.campaignId) ?? 0);
  }
  return byJourney;
}

export async function getSpendAtRisk(db: Db, tenantId: string): Promise<SpendAtRiskSummary> {
  const allocationByJourney = await getCampaignAllocationByJourney(db, tenantId);
  const now = Date.now();

  const categories: SpendAtRiskCategory[] = [];
  for (const cat of SPEND_AT_RISK_CATEGORIES) {
    const rows = await db
      .select({ journeyId: tasks.journeyId, dueAt: tasks.dueAt })
      .from(tasks)
      .where(and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending"), eq(tasks.reason, cat.taskReason as (typeof tasks.reason.enumValues)[number])));

    let allocatedSpend = 0;
    let oldestAgeDays = 0;
    for (const row of rows) {
      if (row.journeyId) allocatedSpend += allocationByJourney.get(row.journeyId) ?? 0;
      const ageDays = Math.max(0, Math.floor((now - row.dueAt.getTime()) / 86_400_000));
      if (ageDays > oldestAgeDays) oldestAgeDays = ageDays;
    }

    categories.push({ key: cat.key, label: cat.label, journeyCount: rows.length, allocatedSpend, oldestAgeDays });
  }

  return { total: categories.reduce((sum, c) => sum + c.allocatedSpend, 0), categories };
}

export async function getSourcePerformance(db: Db, tenantId: string): Promise<SourcePerformanceRow[]> {
  const campaigns = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.tenantId, tenantId));

  const rows: SourcePerformanceRow[] = [];
  for (const campaign of campaigns) {
    const journeyIdsResult = await db
      .select({ journeyId: campaignTouchpoints.journeyId })
      .from(campaignTouchpoints)
      .where(and(eq(campaignTouchpoints.tenantId, tenantId), eq(campaignTouchpoints.campaignId, campaign.id)));
    const journeyIds = journeyIdsResult.map((r) => r.journeyId);
    if (journeyIds.length === 0) {
      rows.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        source: campaign.source,
        spend: campaign.spendAmount,
        enquiries: 0,
        appointments: 0,
        consultations: 0,
        treatments: 0,
        revenue: 0,
        roas: null,
      });
      continue;
    }

    const [[apptCount], [consultCount], [treatCount], [revenueRow]] = await Promise.all([
      db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), inArray(appointments.journeyId, journeyIds))),
      db.select({ c: count() }).from(consultationOutcomes).where(and(eq(consultationOutcomes.tenantId, tenantId), inArray(consultationOutcomes.journeyId, journeyIds))),
      db.select({ c: count() }).from(treatmentOpportunities).where(and(eq(treatmentOpportunities.tenantId, tenantId), eq(treatmentOpportunities.status, "COMPLETED"), inArray(treatmentOpportunities.journeyId, journeyIds))),
      db.select({ total: sum(revenueEvents.amount) }).from(revenueEvents).where(and(eq(revenueEvents.tenantId, tenantId), inArray(revenueEvents.journeyId, journeyIds))),
    ]);

    const revenue = Number(revenueRow?.total ?? 0);
    rows.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      source: campaign.source,
      spend: campaign.spendAmount,
      enquiries: journeyIds.length,
      appointments: apptCount.c,
      consultations: consultCount.c,
      treatments: treatCount.c,
      revenue,
      roas: roasOf(revenue, campaign.spendAmount),
    });
  }

  return rows.sort((a, b) => b.spend - a.spend);
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
