import { and, asc, eq, inArray, or } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { customFieldDefinitions, customFieldValues, specialtyTemplates } from "../../db/schema.js";
import {
  ALL_SERVICES_KEY,
  CUSTOM_FIELD_TYPES,
  DEFAULT_FIELD_PLACEMENTS,
  FIELD_GROUPS,
  FIELD_PLACEMENTS,
  FIELD_VISIBILITY,
  canRoleSeeField,
  type CreateCrmFieldInput,
  type CrmFieldVm,
  type CustomFieldType,
  type FieldGroupKey,
  type FieldPlacement,
  type FieldVisibility,
  type JourneyCustomFieldVm,
  type Role,
  type UpdateCrmFieldInput,
} from "@pulseos/types";

// One field system. A definition says what is captured, where it appears and who sees it;
// values stay Journey-scoped in custom_field_values. Archiving retires a field from new entry
// only — values already recorded stay visible.

export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,47}$/;
const GROUP_ORDER = new Map<string, number>(FIELD_GROUPS.map((g, i) => [g.key, i]));
const GROUP_KEYS = new Set<string>(FIELD_GROUPS.map((g) => g.key));
const PLACEMENT_KEYS = new Set<string>(FIELD_PLACEMENTS.map((p) => p.key));
const VISIBILITY_KEYS = new Set<string>(FIELD_VISIBILITY.map((v) => v.key));
const TYPE_KEYS = new Set<string>(CUSTOM_FIELD_TYPES.map((t) => t.key));
const CHOICE_TYPES = new Set<CustomFieldType>(["SELECT", "MULTI_SELECT"]);

export const isGroupKey = (v: unknown): v is FieldGroupKey => typeof v === "string" && GROUP_KEYS.has(v);
export const isPlacement = (v: unknown): v is FieldPlacement => typeof v === "string" && PLACEMENT_KEYS.has(v);
export const isFieldType = (v: unknown): v is CustomFieldType => typeof v === "string" && TYPE_KEYS.has(v);
export const isVisibility = (v: unknown): v is FieldVisibility => typeof v === "string" && VISIBILITY_KEYS.has(v);

type Row = typeof customFieldDefinitions.$inferSelect;

function toVm(r: Row): CrmFieldVm {
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
    origin: r.origin,
    groupKey: (isGroupKey(r.groupKey) ? r.groupKey : "enquiry_details") as FieldGroupKey,
    placements: ((r.placements as unknown[]) ?? []).filter(isPlacement),
    defaultValue: r.defaultValue ?? null,
    visibleTo: (isVisibility(r.visibleTo) ? r.visibleTo : "everyone") as FieldVisibility,
  };
}

const byGroupThenOrder = (a: CrmFieldVm, b: CrmFieldVm) =>
  (GROUP_ORDER.get(a.groupKey) ?? 99) - (GROUP_ORDER.get(b.groupKey) ?? 99) || a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);

// ---------------------------------------------------------------------------
// Value validation (pure). Returns the value to store, or an error message.
// ---------------------------------------------------------------------------

