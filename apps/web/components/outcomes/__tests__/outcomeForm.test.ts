import { describe, expect, it } from "vitest";
import type { CrmOutcomeVm, CustomFieldDefinitionVm } from "@pulseos/types";
import { blankOutcome, buildLogInput, defaultFollowUpLocal, formToCreateInput, formToUpdateInput, outcomeHint, outcomeToForm, validateOutcomeForm } from "../outcomeForm";

const callback: CrmOutcomeVm = { id: "o1", key: "needs_callback", label: "Needs callback", stage: "contacted", requiresFollowUp: true, allowsAppointment: false, asksReason: false, followUpType: "CALLBACK", sortOrder: 1, archived: false };
const notInterested: CrmOutcomeVm = { ...callback, id: "o2", key: "not_interested", label: "Not interested", stage: "lost", requiresFollowUp: false, asksReason: true, followUpType: "FOLLOW_UP" };
const interested: CrmOutcomeVm = { ...callback, id: "o3", key: "interested", label: "Interested", requiresFollowUp: false, allowsAppointment: true, followUpType: "FOLLOW_UP" };
const NOW = new Date("2026-10-01T10:00:00Z");

describe("outcome editor form", () => {
  it("a new outcome moves the Journey to Contacted and has no rules switched on", () => {
    expect(blankOutcome()).toMatchObject({ stage: "contacted", requiresFollowUp: false, allowsAppointment: false, asksReason: false, followUpType: "FOLLOW_UP", key: null });
  });
  it("create builds a key from the label; edit never sends the key", () => {
    const f = { ...blankOutcome(), label: " Waiting for family ", requiresFollowUp: true };
    expect(formToCreateInput(f)).toMatchObject({ key: "waiting_for_family", label: "Waiting for family", stage: "contacted", requiresFollowUp: true });
    const edit = formToUpdateInput({ ...outcomeToForm(callback), label: "Call me back" });
    expect(edit).toEqual({ label: "Call me back", stage: "contacted", requiresFollowUp: true, allowsAppointment: false, asksReason: false, followUpType: "CALLBACK" });
    expect(edit).not.toHaveProperty("key");
  });
  it("needs a label that can become a key", () => {
    expect(validateOutcomeForm({ ...blankOutcome(), label: "" })).toMatch(/label/i);
    expect(validateOutcomeForm({ ...blankOutcome(), label: "!!!" })).toMatch(/letters or numbers/i);
    expect(validateOutcomeForm({ ...blankOutcome(), label: "Fine" })).toBeNull();
    expect(validateOutcomeForm({ ...outcomeToForm(callback), label: "!!!" }, { editing: true })).toBeNull();
  });
});

describe("outcomeHint (plain words for each rule)", () => {
  it("states what logging the outcome will do", () => {
    expect(outcomeHint(callback)).toBe("Needs a follow-up date and time");
    expect(outcomeHint(notInterested)).toBe("Closes the journey as lost · asks why");
    expect(outcomeHint(interested)).toBe("Offers to book an appointment");
    expect(outcomeHint({ ...interested, allowsAppointment: false })).toBe("");
  });
});

describe("buildLogInput", () => {
  const base = { note: "  Spoke to the daughter ", reason: "", scheduleFollowUp: false, followUpLocal: "", fieldValues: {} };
  it("needs an outcome", () => {
    expect(buildLogInput(null, base, [], NOW)).toEqual({ error: "Choose what happened." });
  });
  it("an outcome that requires a follow-up needs a time in the future", () => {
    expect(buildLogInput(callback, base, [], NOW)).toEqual({ error: "Choose when to follow up." });
    expect(buildLogInput(callback, { ...base, followUpLocal: "2026-10-01T09:00" }, [], new Date("2026-10-01T10:00:00"))).toEqual({ error: "Pick a follow-up time in the future." });
    const ok = buildLogInput(callback, { ...base, followUpLocal: "2026-10-02T17:00" }, [], new Date("2026-10-01T10:00:00"));
    expect(ok).toEqual({ input: { outcomeKey: "needs_callback", note: "Spoke to the daughter", followUpAt: new Date("2026-10-02T17:00").toISOString() } });
  });
  it("an optional follow-up is only sent when scheduled; the reason only when the outcome asks for it", () => {
    expect(buildLogInput(interested, { ...base, followUpLocal: "2026-10-02T17:00" }, [], NOW)).toEqual({ input: { outcomeKey: "interested", note: "Spoke to the daughter" } });
    const sched = buildLogInput(interested, { ...base, scheduleFollowUp: true, followUpLocal: "2026-10-02T17:00" }, [], new Date("2026-10-01T10:00:00"));
    expect("input" in sched && sched.input.followUpAt).toBe(new Date("2026-10-02T17:00").toISOString());
    expect(buildLogInput(notInterested, { ...base, reason: " Chose another hospital " }, [], NOW)).toEqual({ input: { outcomeKey: "not_interested", note: "Spoke to the daughter", reason: "Chose another hospital" } });
    expect(buildLogInput(interested, { ...base, reason: "ignored" }, [], NOW)).toEqual({ input: { outcomeKey: "interested", note: "Spoke to the daughter" } });
  });
  it("includes follow-up field values, drops empties, and names a missing required field", () => {
    const fields = [
      { id: "f1", key: "budget", label: "Stated budget", fieldType: "NUMBER", required: true },
      { id: "f2", key: "when", label: "Best time", fieldType: "TEXT", required: false },
    ] as unknown as CustomFieldDefinitionVm[];
    expect(buildLogInput(interested, { ...base, fieldValues: {} }, fields, NOW)).toEqual({ error: "Fill in: Stated budget." });
    expect(buildLogInput(interested, { ...base, fieldValues: { budget: "45000", when: "" } }, fields, NOW)).toEqual({ input: { outcomeKey: "interested", note: "Spoke to the daughter", fieldValues: { budget: "45000" } } });
  });
});

describe("defaultFollowUpLocal", () => {
  it("suggests tomorrow at 10:00 in the local clock", () => {
    expect(defaultFollowUpLocal(new Date("2026-10-01T15:45:00"))).toBe("2026-10-02T10:00");
    expect(defaultFollowUpLocal(new Date("2026-12-31T08:00:00"))).toBe("2027-01-01T10:00");
  });
});
