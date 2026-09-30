import { and, count, eq, gte, inArray, lt, sql, sum, isNotNull } from "drizzle-orm";
import { hospitalTodayBounds } from "../../lib/hospital-time.js";
import type { Db } from "../../db/client.js";
import {
  appointments,
  branches,
  campaignTouchpoints,
  connectors,
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
  Branch,
  BranchDoctorRow,
  ConversionStage,
  ExecutiveStrip,
  JourneyHealth,
  JourneyHealthKey,
  MarketingSourceRow,
  PatientFlowCount,
  ServiceMixRow,
  SourcePerformanceRow,
  SpendAtRisk,
  SpendAtRiskCategory,
  SpendAtRiskCategoryKey,
  SpendAtRiskSummary,
  TeamWorkloadRow,
  TodayStrip,
} from "@pulseos/types";

export interface DashboardFilters {
  branchId?: string;
  journeyType?: string;
}

export async function listBranches(db: Db, tenantId: string): Promise<Branch[]> {
  const rows = await db.select().from(branches).where(eq(branches.tenantId, tenantId));
  return rows.map((r) => ({ id: r.id, name: r.name, city: r.city }));
}

export async function listJourneyTypes(db: Db, tenantId: string): Promise<string[]> {
  const rows = await db.selectDistinct({ journeyType: journeys.journeyType }).from(journeys).where(eq(journeys.tenantId, tenantId));
  return rows.map((r) => r.journeyType).sort();
}

export async function getTodayStrip(db: Db, tenantId: string, filters: DashboardFilters, timezone: string): Promise<TodayStrip> {
  const { start, end } = hospitalTodayBounds(timezone);
  const branchClause = filters.branchId ? eq(patients.branchId, filters.branchId) : undefined;
  const apptBranchClause = filters.branchId ? eq(appointments.branchId, filters.branchId) : undefined;
  const journeyTypeClause = filters.journeyType ? eq(journeys.journeyType, filters.journeyType) : undefined;

  const [[newEnquiries], [appointmentsToday], [waitingNow], [consultationsCompleted], [treatmentPending], [revenueRow]] = await Promise.all([
    db
      .select({ c: count() })
      .from(journeys)
      .innerJoin(patients, eq(journeys.patientId, patients.id))
      .where(and(eq(journeys.tenantId, tenantId), gte(journeys.createdAt, start), lt(journeys.createdAt, end), branchClause, journeyTypeClause)),
    db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), apptBranchClause)),
    db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), inArray(appointments.status, ["checked_in", "waiting"]), apptBranchClause)),
    db.select({ c: count() }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "completed"), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), apptBranchClause)),
    db.select({ c: count() }).from(treatmentOpportunities).where(and(eq(treatmentOpportunities.tenantId, tenantId), eq(treatmentOpportunities.status, "DECISION_PENDING"))),
    db.select({ total: sum(revenueEvents.amount) }).from(revenueEvents).where(and(eq(revenueEvents.tenantId, tenantId), gte(revenueEvents.occurredAt, start), lt(revenueEvents.occurredAt, end))),
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
  // "lost" is not a funnel stage, but every lost journey began as an enquiry —
  // it counts at the top so Enquiry equals total journeys (and the Enquiries
  // KPI). No furthest-stage history is stored, so it is never credited to a
  // later stage.
  reached.set("enquiry", (reached.get("enquiry") ?? 0) + (counts.get("lost") ?? 0));
  return reached;
}

