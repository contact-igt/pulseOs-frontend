import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppointmentAction, AppointmentStatus } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import {
  applyAppointmentAction,
  completeAppointment,
  createAppointment,
  getFrontDeskDashboard,
  listAppointments,
  rescheduleAppointment,
} from "./appointment.service.js";

const createAppointmentBody = z.object({
  patientId: z.string().uuid(),
  journeyId: z.string().uuid(),
  branchId: z.string().uuid(),
  doctorId: z.string().uuid(),
  scheduledAt: z.string(),
  reason: z.string().optional(),
});

const REASON_STATUS: Record<string, number> = {
  appointment_not_found: 404,
  appointment_closed: 409,
  not_with_doctor: 409,
  invalid_transition: 409,
};

export async function appointmentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_APPOINTMENTS"));

  app.get("/appointments", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as { branchId?: string; doctorId?: string; status?: AppointmentStatus; date?: string; search?: string };
    return listAppointments(app.db, tenantId, query);
  });

  app.get("/front-desk", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as { branchId?: string };
    return getFrontDeskDashboard(app.db, tenantId, query.branchId);
  });

  await app.register(async (manageApp) => {
    manageApp.addHook("preHandler", requirePermission("MANAGE_APPOINTMENTS"));

    manageApp.post("/appointments", async (request, reply) => {
      const tenantId = request.sessionUser!.tenantId;
      const actorId = request.sessionUser!.id;
      const parsed = createAppointmentBody.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });

      const row = await createAppointment(app.db, tenantId, actorId, parsed.data);
      return reply.status(201).send(row);
    });

    manageApp.patch("/appointments/:id/action", async (request, reply) => {
      const tenantId = request.sessionUser!.tenantId;
      const actorId = request.sessionUser!.id;
      const { id } = request.params as { id: string };
      const { action } = request.body as { action: AppointmentAction };
      const result = await applyAppointmentAction(app.db, tenantId, id, actorId, action);
      if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
      return result;
    });

    manageApp.patch("/appointments/:id/complete", async (request, reply) => {
      const tenantId = request.sessionUser!.tenantId;
      const actorId = request.sessionUser!.id;
      const { id } = request.params as { id: string };
      const result = await completeAppointment(app.db, tenantId, id, actorId);
      if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
      return result;
    });

    manageApp.patch("/appointments/:id/reschedule", async (request, reply) => {
      const tenantId = request.sessionUser!.tenantId;
      const actorId = request.sessionUser!.id;
      const { id } = request.params as { id: string };
      const { scheduledAt } = request.body as { scheduledAt: string };
      const result = await rescheduleAppointment(app.db, tenantId, id, actorId, scheduledAt);
      if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
      return result;
    });
  });
}
