import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/permission.middleware.js";
import {
  getAttentionQueue,
  getBranchDoctorPerformance,
  getConversionFunnel,
  getExecutiveStrip,
  getPatientFlow,
  getSourcePerformance,
  getSpendAtRisk,
  getTeamWorkload,
  getTodayStrip,
} from "./dashboard.service.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_ADMIN_COMMAND_CENTRE"));

  app.get("/dashboard/today", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getTodayStrip(app.db, tenantId);
  });

  app.get("/dashboard/executive", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getExecutiveStrip(app.db, tenantId);
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

  app.get("/dashboard/spend-at-risk", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getSpendAtRisk(app.db, tenantId);
  });

  app.get("/dashboard/source-performance", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getSourcePerformance(app.db, tenantId);
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
