import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import {
  appointments,
  branches,
  campaignTouchpoints,
  journeys,
  marketingCampaigns,
  patients,
  tasks,
  timelineEvents,
  treatmentOpportunities,
  users,
} from "../../db/schema.js";
import { allocatedAcquisitionCost } from "../marketing/formulas.js";
import type { JourneyListRow, JourneysSummary } from "@pulseos/types";
import { getSpendAtRisk } from "../dashboard/dashboard.service.js";

export interface JourneyFilters {
  source?: string;
  campaignId?: string;
  branchId?: string;
  stage?: string;
  ownerId?: string;
  doctorId?: string;
}

export async function listJourneys(db: Db, tenantId: string, filters: JourneyFilters): Promise<JourneyListRow[]> {
  const rows = await db
    .select({
      id: journeys.id,
      patientId: journeys.patientId,
      patientName: patients.name,
      journeyType: journeys.journeyType,
      source: journeys.source,
      stage: journeys.stage,
      branchName: branches.name,
      ownerName: users.name,
      createdAt: journeys.createdAt,
    })
    .from(journeys)
    .innerJoin(patients, eq(journeys.patientId, patients.id))
    .leftJoin(branches, eq(patients.branchId, branches.id))
    .leftJoin(users, eq(journeys.ownerUserId, users.id))
    .where(
      and(
        eq(journeys.tenantId, tenantId),
        filters.source ? eq(journeys.source, filters.source as (typeof journeys.source.enumValues)[number]) : undefined,
        filters.stage ? eq(journeys.stage, filters.stage as (typeof journeys.stage.enumValues)[number]) : undefined,
        filters.ownerId ? eq(journeys.ownerUserId, filters.ownerId) : undefined,
      ),
    );

  const touchpointRows = await db
    .select({ journeyId: campaignTouchpoints.journeyId, campaignId: campaignTouchpoints.campaignId })
    .from(campaignTouchpoints)
    .where(and(eq(campaignTouchpoints.tenantId, tenantId), eq(campaignTouchpoints.touchType, "first_touch")));
  const campaignByJourney = new Map(touchpointRows.map((t) => [t.journeyId, t.campaignId]));

  const campaigns = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.tenantId, tenantId));
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  const enquiryCounts = await db
    .select({ campaignId: campaignTouchpoints.campaignId, journeyId: campaignTouchpoints.journeyId })
    .from(campaignTouchpoints)
    .where(eq(campaignTouchpoints.tenantId, tenantId));
  const enquiryCountByCampaign = new Map<string, number>();
  for (const e of enquiryCounts) {
    if (!e.campaignId) continue;
    enquiryCountByCampaign.set(e.campaignId, (enquiryCountByCampaign.get(e.campaignId) ?? 0) + 1);
  }

  const doctorRows = await db
    .select({ journeyId: appointments.journeyId, doctorName: users.name, scheduledAt: appointments.scheduledAt })
    .from(appointments)
    .leftJoin(users, eq(appointments.doctorUserId, users.id))
    .where(eq(appointments.tenantId, tenantId));
  const doctorByJourney = new Map<string, string | null>();
  const latestApptByJourney = new Map<string, Date>();
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
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending")));
  const nextActionByJourney = new Map<string, Date>();
  for (const t of taskRows) {
    if (!t.journeyId) continue;
    const existing = nextActionByJourney.get(t.journeyId);
    if (!existing || t.dueAt < existing) nextActionByJourney.set(t.journeyId, t.dueAt);
  }

  const treatmentRows = await db
    .select({ journeyId: treatmentOpportunities.journeyId, estimatedValue: treatmentOpportunities.estimatedValue })
    .from(treatmentOpportunities)
    .where(eq(treatmentOpportunities.tenantId, tenantId));
  const treatmentValueByJourney = new Map<string, number>();
  for (const t of treatmentRows) {
    treatmentValueByJourney.set(t.journeyId, (treatmentValueByJourney.get(t.journeyId) ?? 0) + t.estimatedValue);
  }

  const timelineRows = await db
    .select({ journeyId: timelineEvents.journeyId, occurredAt: timelineEvents.occurredAt })
    .from(timelineEvents)
    .where(eq(timelineEvents.tenantId, tenantId));
  const lastActivityByJourney = new Map<string, Date>();
  for (const t of timelineRows) {
    if (!t.journeyId) continue;
    const existing = lastActivityByJourney.get(t.journeyId);
    if (!existing || t.occurredAt > existing) lastActivityByJourney.set(t.journeyId, t.occurredAt);
  }

  const withCampaign = rows.map((r) => {
    const campaignId = campaignByJourney.get(r.id) ?? null;
    const campaign = campaignId ? campaignById.get(campaignId) : undefined;
    const acquisitionCost = campaign ? allocatedAcquisitionCost(campaign.spendAmount, enquiryCountByCampaign.get(campaign.id) ?? 0) : null;

    const row: JourneyListRow = {
      id: r.id,
      patientId: r.patientId,
      patientName: r.patientName,
      journeyType: r.journeyType,
      source: r.source,
      campaignName: campaign?.name ?? null,
      stage: r.stage,
      branchName: r.branchName,
      doctorName: doctorByJourney.get(r.id) ?? null,
      ownerName: r.ownerName,
      lastActivityAt: (lastActivityByJourney.get(r.id) ?? r.createdAt).toISOString(),
      nextActionDueAt: nextActionByJourney.get(r.id)?.toISOString() ?? null,
      acquisitionCost,
      treatmentValue: treatmentValueByJourney.get(r.id) ?? 0,
    };
    return { row, campaignId };
  });

  return withCampaign.filter((x) => !filters.campaignId || x.campaignId === filters.campaignId).map((x) => x.row);
}

export async function getJourneysSummary(db: Db, tenantId: string): Promise<JourneysSummary> {
  const [[active], [apptPending], [consultPending], [treatPending], treatmentRows, spendAtRisk] = await Promise.all([
    db.select({ c: journeys.id }).from(journeys).where(eq(journeys.tenantId, tenantId)).then((r) => [{ c: r.length }]),
    db.select({ c: appointments.id }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "scheduled"))).then((r) => [{ c: r.length }]),
    db.select({ c: appointments.id }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "checked_in"))).then((r) => [{ c: r.length }]),
    db.select({ c: treatmentOpportunities.id }).from(treatmentOpportunities).where(and(eq(treatmentOpportunities.tenantId, tenantId), eq(treatmentOpportunities.status, "DECISION_PENDING"))).then((r) => [{ c: r.length }]),
    db.select({ estimatedValue: treatmentOpportunities.estimatedValue }).from(treatmentOpportunities).where(and(eq(treatmentOpportunities.tenantId, tenantId), eq(treatmentOpportunities.status, "ADVISED"))),
    getSpendAtRisk(db, tenantId),
  ]);

  return {
    activeJourneys: active.c,
    appointmentsPending: apptPending.c,
    consultationsPending: consultPending.c,
    treatmentDecisionsPending: treatPending.c,
    revenueOpportunity: treatmentRows.reduce((sum, t) => sum + t.estimatedValue, 0),
    spendAtRisk: spendAtRisk.total,
  };
}
