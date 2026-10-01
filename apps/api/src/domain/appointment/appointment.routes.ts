import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppointmentAction } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import { diffDays, isRealDate } from "../../lib/hospital-time.js";
import {
  MAX_APPOINTMENT_RANGE_DAYS,
  applyAppointmentAction,
  completeAppointment,
  createAppointment,
  getCalendarContext,
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

const localDay = z.string().refine(isRealDate);

// List filters. Dates are local days in the tenant's timezone; a malformed one
// is a 400, never a 500 from the database driver.
const listAppointmentsQuery = z
  .object({
    branchId: z.string().uuid().optional(),
    doctorId: z.string().uuid().optional(),
    journeyId: z.string().uuid().optional(),
    status: z.enum(["requested", "scheduled", "confirmed", "checked_in", "waiting", "with_doctor", "completed", "no_show", "cancelled"]).optional(),
    date: localDay.optional(),
    from: localDay.optional(),
    to: localDay.optional(),
    search: z.string().max(200).optional(),
  })
  .refine((q) => !q.from === !q.to, "from and to go together")
  .refine((q) => !q.from || !q.to || (diffDays(q.from, q.to) >= 0 && diffDays(q.from, q.to) < MAX_APPOINTMENT_RANGE_DAYS), "invalid range");

const REASON_STATUS: Record<string, number> = {
  appointment_not_found: 404,
  appointment_closed: 409,
  not_with_doctor: 409,
  invalid_transition: 409,
};

export async function appointmentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_APPOINTMENTS"));

  app.get("/appointments", async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const parsed = listAppointmentsQuery.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    return listAppointments(app.db, tenantId, parsed.data);
  });

  // Hospital timezone + its local "today", so every appointment view (list,
  // calendar, doctor schedule, front desk) draws day boundaries the same way.
  app.get("/appointments/calendar-context", async (request) => {
    return getCalendarContext(app.db, request.sessionUser!.tenantId);
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

      const result = await createAppointment(app.db, tenantId, actorId, parsed.data, request.sessionUser!.timezone);
      if (!result.ok) return reply.status(result.reason === "invalid_request" ? 400 : 404).send({ error: result.reason });
      return reply.status(201).send(result.appointment);
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
