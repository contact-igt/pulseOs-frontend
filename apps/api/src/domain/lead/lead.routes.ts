import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../auth/permission.middleware.js";
import { parseOwnerFilter } from "../journey/journey.service.js";
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

  app.get("/leads", async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as { status?: LeadStatus; specialtyKey?: string; source?: string; owner?: string };
    // owner = mine | unassigned | <userId>; "mine" is the SESSION user, never client-supplied.
    const owner = parseOwnerFilter(query.owner, request.sessionUser!.id);
    if (owner === "invalid") return reply.status(400).send({ error: "invalid_owner_filter" });
    return listLeads(app.db, tenantId, { status: query.status, specialtyKey: query.specialtyKey, source: query.source, owner }, request.sessionUser!.timezone);
  });

  app.get("/leads/summary", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    return getLeadsSummary(app.db, tenantId, request.sessionUser!.timezone);
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

    const result = await createLead(app.db, tenantId, actorId, parsed.data, request.sessionUser!.role);
    if ("validationError" in result) {
      // Required fields missing wins; otherwise the values that do not fit their field type.
      if (result.missingRequiredFields.length > 0) return reply.status(422).send({ error: "missing_required_fields", fields: result.missingRequiredFields });
      return reply.status(422).send({ error: "invalid_field_values", fields: result.invalidFields });
    }
    return reply.status(201).send(result);
  });
}
