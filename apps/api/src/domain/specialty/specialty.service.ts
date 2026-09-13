import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { customFieldDefinitions, specialtyTemplates } from "../../db/schema.js";
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
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    })
    .where(eq(specialtyTemplates.id, existing.id));
  return { ok: true };
}

export async function createCustomField(db: Db, tenantId: string, specialtyKey: string, input: CreateCustomFieldInput): Promise<{ ok: true; field: CustomFieldDefinitionVm } | { ok: false; reason: string }> {
  const [template] = await db
    .select({ id: specialtyTemplates.id })
    .from(specialtyTemplates)
    .where(and(eq(specialtyTemplates.tenantId, tenantId), eq(specialtyTemplates.key, specialtyKey)))
    .limit(1);
  if (!template) return { ok: false, reason: "specialty_not_found" };

  const existingFields = await db
    .select({ sortOrder: customFieldDefinitions.sortOrder })
    .from(customFieldDefinitions)
    .where(and(eq(customFieldDefinitions.tenantId, tenantId), eq(customFieldDefinitions.specialtyKey, specialtyKey)));
  const nextSortOrder = existingFields.reduce((max, f) => Math.max(max, f.sortOrder), -1) + 1;

  const [row] = await db
    .insert(customFieldDefinitions)
    .values({
      tenantId,
      specialtyKey,
      key: input.key,
      label: input.label,
      fieldType: input.fieldType,
      options: input.options ?? null,
      required: input.required ?? false,
      sortOrder: nextSortOrder,
    })
    .returning();

  return { ok: true, field: toFieldVm(row) };
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
// Default specialty templates — idempotent seed helper, also usable to
// backfill a tenant that predates this feature.
// ---------------------------------------------------------------------------

export const DEFAULT_SPECIALTIES: {
  key: string;
  displayName: string;
  defaultJourneyType: string;
  sortOrder: number;
  fields: CreateCustomFieldInput[];
}[] = [
  {
    key: "GENERAL_OPD",
    displayName: "General OPD",
    defaultJourneyType: "General Consultation",
    sortOrder: 0,
    fields: [],
  },
  {
    key: "GYNECOLOGY",
    displayName: "Gynecology / Maternity",
    defaultJourneyType: "Pregnancy Care",
    sortOrder: 1,
    fields: [
      { key: "pregnancy_status", label: "Pregnancy status", fieldType: "BOOLEAN" },
      { key: "gestational_week", label: "Gestational week", fieldType: "NUMBER" },
      { key: "edd", label: "EDD", fieldType: "DATE" },
      { key: "high_risk_status", label: "High-risk status", fieldType: "BOOLEAN" },
      { key: "previous_c_section", label: "Previous C-section", fieldType: "BOOLEAN" },
    ],
  },
  {
    key: "FERTILITY",
    displayName: "Fertility / IVF",
    defaultJourneyType: "Fertility",
    sortOrder: 2,
    fields: [
      { key: "trying_duration", label: "Trying duration", fieldType: "TEXT" },
      { key: "previous_fertility_treatment", label: "Previous fertility treatment", fieldType: "BOOLEAN" },
      { key: "ivf_interest", label: "IVF interest", fieldType: "BOOLEAN" },
      { key: "treatment_stage", label: "Treatment stage", fieldType: "SELECT", options: ["Evaluation", "IUI", "IVF", "Follow-up"] },
    ],
  },
  {
    key: "OPHTHALMOLOGY",
    displayName: "Ophthalmology",
    defaultJourneyType: "Eye Care",
    sortOrder: 3,
    fields: [
      { key: "eye_concern", label: "Eye concern", fieldType: "TEXT" },
      { key: "laterality", label: "Laterality", fieldType: "SELECT", options: ["Left", "Right", "Both"] },
      { key: "cataract_interest", label: "Cataract interest", fieldType: "BOOLEAN" },
      { key: "lasik_interest", label: "LASIK interest", fieldType: "BOOLEAN" },
    ],
  },
  {
    key: "PAEDIATRICS",
    displayName: "Paediatrics",
    defaultJourneyType: "Paediatrics",
    sortOrder: 4,
    fields: [
      { key: "child_age", label: "Child age", fieldType: "NUMBER" },
      { key: "concern", label: "Concern", fieldType: "TEXT" },
      { key: "vaccination_due", label: "Vaccination due", fieldType: "BOOLEAN" },
    ],
  },
];

export async function ensureDefaultSpecialties(db: Db, tenantId: string): Promise<void> {
  const existing = await db.select({ key: specialtyTemplates.key }).from(specialtyTemplates).where(eq(specialtyTemplates.tenantId, tenantId));
  const existingKeys = new Set(existing.map((e) => e.key));

  for (const spec of DEFAULT_SPECIALTIES) {
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
