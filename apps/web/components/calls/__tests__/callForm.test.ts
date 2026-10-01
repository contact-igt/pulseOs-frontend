import { describe, expect, it } from "vitest";
import type { CrmOutcomeVm } from "@pulseos/types";
import { buildFeedbackInput, buildLogCallInput, initialCallForm } from "../callForm";

const TZ = "Asia/Kolkata";
const NOW = new Date("2026-10-01T12:00:00.000Z"); // 17:30 IST
const needsCallback = { id: "o1", key: "needs_callback", label: "Needs callback", stage: "contacted", requiresFollowUp: true, allowsAppointment: false, asksReason: false, followUpType: "CALLBACK", sortOrder: 1, archived: false } as CrmOutcomeVm;
const interested = { ...needsCallback, id: "o2", key: "interested", label: "Interested", requiresFollowUp: false } as CrmOutcomeVm;

describe("Log Call form", () => {
  it("starts as an incoming connected call happening now, in the hospital clock, with a tomorrow 11:00 callback ready", () => {
    expect(initialCallForm(NOW, TZ)).toMatchObject({ direction: "inbound", connected: true, date: "2026-10-01", time: "17:30", callbackDate: "2026-10-02", callbackTime: "11:00" });
  });

  it("builds the request: occurred time and callback are hospital wall time converted to instants; minutes and seconds become seconds", () => {
    const s = { ...initialCallForm(NOW, TZ), minutes: "4", seconds: "38", feedback: "  Will confirm after family.  ", outcomeKey: "needs_callback" };
    const built = buildLogCallInput(s, needsCallback, TZ, NOW, "key-12345678");
    expect(built).toEqual({ input: { direction: "inbound", connected: true, occurredAt: "2026-10-01T12:00:00.000Z", durationSeconds: 278, staffFeedback: "Will confirm after family.", outcomeKey: "needs_callback", callback: { dueAt: "2026-10-02T05:30:00.000Z", note: undefined }, idempotencyKey: "key-12345678" } });
  });

  it("an outcome that needs a follow-up always asks for one; an optional outcome only if the person turns it on", () => {
    const base = initialCallForm(NOW, TZ);
    expect("input" in buildLogCallInput(base, interested, TZ, NOW, "k-12345678") && (buildLogCallInput(base, interested, TZ, NOW, "k-12345678") as { input: { callback?: unknown } }).input.callback).toBeUndefined();
    const withCallback = buildLogCallInput({ ...base, callbackOn: true }, interested, TZ, NOW, "k-12345678");
    expect("input" in withCallback && withCallback.input.callback).toBeTruthy();
    const required = buildLogCallInput({ ...base, callbackDate: "2026-10-01", callbackTime: "09:00" }, needsCallback, TZ, NOW, "k-12345678");
    expect(required).toEqual({ error: "Pick a callback time in the future." });
  });

  it("refuses a call time that has not happened yet, and bad durations; duration is ignored when nobody connected", () => {
    const base = initialCallForm(NOW, TZ);
    expect(buildLogCallInput({ ...base, time: "23:00" }, null, TZ, NOW, "k-12345678")).toHaveProperty("error");
    expect(buildLogCallInput({ ...base, minutes: "1", seconds: "75" }, null, TZ, NOW, "k-12345678")).toHaveProperty("error");
    const missed = buildLogCallInput({ ...base, connected: false, minutes: "9" }, null, TZ, NOW, "k-12345678") as { input: { durationSeconds?: number } };
    expect(missed.input.durationSeconds).toBeUndefined();
  });

  it("feedback on an existing call needs something to say", () => {
    const base = initialCallForm(NOW, TZ);
    expect(buildFeedbackInput(base, null, TZ, NOW)).toHaveProperty("error");
    expect(buildFeedbackInput({ ...base, feedback: "Spoke to her." }, null, TZ, NOW)).toEqual({ input: { staffFeedback: "Spoke to her.", outcomeKey: undefined, callback: undefined } });
  });
});
