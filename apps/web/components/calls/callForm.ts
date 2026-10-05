import type { CallDirection, CallFeedbackInput, ClinicHours, CrmOutcomeVm, LogCallInput } from "@pulseos/types";
import { clinicHoursError } from "@pulseos/ui";
import { instantToWallTime, wallTimeToInstant } from "@/lib/hospitalTime";

export interface CallFormState {
  direction: CallDirection;
  connected: boolean;
  /** When the call happened, as hospital-local wall time. */
  date: string;
  time: string;
  minutes: string;
  seconds: string;
  feedback: string;
  outcomeKey: string;
  /** What happens next. A booked visit IS the follow-up, so it is instead of a callback, never alongside it. */
  nextAction: NextAction;
  callbackDate: string;
  callbackTime: string;
  callbackNote: string;
  /** Visit to book from this call (hospital wall time). Doctor / branch stay "" when the hospital has only one of each. */
  apptDate: string;
  apptTime: string;
  apptDoctorId: string;
  apptBranchId: string;
  /** The patient agreed to this slot during the call → CONFIRMED (confirmation + reminders follow); off → only BOOKED. */
  apptConfirmed: boolean;
}

export type NextAction = "none" | "callback" | "appointment";

/** An outcome that needs a follow-up turns "None" into a callback; a booked visit satisfies it too. */
export function effectiveNextAction(state: Pick<CallFormState, "nextAction">, outcome: CrmOutcomeVm | null): NextAction {
  return state.nextAction === "none" && outcome?.requiresFollowUp ? "callback" : state.nextAction;
}

/** A call is logged right after it happens: now, in the hospital's clock. The callback defaults to tomorrow 11:00. */
export function initialCallForm(now: Date, timeZone: string): CallFormState {
  const here = instantToWallTime(now, timeZone);
  const tomorrow = instantToWallTime(new Date(now.getTime() + 24 * 3_600_000), timeZone);
  return { direction: "inbound", connected: true, date: here.date, time: here.time, minutes: "", seconds: "", feedback: "", outcomeKey: "", nextAction: "none", callbackDate: tomorrow.date, callbackTime: "11:00", callbackNote: "", apptDate: tomorrow.date, apptTime: "", apptDoctorId: "", apptBranchId: "", apptConfirmed: true };
}

type Built<T> = { input: T } | { error: string };

function callbackFrom(state: CallFormState, outcome: CrmOutcomeVm | null, timeZone: string, now: Date): Built<LogCallInput["callback"] | undefined> {
  if (effectiveNextAction(state, outcome) !== "callback") return { input: undefined };
  const due = wallTimeToInstant(state.callbackDate, state.callbackTime, timeZone);
  if (!due) return { error: "Choose the callback date and time." };
  if (due.getTime() <= now.getTime()) return { error: "Pick a callback time in the future." };
  return { input: { dueAt: due.toISOString(), note: state.callbackNote.trim() || undefined } };
}

/** The visit to book. Checked here too, so the typist sees the problem at once; the server is still the authority. */
function appointmentFrom(state: CallFormState, timeZone: string, now: Date, hours: ClinicHours | null | undefined): Built<LogCallInput["appointment"]> {
  if (!state.apptDate || !state.apptTime) return { error: "Choose the appointment date and time." };
  const closed = clinicHoursError(hours, state.apptDate, state.apptTime);
  if (closed) return { error: closed };
  const at = wallTimeToInstant(state.apptDate, state.apptTime, timeZone);
  if (!at) return { error: "Choose the appointment date and time." };
  if (at.getTime() < now.getTime() - 60_000) return { error: "That time has already passed. Choose a later time." };
  return {
    input: {
      scheduledAt: at.toISOString(),
      confirmed: state.apptConfirmed,
      ...(state.apptDoctorId ? { doctorId: state.apptDoctorId } : {}),
      ...(state.apptBranchId ? { branchId: state.apptBranchId } : {}),
    },
  };
}

export function buildLogCallInput(state: CallFormState, outcome: CrmOutcomeVm | null, timeZone: string, now: Date, idempotencyKey: string, hours?: ClinicHours | null): Built<LogCallInput> {
  const occurred = wallTimeToInstant(state.date, state.time, timeZone);
  if (!occurred) return { error: "Choose when the call happened." };
  if (occurred.getTime() > now.getTime() + 5 * 60_000) return { error: "That time hasn't happened yet — pick a time that has passed." };
  let durationSeconds: number | undefined;
  if (state.connected && (state.minutes.trim() || state.seconds.trim())) {
    const m = state.minutes.trim() ? Number(state.minutes) : 0;
    const s = state.seconds.trim() ? Number(state.seconds) : 0;
    if (!Number.isInteger(m) || !Number.isInteger(s) || m < 0 || s < 0 || s > 59 || m > 1440) return { error: "Enter the duration as whole minutes and seconds (0–59)." };
    durationSeconds = m * 60 + s;
  }
  const callback = callbackFrom(state, outcome, timeZone, now);
  if ("error" in callback) return callback;
  let appointment: LogCallInput["appointment"];
  if (effectiveNextAction(state, outcome) === "appointment") {
    const booked = appointmentFrom(state, timeZone, now, hours);
    if ("error" in booked) return booked;
    appointment = booked.input;
  }
  return {
    input: {
      direction: state.direction,
      connected: state.connected,
      occurredAt: occurred.toISOString(),
      durationSeconds,
      staffFeedback: state.feedback.trim() || undefined,
      outcomeKey: outcome?.key,
      callback: callback.input,
      ...(appointment ? { appointment } : {}),
      idempotencyKey,
    },
  };
}

export function buildFeedbackInput(state: CallFormState, outcome: CrmOutcomeVm | null, timeZone: string, now: Date): Built<CallFeedbackInput> {
  const callback = callbackFrom(state, outcome, timeZone, now);
  if ("error" in callback) return callback;
  const feedback = state.feedback.trim();
  if (!feedback && !outcome && !callback.input) return { error: "Add some feedback, pick an outcome or ask for a callback." };
  return { input: { staffFeedback: feedback || undefined, outcomeKey: outcome?.key, callback: callback.input } };
}
