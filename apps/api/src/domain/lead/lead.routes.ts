import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../auth/permission.middleware.js";
import { createLead, getLeadsSummary, listLeads, lookupPatientByPhone } from "./lead.service.js";
import type { LeadStatus } from "@pulseos/types";

const createLeadBody = z.object({
  patientId: z.string().uuid().optional(),
  name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  preferredLanguage: z.string().optional(),
  specialtyKey: z.string().min(1),
  branchId: z.string().uuid(),
  doctorId: z.string().uuid().optional(),
  source: z.enum(["meta", "google", "website", "whatsapp", "phone", "walk_in", "referral", "organic", "other"]),
  campaignId: z.string().uuid().optional(),
  journeyType: z.string().min(1),
  ownerId: z.string().uuid().optional(),
  priority: z.enum(["normal", "high"]).optional(),
  notes: z.string().optional(),
  customFieldValues: z.record(z.string(), z.unknown()).optional(),
  followUp: z
    .object({
      type: z.enum(["CALLBACK", "FOLLOW_UP", "APPOINTMENT_CONFIRMATION", "NO_SHOW_RECOVERY", "TREATMENT_DECISION", "POST_CARE", "RECALL", "OTHER"]),
      dueAt: z.string(),
      assignedTo: z.string().uuid().optional(),
    })
    .nullable()
    .optional(),
});

export async function leadRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("MANAGE_LEADS"));

  app.get("/leads", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as { status?: LeadStatus; specialtyKey?: string; source?: string };
    return listLeads(app.db, tenantId, { status: query.status, specialtyKey: query.specialtyKey, source: query.source });
  });

  app.get("/leads/summary", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getLeadsSummary(app.db, tenantId);
  });

  app.post("/leads/lookup", async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const { phone } = request.body as { phone?: string };
    if (!phone) return reply.status(400).send({ error: "invalid_request" });
    return lookupPatientByPhone(app.db, tenantId, phone);
  });

  app.post("/leads", async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const actorId = request.sessionUser!.id;
    const parsed = createLeadBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request", details: parsed.error.flatten() });

    const result = await createLead(app.db, tenantId, actorId, parsed.data);
    return reply.status(201).send(result);
  });
}
