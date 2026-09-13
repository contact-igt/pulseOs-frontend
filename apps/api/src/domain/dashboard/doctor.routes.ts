import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/permission.middleware.js";
import { getDoctorDashboard } from "./doctor.service.js";

export async function doctorDashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/doctor", { preHandler: requirePermission("VIEW_DOCTOR_COMMAND_CENTRE") }, async (request) => {
    const user = request.sessionUser!;
    return getDoctorDashboard(app.db, user.tenantId, user.id);
  });
}
