import { and, eq, gte, inArray, lte } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import {
  appointments,
  campaignTouchpoints,
  consultationOutcomes,
  journeys,
  marketingCampaigns,
  patients,
  revenueEvents,
  specialtyTemplates,
  treatmentOpportunities,
} from "../../db/schema.js";
import { costPer, roas as roasOf } from "../marketing/formulas.js";
import { getSpendAtRiskByReason } from "../dashboard/dashboard.service.js";
import type { CampaignFilters, CampaignPerformanceRow, MarketingEfficiencySummary, SpendAtRisk } from "@pulseos/types";

const NON_TERMINAL_TREATMENT = new Set(["ADVISED", "DECISION_PENDING", "ACCEPTED", "SCHEDULED", "COMPLETED"]);

export async function getCampaignPerformance(db: Db, tenantId: string, filters: CampaignFilters): Promise<CampaignPerformanceRow[]> {
  const campaigns = await db
    .select()
    .from(marketingCampaigns)
    .where(and(eq(marketingCampaigns.tenantId, tenantId), filters.source ? eq(marketingCampaigns.source, filters.source) : undefined, filters.campaignId ? eq(marketingCampaigns.id, filters.campaignId) : undefined));

  const specialties = await db.select({ key: specialtyTemplates.key, displayName: specialtyTemplates.displayName }).from(specialtyTemplates).where(eq(specialtyTemplates.tenantId, tenantId));
  const specialtyLabelByKey = new Map(specialties.map((s) => [s.key, s.displayName]));

  const rows: CampaignPerformanceRow[] = [];

  for (const campaign of campaigns) {
    const touchpointRows = await db
      .select({ journeyId: campaignTouchpoints.journeyId })
      .from(campaignTouchpoints)
      .where(and(
        eq(campaignTouchpoints.tenantId, tenantId),
        eq(campaignTouchpoints.campaignId, campaign.id),
        filters.dateFrom ? gte(campaignTouchpoints.occurredAt, new Date(`${filters.dateFrom}T00:00:00.000Z`)) : undefined,
        filters.dateTo ? lte(campaignTouchpoints.occurredAt, new Date(`${filters.dateTo}T23:59:59.999Z`)) : undefined,
      ));
    let journeyIds = touchpointRows.map((r) => r.journeyId);

    if (journeyIds.length > 0 && (filters.specialtyKey || filters.branchId)) {
      const journeyRows = await db
        .select({ id: journeys.id, specialtyKey: journeys.specialtyKey, patientId: journeys.patientId })
        .from(journeys)
        .where(and(eq(journeys.tenantId, tenantId), inArray(journeys.id, journeyIds)));

      let allowedIds = new Set(journeyRows.map((j) => j.id));
      if (filters.specialtyKey) {
        allowedIds = new Set(journeyRows.filter((j) => j.specialtyKey === filters.specialtyKey).map((j) => j.id));
      }
      if (filters.branchId) {
        const patientIds = journeyRows.map((j) => j.patientId);
        const patientRows = patientIds.length ? await db.select({ id: patients.id }).from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.branchId, filters.branchId), inArray(patients.id, patientIds))) : [];
        const patientIdSet = new Set(patientRows.map((p) => p.id));
        const branchAllowed = new Set(journeyRows.filter((j) => patientIdSet.has(j.patientId)).map((j) => j.id));
        allowedIds = filters.specialtyKey ? new Set([...allowedIds].filter((id) => branchAllowed.has(id))) : branchAllowed;
      }
      journeyIds = journeyIds.filter((id) => allowedIds.has(id));
    } else if (filters.specialtyKey || filters.branchId) {
      journeyIds = [];
    }

    if (journeyIds.length === 0) {
      if (filters.specialtyKey || filters.branchId) continue; // no journeys matched these filters for this campaign
      rows.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        source: campaign.source,
        specialtyKey: null,
        specialtyLabel: null,
        spend: campaign.spendAmount,
        leads: 0,
        appointments: 0,
        consultations: 0,
        treatmentAdvised: 0,
        treatmentCompleted: 0,
        revenue: 0,
        cpl: null,
        costPerAppointment: null,
        costPerTreatment: null,
        roas: null,
      });
      continue;
    }

    const [apptCount, consultCount, treatmentRows, revenueRow] = await Promise.all([
      db.select({ c: appointments.id }).from(appointments).where(and(eq(appointments.tenantId, tenantId), inArray(appointments.journeyId, journeyIds))).then((r) => r.length),
      db.select({ c: consultationOutcomes.id }).from(consultationOutcomes).where(and(eq(consultationOutcomes.tenantId, tenantId), inArray(consultationOutcomes.journeyId, journeyIds))).then((r) => r.length),
      db.select({ status: treatmentOpportunities.status }).from(treatmentOpportunities).where(and(eq(treatmentOpportunities.tenantId, tenantId), inArray(treatmentOpportunities.journeyId, journeyIds))),
      db.select({ amount: revenueEvents.amount }).from(revenueEvents).where(and(eq(revenueEvents.tenantId, tenantId), inArray(revenueEvents.journeyId, journeyIds))),
    ]);

    const treatmentAdvised = treatmentRows.filter((t) => NON_TERMINAL_TREATMENT.has(t.status)).length;
    const treatmentCompleted = treatmentRows.filter((t) => t.status === "COMPLETED").length;
    const revenue = revenueRow.reduce((sum, r) => sum + r.amount, 0);

    rows.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      source: campaign.source,
      specialtyKey: filters.specialtyKey ?? null,
      specialtyLabel: filters.specialtyKey ? (specialtyLabelByKey.get(filters.specialtyKey) ?? filters.specialtyKey) : null,
      spend: campaign.spendAmount,
      leads: journeyIds.length,
      appointments: apptCount,
      consultations: consultCount,
      treatmentAdvised,
      treatmentCompleted,
      revenue,
      cpl: costPer(campaign.spendAmount, journeyIds.length),
      costPerAppointment: costPer(campaign.spendAmount, apptCount),
      costPerTreatment: costPer(campaign.spendAmount, treatmentCompleted),
      roas: roasOf(revenue, campaign.spendAmount),
    });
  }

  return rows.sort((a, b) => b.spend - a.spend);
}

export async function getMarketingEfficiency(db: Db, tenantId: string, filters: CampaignFilters): Promise<MarketingEfficiencySummary> {
  const rows = await getCampaignPerformance(db, tenantId, filters);
  const spend = rows.reduce((sum, r) => sum + r.spend, 0);
  const leads = rows.reduce((sum, r) => sum + r.leads, 0);
  const appointmentsCount = rows.reduce((sum, r) => sum + r.appointments, 0);
  const consultations = rows.reduce((sum, r) => sum + r.consultations, 0);
  const treatments = rows.reduce((sum, r) => sum + r.treatmentCompleted, 0);
  const revenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  return {
    spend,
    leads,
    appointments: appointmentsCount,
    consultations,
    treatments,
    revenue,
    roas: roasOf(revenue, spend),
    cpl: costPer(spend, leads),
    costPerAppointment: costPer(spend, appointmentsCount),
    costPerTreatment: costPer(spend, treatments),
  };
}

export async function getCampaignSpendAtRisk(db: Db, tenantId: string): Promise<SpendAtRisk> {
  return getSpendAtRiskByReason(db, tenantId);
}
