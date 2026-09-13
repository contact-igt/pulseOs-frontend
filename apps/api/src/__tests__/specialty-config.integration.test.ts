import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { queryClient } from "../db/client.js";
import type { FastifyInstance } from "fastify";
import type { CustomFieldDefinitionVm, SpecialtyDetailVm, SpecialtyTemplateVm } from "@pulseos/types";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

async function loginAs(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: DEMO_PASSWORD } });
  return res.cookies.find((c) => c.name === "pulseos_session")!.value;
}

describe.skipIf(!DEMO_PASSWORD)("specialty configuration (integration)", () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let coordinatorCookie: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    adminCookie = await loginAs(app, "admin@pulseos.local");
    coordinatorCookie = await loginAs(app, "coordinator@pulseos.local");
  });

  afterAll(async () => {
    await app.close();
    await queryClient.end();
  });

  it("any authenticated role can read the enabled specialty list (needed to render Add Lead)", async () => {
    const res = await app.inject({ method: "GET", url: "/specialties", cookies: { pulseos_session: coordinatorCookie } });
    expect(res.statusCode).toBe(200);
    const specialties = res.json() as SpecialtyTemplateVm[];
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties.every((s) => s.enabled)).toBe(true);
    expect(specialties.map((s) => s.key)).toContain("GYNECOLOGY");
  });

  it("a role without MANAGE_SPECIALTIES (Coordinator) cannot read specialty detail or mutate config", async () => {
    const detail = await app.inject({ method: "GET", url: "/specialties/GYNECOLOGY", cookies: { pulseos_session: coordinatorCookie } });
    expect(detail.statusCode).toBe(403);
    expect(detail.json().requiredPermission).toBe("MANAGE_SPECIALTIES");

    const patch = await app.inject({ method: "PATCH", url: "/specialties/GYNECOLOGY", cookies: { pulseos_session: coordinatorCookie }, payload: { enabled: false } });
    expect(patch.statusCode).toBe(403);
  });

  it("Hospital Admin can view a specialty's active custom fields, in sortOrder", async () => {
    const res = await app.inject({ method: "GET", url: "/specialties/GYNECOLOGY", cookies: { pulseos_session: adminCookie } });
    expect(res.statusCode).toBe(200);
    const detail = res.json() as SpecialtyDetailVm;
    expect(detail.displayName).toBe("Gynecology / Maternity");
    expect(detail.fields.length).toBeGreaterThan(0);
    expect(detail.fields.map((f) => f.key)).toContain("edd");
    for (let i = 1; i < detail.fields.length; i++) {
      expect(detail.fields[i].sortOrder).toBeGreaterThanOrEqual(detail.fields[i - 1].sortOrder);
    }
  });

  it("Hospital Admin can disable a specialty and it drops out of the enabled list", async () => {
    const before = await app.inject({ method: "GET", url: "/specialties", cookies: { pulseos_session: adminCookie } });
    expect((before.json() as SpecialtyTemplateVm[]).map((s) => s.key)).toContain("PAEDIATRICS");

    const patch = await app.inject({ method: "PATCH", url: "/specialties/PAEDIATRICS", cookies: { pulseos_session: adminCookie }, payload: { enabled: false } });
    expect(patch.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: "/specialties", cookies: { pulseos_session: adminCookie } });
    expect((after.json() as SpecialtyTemplateVm[]).map((s) => s.key)).not.toContain("PAEDIATRICS");

    // Re-enable so it doesn't leak into other tests / demo state.
    await app.inject({ method: "PATCH", url: "/specialties/PAEDIATRICS", cookies: { pulseos_session: adminCookie }, payload: { enabled: true } });
    const restored = await app.inject({ method: "GET", url: "/specialties", cookies: { pulseos_session: adminCookie } });
    expect((restored.json() as SpecialtyTemplateVm[]).map((s) => s.key)).toContain("PAEDIATRICS");
  });

  it("Hospital Admin can add a custom field to a specialty and it appears via the Add-Lead-facing endpoint", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/specialties/PAEDIATRICS/fields",
      cookies: { pulseos_session: adminCookie },
      payload: { key: "allergy_notes", label: "Allergy notes", fieldType: "TEXT" },
    });
    expect(create.statusCode).toBe(201);
    const field = create.json() as CustomFieldDefinitionVm;
    expect(field.archived).toBe(false);

    const activeFields = await app.inject({ method: "GET", url: "/specialties/PAEDIATRICS/fields", cookies: { pulseos_session: coordinatorCookie } });
    expect((activeFields.json() as CustomFieldDefinitionVm[]).map((f) => f.key)).toContain("allergy_notes");

    const archive = await app.inject({ method: "PATCH", url: `/specialties/fields/${field.id}`, cookies: { pulseos_session: adminCookie }, payload: { archived: true } });
    expect(archive.statusCode).toBe(200);

    const afterArchive = await app.inject({ method: "GET", url: "/specialties/PAEDIATRICS/fields", cookies: { pulseos_session: coordinatorCookie } });
    expect((afterArchive.json() as CustomFieldDefinitionVm[]).map((f) => f.key)).not.toContain("allergy_notes");
  });

  it("a specialty key that does not exist for this tenant 404s rather than leaking another tenant's config", async () => {
    const res = await app.inject({ method: "GET", url: "/specialties/NOT_A_REAL_SPECIALTY", cookies: { pulseos_session: adminCookie } });
    expect(res.statusCode).toBe(404);
  });

  it("FLOW 5: enabling a field makes it appear for Add Lead, archiving it makes it disappear again", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/specialties/OPHTHALMOLOGY/fields",
      cookies: { pulseos_session: adminCookie },
      payload: { key: "referred_by", label: "Referred by", fieldType: "TEXT" },
    });
    const field = create.json() as CustomFieldDefinitionVm;

    const fields = await app.inject({ method: "GET", url: "/specialties/OPHTHALMOLOGY/fields", cookies: { pulseos_session: coordinatorCookie } });
    expect((fields.json() as CustomFieldDefinitionVm[]).some((f) => f.key === "referred_by")).toBe(true);

    await app.inject({ method: "PATCH", url: `/specialties/fields/${field.id}`, cookies: { pulseos_session: adminCookie }, payload: { archived: true } });
  });
});
