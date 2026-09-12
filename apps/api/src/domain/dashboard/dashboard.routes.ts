import type { FastifyInstance } from "fastify";
import {
  getAttentionQueue,
  getBranchDoctorPerformance,
  getConversionFunnel,
  getMarketingSources,
  getPatientFlow,
  getTeamWorkload,
  getTodayStrip,
} from "./dashboard.service.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/today", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getTodayStrip(app.db, tenantId);
  });

  app.get("/dashboard/conversion", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getConversionFunnel(app.db, tenantId);
  });

  app.get("/dashboard/patient-flow", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getPatientFlow(app.db, tenantId);
  });

  app.get("/dashboard/attention", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getAttentionQueue(app.db, tenantId);
  });

  app.get("/dashboard/marketing", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getMarketingSources(app.db, tenantId);
  });

  app.get("/dashboard/team", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getTeamWorkload(app.db, tenantId);
  });

  app.get("/dashboard/branch-doctor", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getBranchDoctorPerformance(app.db, tenantId);
  });
}
