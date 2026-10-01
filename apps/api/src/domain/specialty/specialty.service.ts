import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { customFieldDefinitions, specialtyTemplates } from "../../db/schema.js";
import { createCrmField } from "../crm/crm-field.service.js";
import type {
  CreateCustomFieldInput,
  CustomFieldDefinitionVm,
  SpecialtyDetailVm,
  SpecialtyTemplateVm,
  UpdateCustomFieldInput,
  UpdateSpecialtyInput,
} from "@pulseos/types";

function toFieldVm(r: typeof customFieldDefinitions.$inferSelect): CustomFieldDefinitionVm {
  return {
    id: r.id,
    specialtyKey: r.specialtyKey,
    key: r.key,
    label: r.label,
    fieldType: r.fieldType,
    options: (r.options as string[] | null) ?? null,
    required: r.required,
    sortOrder: r.sortOrder,
    archived: r.archived,
  };
}

export async function listSpecialties(db: Db, tenantId: string, includeDisabled = false): Promise<SpecialtyTemplateVm[]> {
  const templates = await db
    .select()
    .from(specialtyTemplates)
    .where(and(eq(specialtyTemplates.tenantId, tenantId), includeDisabled ? undefined : eq(specialtyTemplates.enabled, true)))
    .orderBy(asc(specialtyTemplates.sortOrder));

  const fields = await db
    .select({ specialtyKey: customFieldDefinitions.specialtyKey })
    .from(customFieldDefinitions)
    .where(and(eq(customFieldDefinitions.tenantId, tenantId), eq(customFieldDefinitions.archived, false)));

  const fieldCountByKey = new Map<string, number>();
  for (const f of fields) fieldCountByKey.set(f.specialtyKey, (fieldCountByKey.get(f.specialtyKey) ?? 0) + 1);

  return templates.map((t) => ({
    key: t.key,
    displayName: t.displayName,
    defaultJourneyType: t.defaultJourneyType,
    enabled: t.enabled,
    sortOrder: t.sortOrder,
    fieldCount: fieldCountByKey.get(t.key) ?? 0,
  }));
}

export async function getSpecialtyDetail(db: Db, tenantId: string, key: string): Promise<SpecialtyDetailVm | null> {
  const [template] = await db
    .select()
    .from(specialtyTemplates)
    .where(and(eq(specialtyTemplates.tenantId, tenantId), eq(specialtyTemplates.key, key)))
    .limit(1);
  if (!template) return null;

  const fields = await db
    .select()
    .from(customFieldDefinitions)
    .where(and(eq(customFieldDefinitions.tenantId, tenantId), eq(customFieldDefinitions.specialtyKey, key), eq(customFieldDefinitions.archived, false)))
    .orderBy(asc(customFieldDefinitions.sortOrder));

  return {
    key: template.key,
    displayName: template.displayName,
    defaultJourneyType: template.defaultJourneyType,
    enabled: template.enabled,
    sortOrder: template.sortOrder,
    fieldCount: fields.length,
    fields: fields.map(toFieldVm),
  };
}

/** Active (non-archived) fields for a specialty — used by the Add Lead drawer. */
export async function listActiveFields(db: Db, tenantId: string, specialtyKey: string): Promise<CustomFieldDefinitionVm[]> {
  const fields = await db
    .select()
    .from(customFieldDefinitions)
    .where(and(eq(customFieldDefinitions.tenantId, tenantId), eq(customFieldDefinitions.specialtyKey, specialtyKey), eq(customFieldDefinitions.archived, false)))
    .orderBy(asc(customFieldDefinitions.sortOrder));
  return fields.map(toFieldVm);
}

export async function updateSpecialty(db: Db, tenantId: string, key: string, input: UpdateSpecialtyInput): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [existing] = await db
    .select({ id: specialtyTemplates.id })
    .from(specialtyTemplates)
    .where(and(eq(specialtyTemplates.tenantId, tenantId), eq(specialtyTemplates.key, key)))
    .limit(1);
  if (!existing) return { ok: false, reason: "specialty_not_found" };

  await db
    .update(specialtyTemplates)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.defaultJourneyType !== undefined ? { defaultJourneyType: input.defaultJourneyType } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    })
    .where(eq(specialtyTemplates.id, existing.id));
  return { ok: true };
}

export async function createCustomField(db: Db, tenantId: string, specialtyKey: string, input: CreateCustomFieldInput): Promise<{ ok: true; field: CustomFieldDefinitionVm } | { ok: false; reason: string }> {
  // One field system: creation goes through the CRM field service (key rules, uniqueness, validation).
  const created = await createCrmField(db, tenantId, { ...input, specialtyKey });
  if (!created.ok) return { ok: false, reason: created.reason };
  return { ok: true, field: created.field };
}

export async function updateCustomField(db: Db, tenantId: string, fieldId: string, input: UpdateCustomFieldInput): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [existing] = await db
    .select({ id: customFieldDefinitions.id })
    .from(customFieldDefinitions)
    .where(and(eq(customFieldDefinitions.tenantId, tenantId), eq(customFieldDefinitions.id, fieldId)))
    .limit(1);
  if (!existing) return { ok: false, reason: "field_not_found" };

  await db
    .update(customFieldDefinitions)
    .set({
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.required !== undefined ? { required: input.required } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.options !== undefined ? { options: input.options } : {}),
    })
    .where(eq(customFieldDefinitions.id, fieldId));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Specialty definitions are data (see gynecology.templates.ts and
// ophthalmology.templates.ts) — this installs any set of them for a tenant.
// ---------------------------------------------------------------------------

export interface SpecialtyDefinition {
  key: string;
  displayName: string;
  defaultJourneyType: string;
  sortOrder: number;
  fields: CreateCustomFieldInput[];
}

/** Idempotently installs the given specialty definitions for a tenant (existing keys are left untouched). */
export async function ensureSpecialties(db: Db, tenantId: string, definitions: SpecialtyDefinition[]): Promise<void> {
  const existing = await db.select({ key: specialtyTemplates.key }).from(specialtyTemplates).where(eq(specialtyTemplates.tenantId, tenantId));
  const existingKeys = new Set(existing.map((e) => e.key));

  for (const spec of definitions) {
    if (existingKeys.has(spec.key)) continue;

    await db.insert(specialtyTemplates).values({
      tenantId,
      key: spec.key,
      displayName: spec.displayName,
      defaultJourneyType: spec.defaultJourneyType,
      enabled: true,
      sortOrder: spec.sortOrder,
    });

    for (let i = 0; i < spec.fields.length; i++) {
      const field = spec.fields[i];
      await db.insert(customFieldDefinitions).values({
        tenantId,
        specialtyKey: spec.key,
        key: field.key,
        label: field.label,
        fieldType: field.fieldType,
        options: field.options ?? null,
        required: field.required ?? false,
        sortOrder: i,
      });
    }
  }
}

