import type { FastifyInstance } from "fastify";
import { editionHasCapability } from "@pulseos/types";
import { requireCapability, requirePermission } from "../auth/permission.middleware.js";
import {
  getAttentionQueue,
  getBranchDoctorPerformance,
  getConversionFunnel,
  getExecutiveStrip,
  getJourneyHealth,
  getMarketingSources,
  getPatientFlow,
  getServiceMix,
  getSourcePerformance,
  getSpendAtRisk,
  getSpendAtRiskByReason,
  getTeamWorkload,
  getTodayStrip,
  listBranches,
  listJourneyTypes,
} from "./dashboard.service.js";

function dashboardFilters(request: { query: unknown }) {
  const query = request.query as { branchId?: string; journeyType?: string };
  const filters: { branchId?: string; journeyType?: string } = {};
  if (query.branchId) filters.branchId = query.branchId;
  if (query.journeyType) filters.journeyType = query.journeyType;
  return filters;
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_ADMIN_COMMAND_CENTRE"));

  app.get("/branches", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return listBranches(app.db, tenantId);
  });

  app.get("/journey-types", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return listJourneyTypes(app.db, tenantId);
  });

  app.get("/dashboard/today", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getTodayStrip(app.db, tenantId, dashboardFilters(request), request.sessionUser!.timezone);
  });

  app.get("/dashboard/executive", { preHandler: requireCapability("SPEND_ATTRIBUTION") }, async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getExecutiveStrip(app.db, tenantId);
  });

  app.get("/dashboard/conversion", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const stages = await getConversionFunnel(app.db, tenantId, dashboardFilters(request));
    // Cost per outcome is derived from marketing spend, which a Beta V1 tenant does not see.
    return editionHasCapability(request.sessionUser!.edition, "SPEND_ATTRIBUTION") ? stages : stages.map((s) => ({ ...s, costPerOutcome: null }));
  });

  app.get("/dashboard/journey-health", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getJourneyHealth(app.db, tenantId, dashboardFilters(request));
  });

  app.get("/dashboard/patient-flow", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getPatientFlow(app.db, tenantId, dashboardFilters(request), request.sessionUser!.timezone);
  });

  app.get("/dashboard/attention", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getAttentionQueue(app.db, tenantId, dashboardFilters(request));
  });

  app.get("/dashboard/spend-at-risk", { preHandler: requireCapability("SPEND_ATTRIBUTION") }, async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getSpendAtRisk(app.db, tenantId);
  });

  app.get("/dashboard/spend-at-risk-by-reason", { preHandler: requireCapability("SPEND_ATTRIBUTION") }, async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getSpendAtRiskByReason(app.db, tenantId);
  });

  app.get("/dashboard/source-performance", { preHandler: requireCapability("SPEND_ATTRIBUTION") }, async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getSourcePerformance(app.db, tenantId);
  });

  app.get("/dashboard/marketing", { preHandler: requireCapability("SPEND_ATTRIBUTION") }, async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getMarketingSources(app.db, tenantId);
  });

  app.get("/dashboard/team", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getTeamWorkload(app.db, tenantId, dashboardFilters(request));
  });

  app.get("/dashboard/branch-doctor", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getBranchDoctorPerformance(app.db, tenantId, dashboardFilters(request));
  });

  app.get("/dashboard/service-mix", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getServiceMix(app.db, tenantId, dashboardFilters(request));
  });
}