export type ValueCheck = { ok: true; value: unknown } | { ok: false; error: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9\s-]{5,17}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function checkFieldValue(def: { fieldType: CustomFieldType; options: string[] | null; label: string }, raw: unknown): ValueCheck {
  const bad = (what: string): ValueCheck => ({ ok: false, error: `${def.label}: ${what}` });
  switch (def.fieldType) {
    case "TEXT":
      return typeof raw === "string" && raw.length <= 500 ? { ok: true, value: raw.trim() } : bad("expected text up to 500 characters");
    case "LONG_TEXT":
      return typeof raw === "string" && raw.length <= 5000 ? { ok: true, value: raw.trim() } : bad("expected text up to 5000 characters");
    case "NUMBER": {
      const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
      return Number.isFinite(n) ? { ok: true, value: n } : bad("expected a number");
    }
    case "PHONE":
      return typeof raw === "string" && PHONE.test(raw.trim()) ? { ok: true, value: raw.trim() } : bad("expected a phone number");
    case "EMAIL":
      return typeof raw === "string" && EMAIL.test(raw.trim()) ? { ok: true, value: raw.trim() } : bad("expected an email address");
    case "DATE": {
      if (typeof raw !== "string" || !DAY.test(raw)) return bad("expected a date (YYYY-MM-DD)");
      const d = new Date(`${raw}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw ? { ok: true, value: raw } : bad("expected a real date");
    }
    case "DATETIME": {
      const d = typeof raw === "string" ? new Date(raw) : null;
      return d && !Number.isNaN(d.getTime()) ? { ok: true, value: d.toISOString() } : bad("expected a date and time");
    }
    case "BOOLEAN":
      return typeof raw === "boolean" ? { ok: true, value: raw } : bad("expected yes or no");
    case "SELECT":
      return typeof raw === "string" && (def.options ?? []).includes(raw) ? { ok: true, value: raw } : bad("choose one of the listed options");
    case "MULTI_SELECT":
      return Array.isArray(raw) && raw.every((v) => typeof v === "string" && (def.options ?? []).includes(v)) ? { ok: true, value: [...new Set(raw as string[])] } : bad("choose from the listed options");
  }
}

/** A stored value as a person reads it. Dates and date-times are shown in the hospital timezone. */
export function formatFieldValue(type: CustomFieldType, value: unknown, timezone: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (type === "DATE" && typeof value === "string" && DAY.test(value)) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00Z`));
  }
  if (type === "DATETIME" && typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const day = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, day: "numeric", month: "short", year: "numeric" }).format(d);
      const time = new Intl.DateTimeFormat("en-IN", { timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true }).format(d).replace(/\s?(am|pm)$/i, (_, m: string) => ` ${m.toLowerCase()}`);
      return `${day}, ${time}`;
    }
  }
  return String(value);
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Fields in a service scope: that service's own fields plus the "all services" ones. */
const scopeCondition = (tenantId: string, specialtyKey: string) =>
  and(eq(customFieldDefinitions.tenantId, tenantId), or(eq(customFieldDefinitions.specialtyKey, specialtyKey), eq(customFieldDefinitions.specialtyKey, ALL_SERVICES_KEY)));

/** For Settings: every definition in the tenant (optionally one service scope, archived optional). */
export async function listCrmFields(db: Db, tenantId: string, opts: { specialtyKey?: string; includeArchived?: boolean } = {}): Promise<CrmFieldVm[]> {
  const rows = await db
    .select()
    .from(customFieldDefinitions)
    .where(and(opts.specialtyKey ? scopeCondition(tenantId, opts.specialtyKey) : eq(customFieldDefinitions.tenantId, tenantId), opts.includeArchived ? undefined : eq(customFieldDefinitions.archived, false)))
    .orderBy(asc(customFieldDefinitions.sortOrder));
  return rows.map(toVm).sort(byGroupThenOrder);
}

/**
 * Fields an entry form should show: in scope, not archived, placed here, visible to the viewer.
 * A service-specific field wins over an all-services field with the same key.
 */
export async function listFieldsForEntry(db: Db, tenantId: string, role: Role, opts: { placement: FieldPlacement; specialtyKey: string }): Promise<CrmFieldVm[]> {
  const fields = (await listCrmFields(db, tenantId, { specialtyKey: opts.specialtyKey })).filter((f) => f.placements.includes(opts.placement) && canRoleSeeField(role, f.visibleTo));
  const byKey = new Map<string, CrmFieldVm>();
  for (const f of fields) {
    const seen = byKey.get(f.key);
    if (!seen || (seen.specialtyKey === ALL_SERVICES_KEY && f.specialtyKey !== ALL_SERVICES_KEY)) byKey.set(f.key, f);
  }
  return [...byKey.values()].sort(byGroupThenOrder);
}

/**
 * Values recorded on a Journey, for display. Deliberately NOT filtered on archived: a value entered while
 * a field was active stays visible after the field is archived. Filtered by where the field is placed and
 * by who may see it.
 */