export async function getConversionFunnel(db: Db, tenantId: string, filters: DashboardFilters = {}): Promise<ConversionStage[]> {
  const reached = await getStageReachedCounts(db, tenantId, filters);
  const totalSpend = await getTotalSpend(db, tenantId);
  return CONVERSION_STAGES.map((s) => {
    const c = reached.get(s.key) ?? 0;
    return { key: s.key, label: s.label, count: c, costPerOutcome: COST_TRACKED_STAGES.has(s.key) ? costPer(totalSpend, c) : null };
  });
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


export async function getPatientFlow(db: Db, tenantId: string, filters: DashboardFilters, timezone: string): Promise<PatientFlowCount[]> {
  const apptBranchClause = filters.branchId ? eq(appointments.branchId, filters.branchId) : undefined;
  const { start, end } = hospitalTodayBounds(timezone);

  const rows = await db
    .select({ status: appointments.status, c: count() })
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), apptBranchClause))
    .groupBy(appointments.status);

  const buckets: Record<PatientFlowCount["bucket"], number> = {
    confirmed: 0,
    checked_in: 0,
    waiting: 0,
    with_doctor: 0,
    completed: 0,
  };

  for (const row of rows) {
    if (row.status === "scheduled" || row.status === "confirmed" || row.status === "requested") buckets.confirmed += row.c;
    else if (row.status === "checked_in") buckets.checked_in += row.c;
    else if (row.status === "waiting") buckets.waiting += row.c;
    else if (row.status === "with_doctor") buckets.with_doctor += row.c;
    else if (row.status === "completed") buckets.completed += row.c;
  }

  return (Object.keys(buckets) as PatientFlowCount["bucket"][]).map((bucket) => ({ bucket, count: buckets[bucket] }));
}

// The Attention Queue is specifically the SLA-style "already late or stalled"
// set — not every task reason belongs here. Whitelisted (not "!= manual_task")
// so a future Task-only reason (like "new_lead": a fresh, not-yet-due
// first-response task, not something stalled) is excluded by default instead
// of silently reaching AttentionItem with no matching label — that exact gap
// happened once already when "new_lead" was added but this query wasn't.
const ATTENTION_TASK_REASONS: AttentionItem["reason"][] = [
  "overdue_callback",
  "missed_follow_up",
  "no_show",
  "high_intent_uncontacted",
  "treatment_decision_pending",
];

export async function getAttentionQueue(db: Db, tenantId: string, filters: DashboardFilters = {}): Promise<AttentionItem[]> {
  const branchClause = filters.branchId ? eq(patients.branchId, filters.branchId) : undefined;
  const rows = await db
    .select({
      id: tasks.id,
      patientId: tasks.patientId,
      journeyId: tasks.journeyId,
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
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending"), inArray(tasks.reason, ATTENTION_TASK_REASONS), branchClause))
    .orderBy(tasks.dueAt)
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    journeyId: r.journeyId,
    patientName: r.patientName,
    journeyType: r.journeyType ?? "general",
    reason: r.reason as AttentionItem["reason"],
    dueAt: r.dueAt.toISOString(),
    ownerName: r.ownerName,
  }));
}

// Spend-At-Risk categories map onto 5 of the task-reason catalog's stalled/
// overdue reasons (the same set ATTENTION_TASK_REASONS above whitelists) —
// each IS an operational failure keeping acquisition spend unrealized.
// Task-only reasons that aren't a stall (manual_task, new_lead) are
// deliberately excluded, not merely uncovered.
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

/** Same underlying task-reason categories as getSpendAtRisk, reshaped as {reason, count, estimatedValue} for the segmented-bar Spend At Risk visual. */
export async function getSpendAtRiskByReason(db: Db, tenantId: string): Promise<SpendAtRisk> {
  const summary = await getSpendAtRisk(db, tenantId);
  const byReason = summary.categories.map((c) => {
    const cat = SPEND_AT_RISK_CATEGORIES.find((x) => x.key === c.key)!;
    return { reason: cat.taskReason as AttentionItem["reason"], count: c.journeyCount, estimatedValue: c.allocatedSpend };
  });
  return { totalAtRisk: summary.total, byReason };
}

export async function getSourcePerformance(db: Db, tenantId: string): Promise<SourcePerformanceRow[]> {
  const campaigns = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.tenantId, tenantId));

  // A synced campaign's numbers are only as real as the connector that
  // produced them — one lookup up front rather than N, joined in below so
  // the UI can distinguish FIXTURE/SANDBOX from LIVE-synced spend.
  const connectorModeById = new Map(
    (await db.select({ id: connectors.id, mode: connectors.mode }).from(connectors).where(eq(connectors.tenantId, tenantId))).map((c) => [c.id, c.mode]),
  );

  const rows: SourcePerformanceRow[] = [];
  for (const campaign of campaigns) {
    const connectorMode = campaign.connectorId ? (connectorModeById.get(campaign.connectorId) ?? null) : null;
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
        connectorMode,
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
      connectorMode,
    });
  }

  return rows.sort((a, b) => b.spend - a.spend);
}

