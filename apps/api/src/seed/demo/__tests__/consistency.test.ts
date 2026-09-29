import { describe, expect, it } from "vitest";
import { journeyConfigProblems } from "../consistency.js";
import type { DemoJourneyConfig } from "../shared.js";
import { GYNECOLOGY_PATIENT_NAMES, JOURNEY_CONFIGS as GYN } from "../gynecology.js";
import { OPHTHALMOLOGY_PATIENT_NAMES, JOURNEY_CONFIGS as EYE } from "../ophthalmology.js";

const base: DemoJourneyConfig = { patientIdx: 0, journeyType: "X", source: "google", campaignKey: null, stage: "consulted", contactedOffsetDays: -1, createdOffsetDays: -2 };

describe("journeyConfigProblems", () => {
  it("accepts a coherent journey", () => {
    expect(journeyConfigProblems({ ...base, stage: "completed", treatment: { label: "T", status: "COMPLETED", estimatedValue: 1 }, revenueAmount: 1 })).toEqual([]);
  });
  it("flags a completed treatment on a journey still at treatment_advised", () => {
    const p = journeyConfigProblems({ ...base, stage: "treatment_advised", treatment: { label: "T", status: "COMPLETED", estimatedValue: 1 } });
    expect(p[0]).toMatch(/COMPLETED but stage is "treatment_advised"/);
  });
  it("flags a scheduled treatment that is not at the scheduled stage", () => {
    expect(journeyConfigProblems({ ...base, stage: "treatment_advised", treatment: { label: "T", status: "SCHEDULED", estimatedValue: 1 } })).toHaveLength(1);
  });
  it("flags a contacted-or-later journey with no contact date", () => {
    expect(journeyConfigProblems({ ...base, stage: "contacted", contactedOffsetDays: null })[0]).toMatch(/never contacted/);
  });
  it("flags an in-clinic appointment on a journey still at enquiry/booked", () => {
    expect(journeyConfigProblems({ ...base, stage: "booked", appt: { status: "waiting", offsetDays: 0, doctor: "d" } })[0]).toMatch(/waiting but stage/);
  });
  it("flags revenue without a completed treatment", () => {
    expect(journeyConfigProblems({ ...base, stage: "treatment_advised", treatment: { label: "T", status: "ADVISED", estimatedValue: 1 }, revenueAmount: 5 })[0]).toMatch(/revenue/);
  });
  it("flags an advised outcome that never advanced the stage", () => {
    expect(journeyConfigProblems({ ...base, stage: "attended", appt: { status: "completed", offsetDays: -1, doctor: "d" }, outcome: { value: "TREATMENT_ADVISED" } })[0]).toMatch(/TREATMENT_ADVISED/);
  });
});

describe("seeded demo journeys", () => {
  it.each([["gynecology", GYN, GYNECOLOGY_PATIENT_NAMES], ["ophthalmology", EYE, OPHTHALMOLOGY_PATIENT_NAMES]] as const)("%s configs have no contradictions", (_label, configs, names) => {
    const problems = configs.flatMap((c) => journeyConfigProblems(c).map((p) => `#${c.patientIdx} ${names[c.patientIdx]}: ${p}`));
    expect(problems).toEqual([]);
  });
});
