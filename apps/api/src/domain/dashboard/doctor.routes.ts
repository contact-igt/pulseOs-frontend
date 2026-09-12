import type { FastifyInstance } from "fastify";
import { getDoctorDashboard } from "./doctor.service.js";

export async function doctorDashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/doctor", async (request, reply) => {
    const user = request.sessionUser!;
    if (user.role !== "DOCTOR") {
      return reply.status(403).send({ error: "doctor_role_required" });
    }
    return getDoctorDashboard(app.db, user.tenantId, user.id);
  });
}