export async function loadJourneyFieldValues(db: Db, tenantId: string, journeyId: string, role: Role, placement: "journey_detail" | "patient_360", timezone: string): Promise<JourneyCustomFieldVm[]> {
  const rows = await db
    .select({ def: customFieldDefinitions, value: customFieldValues.value })
    .from(customFieldValues)
    .innerJoin(customFieldDefinitions, eq(customFieldValues.fieldDefinitionId, customFieldDefinitions.id))
    .where(and(eq(customFieldValues.tenantId, tenantId), eq(customFieldValues.journeyId, journeyId)));
  return rows
    .map((r) => ({ vm: toVm(r.def), value: r.value }))
    .filter(({ vm }) => vm.placements.includes(placement) && canRoleSeeField(role, vm.visibleTo))
    .sort((a, b) => byGroupThenOrder(a.vm, b.vm))
    .map(({ vm, value }) => ({ label: vm.label, value: formatFieldValue(vm.fieldType, value, timezone), fieldKey: vm.key, groupKey: vm.groupKey }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string; message?: string };

function validateConfig(input: { fieldType: CustomFieldType; options?: string[] | null; defaultValue?: unknown; label: string }): string | null {
  if (CHOICE_TYPES.has(input.fieldType)) {
    const options = input.options ?? [];
    if (options.length === 0 || options.some((o) => typeof o !== "string" || o.trim() === "") || new Set(options).size !== options.length) return "options_invalid";
  }
  if (!isEmpty(input.defaultValue)) {
    const check = checkFieldValue({ fieldType: input.fieldType, options: input.options ?? null, label: input.label }, input.defaultValue);
    if (!check.ok) return "default_invalid";
  }
  return null;
}

export async function createCrmField(db: Db, tenantId: string, input: CreateCrmFieldInput): Promise<Result<{ field: CrmFieldVm }>> {
  if (!FIELD_KEY_PATTERN.test(input.key)) return { ok: false, reason: "invalid_key" };
  if (!isFieldType(input.fieldType)) return { ok: false, reason: "invalid_type" };
  const groupKey = input.groupKey ?? "enquiry_details";
  const placements = input.placements ?? DEFAULT_FIELD_PLACEMENTS;
  const visibleTo = input.visibleTo ?? "everyone";
  if (!isGroupKey(groupKey) || !placements.every(isPlacement) || placements.length === 0 || !isVisibility(visibleTo)) return { ok: false, reason: "invalid_request" };
  const configError = validateConfig({ ...input, label: input.label });
  if (configError) return { ok: false, reason: configError };

  if (input.specialtyKey !== ALL_SERVICES_KEY) {
    const [template] = await db.select({ id: specialtyTemplates.id }).from(specialtyTemplates).where(and(eq(specialtyTemplates.tenantId, tenantId), eq(specialtyTemplates.key, input.specialtyKey))).limit(1);
    if (!template) return { ok: false, reason: "specialty_not_found" };
  }
  const siblings = await db.select({ key: customFieldDefinitions.key, sortOrder: customFieldDefinitions.sortOrder }).from(customFieldDefinitions).where(and(eq(customFieldDefinitions.tenantId, tenantId), eq(customFieldDefinitions.specialtyKey, input.specialtyKey)));
  if (siblings.some((s) => s.key === input.key)) return { ok: false, reason: "key_exists" };

  const [row] = await db
    .insert(customFieldDefinitions)
    .values({
      tenantId,
      specialtyKey: input.specialtyKey,
      key: input.key,
      label: input.label.trim(),
      fieldType: input.fieldType,
      options: CHOICE_TYPES.has(input.fieldType) ? input.options : null,
      // A hospital can only ever make CUSTOM fields; TEMPLATE comes from a template install, SYSTEM from the platform.
      origin: "CUSTOM",
      required: input.required ?? false,
      sortOrder: siblings.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1,
      groupKey,
      placements,
      defaultValue: isEmpty(input.defaultValue) ? null : input.defaultValue,
      visibleTo,
    })
    .returning();
  return { ok: true, field: toVm(row) };
}

export async function updateCrmField(db: Db, tenantId: string, fieldId: string, input: UpdateCrmFieldInput): Promise<Result<{ field: CrmFieldVm }>> {
  const [existing] = await db.select().from(customFieldDefinitions).where(and(eq(customFieldDefinitions.tenantId, tenantId), eq(customFieldDefinitions.id, fieldId))).limit(1);
  if (!existing) return { ok: false, reason: "field_not_found" };
  // SYSTEM fields are platform-owned: never archived, retyped or made optional by a tenant.
  if (existing.origin === "SYSTEM" && (input.archived === true || (input.fieldType !== undefined && input.fieldType !== existing.fieldType) || (input.required === false && existing.required))) {
    return { ok: false, reason: "system_field_locked" };
  }

  const nextType = input.fieldType ?? existing.fieldType;
  if (input.fieldType !== undefined) {
    if (!isFieldType(input.fieldType)) return { ok: false, reason: "invalid_type" };
    if (input.fieldType !== existing.fieldType) {
      const [value] = await db.select({ id: customFieldValues.id }).from(customFieldValues).where(eq(customFieldValues.fieldDefinitionId, fieldId)).limit(1);
      if (value) return { ok: false, reason: "field_has_values" };
    }
  }
  if (input.groupKey !== undefined && !isGroupKey(input.groupKey)) return { ok: false, reason: "invalid_request" };
  if (input.placements !== undefined && (input.placements.length === 0 || !input.placements.every(isPlacement))) return { ok: false, reason: "invalid_request" };
  if (input.visibleTo !== undefined && !isVisibility(input.visibleTo)) return { ok: false, reason: "invalid_request" };

  const nextOptions = input.options !== undefined ? input.options : (existing.options as string[] | null);
  const nextDefault = input.defaultValue !== undefined ? input.defaultValue : existing.defaultValue;
  const configError = validateConfig({ fieldType: nextType, options: nextOptions, defaultValue: nextDefault, label: input.label ?? existing.label });
  if (configError) return { ok: false, reason: configError };

  const [row] = await db
    .update(customFieldDefinitions)
    .set({
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.fieldType !== undefined ? { fieldType: input.fieldType } : {}),
      ...(input.options !== undefined || input.fieldType !== undefined ? { options: CHOICE_TYPES.has(nextType) ? nextOptions : null } : {}),
      ...(input.required !== undefined ? { required: input.required } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
      ...(input.groupKey !== undefined ? { groupKey: input.groupKey } : {}),
      ...(input.placements !== undefined ? { placements: input.placements } : {}),
      ...(input.defaultValue !== undefined ? { defaultValue: isEmpty(input.defaultValue) ? null : input.defaultValue } : {}),
      ...(input.visibleTo !== undefined ? { visibleTo: input.visibleTo } : {}),
    })
    .where(eq(customFieldDefinitions.id, fieldId))
    .returning();
  return { ok: true, field: toVm(row) };
}

/** Re-order the fields of one group in one service scope. The group's existing sort slots are reused, so other groups are untouched. */
export async function reorderCrmFields(db: Db, tenantId: string, input: { specialtyKey: string; groupKey: FieldGroupKey; orderedIds: string[] }): Promise<Result> {
  if (!isGroupKey(input.groupKey) || new Set(input.orderedIds).size !== input.orderedIds.length || input.orderedIds.length === 0) return { ok: false, reason: "invalid_request" };
  const rows = await db
    .select()
    .from(customFieldDefinitions)
    .where(and(eq(customFieldDefinitions.tenantId, tenantId), eq(customFieldDefinitions.specialtyKey, input.specialtyKey), eq(customFieldDefinitions.groupKey, input.groupKey), inArray(customFieldDefinitions.id, input.orderedIds)));
  if (rows.length !== input.orderedIds.length) return { ok: false, reason: "invalid_request" };

  let slots = rows.map((r) => r.sortOrder).sort((a, b) => a - b);
  if (new Set(slots).size !== slots.length) slots = slots.map((_, i) => slots[0]! + i);
  await db.transaction(async (tx) => {
    for (const [i, id] of input.orderedIds.entries()) {
      await tx.update(customFieldDefinitions).set({ sortOrder: slots[i]! }).where(and(eq(customFieldDefinitions.tenantId, tenantId), eq(customFieldDefinitions.id, id)));
    }
  });
  return { ok: true };
}

/**
 * Validate and normalise submitted values against the fields active in a placement.
 * Required fields in that placement must be present; unknown / archived / not-visible keys are ignored.
 */
export function resolveSubmittedValues(
  fields: CrmFieldVm[],
  submitted: Record<string, unknown> | undefined,
): { ok: true; values: { field: CrmFieldVm; value: unknown }[] } | { ok: false; missing: string[]; invalid: string[] } {
  const provided = submitted ?? {};
  const missing: string[] = [];
  const invalid: string[] = [];
  const values: { field: CrmFieldVm; value: unknown }[] = [];
  for (const field of fields) {
    const raw = provided[field.key];
    if (isEmpty(raw)) {
      if (field.required) missing.push(field.key);
      continue;
    }
    const check = checkFieldValue(field, raw);
    if (!check.ok) invalid.push(field.key);
    else values.push({ field, value: check.value });
  }
  return missing.length || invalid.length ? { ok: false, missing, invalid } : { ok: true, values };
}
