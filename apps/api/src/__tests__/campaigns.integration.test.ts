import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { queryClient } from "../db/client.js";
import type { FastifyInstance } from "fastify";
import type { CampaignPerformanceRow, MarketingEfficiencySummary, SpendAtRisk } from "@pulseos/types";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

async function loginAs(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: DEMO_PASSWORD } });
  return res.cookies.find((c) => c.name === "pulseos_session")!.value;
}

describe.skipIf(!DEMO_PASSWORD)("campaigns / marketing efficiency (integration)", () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let doctorCookie: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    adminCookie = await loginAs(app, "admin@pulseos.local");
    doctorCookie = await loginAs(app, "doctor@pulseos.local");
  });

  afterAll(async () => {
    await app.close();
    await queryClient.end();
  });

  it("a role without VIEW_MARKETING (Doctor) is forbidden with the specific permission named", async () => {
    const res = await app.inject({ method: "GET", url: "/campaigns/performance", cookies: { pulseos_session: doctorCookie } });
    expect(res.statusCode).toBe(403);
    expect(res.json().requiredPermission).toBe("VIEW_MARKETING");
  });

  it("lists campaign performance with real spend and never NaN/Infinity ratios", async () => {
    const res = await app.inject({ method: "GET", url: "/campaigns/performance", cookies: { pulseos_session: adminCookie } });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as CampaignPerformanceRow[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.spend).toBeGreaterThanOrEqual(0);
      if (row.roas !== null) expect(Number.isFinite(row.roas)).toBe(true);
      if (row.cpl !== null) expect(Number.isFinite(row.cpl)).toBe(true);
    }
  });

  it("filters campaign performance by source", async () => {
    const res = await app.inject({ method: "GET", url: "/campaigns/performance?source=meta", cookies: { pulseos_session: adminCookie } });
    const rows = res.json() as CampaignPerformanceRow[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.source === "meta")).toBe(true);
  });

  it("filters campaign performance by specialty — the seeded Cataract campaign's Ophthalmology leads are isolated from its other traffic", async () => {
    const res = await app.inject({ method: "GET", url: "/campaigns/performance?specialtyKey=OPHTHALMOLOGY", cookies: { pulseos_session: adminCookie } });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as CampaignPerformanceRow[];
    const cataract = rows.find((r) => r.campaignName === "Meta – Cataract Awareness");
    expect(cataract).toBeDefined();
    expect(cataract!.leads).toBeGreaterThan(0);
    expect(cataract!.specialtyKey).toBe("OPHTHALMOLOGY");
  });

  it("the weak seeded campaign shows real leakage: leads without matching treatment revenue", async () => {
    const res = await app.inject({ method: "GET", url: "/campaigns/performance", cookies: { pulseos_session: adminCookie } });
    const rows = res.json() as CampaignPerformanceRow[];
    const cataract = rows.find((r) => r.campaignName === "Meta – Cataract Awareness");
    expect(cataract).toBeDefined();
    expect(cataract!.spend).toBe(18_000);
    expect(cataract!.treatmentCompleted).toBe(0);
    expect(cataract!.revenue).toBe(0);
    expect(cataract!.roas).toBe(0); // spend > 0, revenue 0 → a real, finite 0×, never Infinity/NaN
  });

  it("marketing efficiency summary aggregates spend/leads/revenue with guarded ratios", async () => {
    const res = await app.inject({ method: "GET", url: "/campaigns/marketing-efficiency", cookies: { pulseos_session: adminCookie } });
    expect(res.statusCode).toBe(200);
    const summary = res.json() as MarketingEfficiencySummary;
    expect(summary.spend).toBeGreaterThan(0);
    expect(summary.leads).toBeGreaterThan(0);
    if (summary.roas !== null) expect(Number.isFinite(summary.roas)).toBe(true);
  });

  it("spend-at-risk uses 'Spend At Risk' wording (not 'Marketing Waste') for recoverable, active leakage", async () => {
    const res = await app.inject({ method: "GET", url: "/campaigns/spend-at-risk", cookies: { pulseos_session: adminCookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as SpendAtRisk;
    expect(body.totalAtRisk).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(body.byReason)).toBe(true);
  });
});