/** Simpler, non-campaign-scoped sibling of getSourcePerformance, grouped by raw source channel — feeds the flagship Source Performance table variant. */
export async function getMarketingSources(db: Db, tenantId: string): Promise<MarketingSourceRow[]> {
  const rows = await getSourcePerformance(db, tenantId);
  const bySource = new Map<string, MarketingSourceRow>();
  for (const r of rows) {
    const existing = bySource.get(r.source);
    if (existing) {
      existing.volume += r.enquiries;
      existing.appointments += r.appointments;
      existing.consultations += r.consultations;
      existing.treatmentConversion += r.treatments;
      existing.revenue += r.revenue;
      existing.spend += r.spend;
    } else {
      bySource.set(r.source, {
        source: r.source,
        volume: r.enquiries,
        appointments: r.appointments,
        consultations: r.consultations,
        treatmentConversion: r.treatments,
        revenue: r.revenue,
        spend: r.spend,
        roas: null,
      });
    }
  }
  for (const row of bySource.values()) {
    row.roas = row.spend > 0 ? Number((row.revenue / row.spend).toFixed(2)) : null;
  }
  return Array.from(bySource.values());
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
    .where(and(eq(appointments.tenantId, tenantId), inArray(appointments.status, ["checked_in", "waiting"])))
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

const PIPELINE_TREATMENT_STATUSES = ["ADVISED", "DECISION_PENDING", "ACCEPTED", "SCHEDULED"] as const;

/**
 * Per service line (journey type): volume, pipeline and revenue side by side,
 * so the Command Centre can show which services actually convert — three
 * grouped queries, never one per service.
 */
export async function getServiceMix(db: Db, tenantId: string, filters: DashboardFilters = {}): Promise<ServiceMixRow[]> {
  const branchClause = filters.branchId ? eq(patients.branchId, filters.branchId) : undefined;

  const journeyRows = await db
    .select({
      service: journeys.journeyType,
      total: count(),
      active: sql<number>`count(*) filter (where ${journeys.stage} not in ('completed', 'lost'))`,
    })
    .from(journeys)
    .innerJoin(patients, eq(journeys.patientId, patients.id))
    .where(and(eq(journeys.tenantId, tenantId), branchClause))
    .groupBy(journeys.journeyType);

  const treatmentRows = await db
    .select({
      service: journeys.journeyType,
      pipeline: sql<number>`count(*) filter (where ${inArray(treatmentOpportunities.status, [...PIPELINE_TREATMENT_STATUSES])})`,
      completed: sql<number>`count(*) filter (where ${treatmentOpportunities.status} = 'COMPLETED')`,
    })
    .from(treatmentOpportunities)
    .innerJoin(journeys, eq(treatmentOpportunities.journeyId, journeys.id))
    .innerJoin(patients, eq(journeys.patientId, patients.id))
    .where(and(eq(treatmentOpportunities.tenantId, tenantId), branchClause))
    .groupBy(journeys.journeyType);

  const revenueRows = await db
    .select({ service: journeys.journeyType, total: sum(revenueEvents.amount) })
    .from(revenueEvents)
    .innerJoin(journeys, eq(revenueEvents.journeyId, journeys.id))
    .innerJoin(patients, eq(journeys.patientId, patients.id))
    .where(and(eq(revenueEvents.tenantId, tenantId), branchClause))
    .groupBy(journeys.journeyType);

  const treatmentsBy = new Map(treatmentRows.map((r) => [r.service, r]));
  const revenueBy = new Map(revenueRows.map((r) => [r.service, Number(r.total ?? 0)]));

  return journeyRows
    .map((r) => ({
      service: r.service,
      journeys: r.total,
      activeJourneys: Number(r.active),
      treatmentsInPipeline: Number(treatmentsBy.get(r.service)?.pipeline ?? 0),
      treatmentsCompleted: Number(treatmentsBy.get(r.service)?.completed ?? 0),
      revenue: revenueBy.get(r.service) ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.journeys - a.journeys);
}
