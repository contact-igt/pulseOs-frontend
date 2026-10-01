import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { journeys } from "../../db/schema.js";
import { CUSTOM_FIELD_TYPES, FIELD_GROUPS, FIELD_PLACEMENTS, FIELD_VISIBILITY } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import { createCrmField, listCrmFields, listFieldsForEntry, reorderCrmFields, updateCrmField } from "./crm-field.service.js";

const tuple = <T extends { key: string }>(items: T[]) => items.map((i) => i.key) as [T["key"], ...T["key"][]];
const fieldType = z.enum(tuple(CUSTOM_FIELD_TYPES));
const groupKey = z.enum(tuple(FIELD_GROUPS));
const placement = z.enum(tuple(FIELD_PLACEMENTS));
const visibleTo = z.enum(tuple(FIELD_VISIBILITY));
const options = z.array(z.string().min(1).max(80)).max(50);

// Unknown keys on create (e.g. a smuggled tenantId) are ignored; on update they are rejected, so
// key / specialtyKey can never be changed after the fact.
const createBody = z.object({
  specialtyKey: z.string().min(1).max(60),
  key: z.string(),
  label: z.string().min(1).max(80),
  fieldType,
  options: options.optional(),
  required: z.boolean().optional(),
  groupKey: groupKey.optional(),
  placements: z.array(placement).optional(),
  defaultValue: z.unknown().optional(),
  visibleTo: visibleTo.optional(),
});

const updateBody = z
  .object({
    label: z.string().min(1).max(80).optional(),
    fieldType: fieldType.optional(),
    options: options.optional(),
    required: z.boolean().optional(),
    archived: z.boolean().optional(),
    groupKey: groupKey.optional(),
    placements: z.array(placement).optional(),
    defaultValue: z.unknown().optional(),
    visibleTo: visibleTo.optional(),
  })
  .strict();

const reorderBody = z.object({ specialtyKey: z.string().min(1).max(60), groupKey, orderedIds: z.array(z.string().uuid()).min(1).max(200) });
const listQuery = z.object({ specialtyKey: z.string().min(1).max(60).optional(), includeArchived: z.enum(["true", "false"]).optional() });
// Ask by service, or by Journey (the Journey's own service decides the scope).
const forQuery = z
  .object({ placement, specialtyKey: z.string().min(1).max(60).optional(), journeyId: z.string().uuid().optional() })
  .refine((q) => !!q.specialtyKey !== !!q.journeyId, "give a specialtyKey or a journeyId");

const REASON_STATUS: Record<string, number> = {
  field_not_found: 404,
  specialty_not_found: 404,
  key_exists: 409,
  field_has_values: 409,
  system_field_locked: 403,
};

export async function crmFieldRoutes(app: FastifyInstance) {
  // Fields that apply to an entry form — any signed-in role (needed to render Add Lead, follow-up forms...).
  // Already filtered by service scope, placement, archive state and the caller's role visibility.
  app.get("/crm/fields/for", async (request, reply) => {
    const parsed = forQuery.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    const user = request.sessionUser!;
    let specialtyKey = parsed.data.specialtyKey;
    if (parsed.data.journeyId) {
      const [journey] = await app.db.select({ specialtyKey: journeys.specialtyKey }).from(journeys).where(and(eq(journeys.tenantId, user.tenantId), eq(journeys.id, parsed.data.journeyId))).limit(1);
      if (!journey) return reply.status(404).send({ error: "journey_not_found" });
      specialtyKey = journey.specialtyKey ?? undefined;
    }
    if (!specialtyKey) return [];
    return listFieldsForEntry(app.db, user.tenantId, user.role, { placement: parsed.data.placement, specialtyKey });
  });

  app.get("/crm/fields", { preHandler: requirePermission("MANAGE_SPECIALTIES") }, async (request, reply) => {
    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    return listCrmFields(app.db, request.sessionUser!.tenantId, { specialtyKey: parsed.data.specialtyKey, includeArchived: parsed.data.includeArchived === "true" });
  });

  app.post("/crm/fields", { preHandler: requirePermission("MANAGE_SPECIALTIES") }, async (request, reply) => {
    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    const result = await createCrmField(app.db, request.sessionUser!.tenantId, parsed.data);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return reply.status(201).send(result.field);
  });

  app.patch("/crm/fields/:id", { preHandler: requirePermission("MANAGE_SPECIALTIES") }, async (request, reply) => {
    const id = z.string().uuid().safeParse((request.params as { id: string }).id);
    if (!id.success) return reply.status(404).send({ error: "field_not_found" });
    const parsed = updateBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    const result = await updateCrmField(app.db, request.sessionUser!.tenantId, id.data, parsed.data);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return result.field;
  });

  app.post("/crm/fields/reorder", { preHandler: requirePermission("MANAGE_SPECIALTIES") }, async (request, reply) => {
    const parsed = reorderBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    const result = await reorderCrmFields(app.db, request.sessionUser!.tenantId, parsed.data);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return { ok: true };
  });
}
