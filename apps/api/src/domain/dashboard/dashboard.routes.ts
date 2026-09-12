import type { FastifyInstance } from "fastify";
import {
  getAttentionQueue,
  getBranchDoctorPerformance,
  getConversionFunnel,
  getJourneyHealth,
  getJourneyPerformanceSeries,
  getMarketingSources,
  getPatientFlow,
  getSpendAtRisk,
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
    return getTodayStrip(app.db, tenantId, dashboardFilters(request));
  });

  app.get("/dashboard/conversion", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getConversionFunnel(app.db, tenantId, dashboardFilters(request));
  });

  app.get("/dashboard/journey-health", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getJourneyHealth(app.db, tenantId, dashboardFilters(request));
  });

  app.get("/dashboard/journey-performance", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as { days?: string };
    const days = query.days ? Math.min(Math.max(Number(query.days) || 14, 1), 90) : 14;
    return getJourneyPerformanceSeries(app.db, tenantId, days, dashboardFilters(request));
  });

  app.get("/dashboard/patient-flow", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getPatientFlow(app.db, tenantId, dashboardFilters(request));
  });

  app.get("/dashboard/attention", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getAttentionQueue(app.db, tenantId, dashboardFilters(request));
  });

  app.get("/dashboard/spend-at-risk", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getSpendAtRisk(app.db, tenantId, dashboardFilters(request));
  });

  app.get("/dashboard/marketing", async (request) => {
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
}
