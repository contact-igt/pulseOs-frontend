"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@pulseos/api-client";
import { Button, SideSheet, clinicHoursHint, clinicTimeBounds } from "@pulseos/ui";
import type { CrmOutcomeVm } from "@pulseos/types";
import { CheckRow, CONTROL, FormError, FormField, SelectInput, TextInput } from "@/components/settings/FormBits";
import { useHospitalTimeZone } from "@/lib/useHospitalTimeZone";
import { wallTimeToInstant } from "@/lib/hospitalTime";
import { buildFeedbackInput, buildLogCallInput, effectiveNextAction, initialCallForm, type CallFormState, type NextAction } from "./callForm";

const SERVER_ERRORS: Record<string, string> = {
  follow_up_required: "This outcome needs a callback — choose when.",
  callback_in_past: "Pick a callback time in the future.",
  occurred_in_future: "That time hasn't happened yet — pick a time that has passed.",
  outcome_not_found: "That outcome is no longer available. Choose another.",
  callback_exists: "This call already has a callback.",
  call_not_linked: "This call isn't linked to a journey yet.",
  appointment_time_in_past: "That time has already passed. Choose a later time.",
  outside_clinic_hours: "That time is outside clinic hours. Choose another.",
  resource_unavailable: "The doctor already has a patient at that time. Choose another time.",
  doctor_required: "Choose a doctor.",
  branch_required: "Choose a branch.",
  doctor_not_found: "That doctor is no longer available. Choose another.",
  branch_not_found: "That branch is no longer available. Choose another.",
  forbidden: "You don't have permission to book appointments.",
};

const NEXT_ACTIONS: { value: NextAction; label: string }[] = [
  { value: "none", label: "None" },
  { value: "callback", label: "Callback" },
  { value: "appointment", label: "Book appointment" },
];

const SEGMENT = "inline-flex min-h-11 flex-1 items-center justify-center rounded-control border px-3 text-sm font-medium transition sm:min-h-9";
const segmentTone = (active: boolean) => (active ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong bg-white text-ink hover:bg-primary-50/50");

function newRequestKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `call-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Target = { kind: "log"; journeyId: string } | { kind: "feedback"; callId: string; hasCallback: boolean; existingFeedback: string | null };

/**
 * "Log call" from a Journey (or "Add feedback" on an existing call). Everything about the patient — name, phone,
 * department, source, service — comes from the Journey, so staff only say what happened. A failed save keeps every
 * field; Save is locked while saving and carries a one-time key, so a double tap can never log the call twice.
 */
export function LogCallSheet({ target, patientName, onClose, onSaved }: { target: Target; patientName: string; onClose: () => void; onSaved?: () => void }) {
  const queryClient = useQueryClient();
  const timeZone = useHospitalTimeZone();
  const feedbackMode = target.kind === "feedback";
  const outcomes = useQuery({ queryKey: ["crm-outcomes", "active"], queryFn: () => api.crmOutcomes() });
  // Clinic hours, doctors and branches come from the hospital's own configuration (the same lookups the booking form and planner use).
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: api.lookups });
  const [state, setState] = useState<CallFormState>(() => ({ ...initialCallForm(new Date(), timeZone), feedback: target.kind === "feedback" ? (target.existingFeedback ?? "") : "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per opened sheet: a retry or double tap returns the first call instead of making a second.
  const [idempotencyKey] = useState(newRequestKey);

  const set = <K extends keyof CallFormState>(key: K, value: CallFormState[K]) => setState((s) => ({ ...s, [key]: value }));
  const outcome: CrmOutcomeVm | null = outcomes.data?.find((o) => o.key === state.outcomeKey) ?? null;
  const callbackNeeded = !!outcome?.requiresFollowUp;
  const callbackAllowed = !(target.kind === "feedback" && target.hasCallback);
  const next = effectiveNextAction(state, outcome);
  const doctors = lookups.data?.doctors ?? [];
  const branches = lookups.data?.branches ?? [];
  const hours = lookups.data?.clinicHours ?? null;
  const hoursHint = clinicHoursHint(hours);
  const bounds = clinicTimeBounds(hours, state.apptDate);
  const today = new Date().toLocaleDateString("en-CA", { timeZone });
  // The doctor to ask about: the one chosen, or the hospital's only one.
  const slotDoctor = state.apptDoctorId || (doctors.length === 1 ? doctors[0]!.id : "");
  const slotAt = next === "appointment" && state.apptDate && state.apptTime ? wallTimeToInstant(state.apptDate, state.apptTime, timeZone) : null;
  // Advisory only (debounced): the save itself decides. Tells staff at once that the doctor is taken at that time.
  // The answer is remembered with the slot it was for, so a changed time never shows the previous time's answer.
  const slotKey = slotDoctor && slotAt ? `${slotDoctor}|${slotAt.getTime()}` : "";
  const [slotAnswer, setSlotAnswer] = useState<{ key: string; busy: boolean } | null>(null);
  const slotBusy = !!slotKey && slotAnswer?.key === slotKey && slotAnswer.busy;
  useEffect(() => {
    if (!slotDoctor || !slotAt) return;
    let live = true;
    const t = setTimeout(() => {
      api.appointmentSlotCheck(slotDoctor, slotAt.toISOString()).then((r) => live && setSlotAnswer({ key: slotKey, busy: !r.available && !r.inPast && !r.outsideHours })).catch(() => undefined);
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [slotKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (saving) return;
    const now = new Date();
    const built = target.kind === "log" ? buildLogCallInput(state, outcome, timeZone, now, idempotencyKey, hours) : buildFeedbackInput(state, outcome, timeZone, now);
    if ("error" in built) return setError(built.error);
    setSaving(true);
    setError(null);
    try {
      if (target.kind === "log") await api.logCall(target.journeyId, built.input as Parameters<typeof api.logCall>[1]);
      else await api.callFeedback(target.callId, built.input as Parameters<typeof api.callFeedback>[1]);
      // A booked visit also lands on the Front Desk day, the planner and the appointment lists: refresh them all, no reload needed.
      for (const key of ["tasks", "journey", "journeys", "leads", "leads-summary", "patient360", "dashboard", "timeline", "calls", "appointments", "front-desk", "patients"]) queryClient.invalidateQueries({ queryKey: [key] });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(SERVER_ERRORS[err instanceof ApiError ? err.message : ""] ?? "Couldn't save this call — what you entered is still here. Try again.");
      setSaving(false);
    }
  }

  return (
    <SideSheet
      title={feedbackMode ? "Add feedback" : "Log call"}
      subtitle={patientName}
      onClose={onClose}
      testId="log-call"
      footer={
        <>
          <Button variant="secondary" className="min-h-11 sm:min-h-0" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" className="min-h-11 sm:min-h-0" onClick={save} disabled={saving} data-testid="log-call-save">
            {saving ? "Saving…" : feedbackMode ? "Save feedback" : next === "appointment" ? (state.apptConfirmed ? "Save call & confirm appointment" : "Save call & book appointment") : "Save call"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError message={error} testId="log-call-error" />

        {!feedbackMode && (
          <>
            <FormField label="Direction">
              <div role="radiogroup" aria-label="Direction" className="flex gap-2">
                {([["inbound", "Incoming"], ["outbound", "Outgoing"]] as const).map(([value, label]) => (
                  <button key={value} type="button" role="radio" aria-checked={state.direction === value} onClick={() => set("direction", value)} className={`${SEGMENT} ${segmentTone(state.direction === value)}`} data-testid={`log-call-direction-${value}`}>
                    {label}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="Did you speak?">
              <div role="radiogroup" aria-label="Did you speak?" className="flex gap-2">
                {([[true, "Connected"], [false, state.direction === "inbound" ? "Missed" : "No answer"]] as const).map(([value, label]) => (
                  <button key={String(value)} type="button" role="radio" aria-checked={state.connected === value} onClick={() => set("connected", value)} className={`${SEGMENT} ${segmentTone(state.connected === value)}`} data-testid={`log-call-connected-${value}`}>
                    {label}
                  </button>
                ))}
              </div>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Date" type="date" value={state.date} onChange={(e) => set("date", e.target.value)} data-testid="log-call-date" />
              <TextInput label="Time" type="time" value={state.time} onChange={(e) => set("time", e.target.value)} data-testid="log-call-time" />
            </div>

            {state.connected && (
              <FormField label="Duration" hint="Optional.">
                <div className="grid grid-cols-2 gap-3">
                  <input className={CONTROL} type="number" inputMode="numeric" min={0} step={1} placeholder="min" aria-label="Minutes" value={state.minutes} onChange={(e) => set("minutes", e.target.value)} data-testid="log-call-minutes" />
                  <input className={CONTROL} type="number" inputMode="numeric" min={0} max={59} step={1} placeholder="sec" aria-label="Seconds" value={state.seconds} onChange={(e) => set("seconds", e.target.value)} data-testid="log-call-seconds" />
                </div>
              </FormField>
            )}
          </>
        )}

        <FormField label="Staff feedback" hint="What was said, in your own words. This stays exactly as you write it.">
          <textarea className={`${CONTROL} h-28! py-2`} maxLength={2000} value={state.feedback} onChange={(e) => set("feedback", e.target.value)} data-testid="log-call-feedback" />
        </FormField>

        <FormField label="Outcome">
          <select className={CONTROL} value={state.outcomeKey} onChange={(e) => set("outcomeKey", e.target.value)} data-testid="log-call-outcome">
            <option value="">No outcome</option>
            {(outcomes.data ?? []).map((o) => (
              <option key={o.id} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Next action">
          <div role="radiogroup" aria-label="Next action" className="flex flex-wrap gap-2" data-testid="log-call-next-action">
            {NEXT_ACTIONS.filter((a) => (a.value === "callback" ? callbackAllowed : a.value === "appointment" ? !feedbackMode : true)).map((a) => {
              const disabled = a.value === "none" && callbackNeeded;
              return (
                <button key={a.value} type="button" role="radio" aria-checked={next === a.value} disabled={disabled} onClick={() => set("nextAction", a.value)} className={`${SEGMENT} ${segmentTone(next === a.value)} min-w-28 disabled:opacity-50`} data-testid={`log-call-next-${a.value}`}>
                  {a.label}
                </button>
              );
            })}
          </div>
          {callbackNeeded && <p className="mt-1 text-[11px] text-ink-2">This outcome needs a follow-up: schedule a callback or book the visit.</p>}
        </FormField>

        {callbackAllowed && next === "callback" && (
          <div className="space-y-3 rounded-card border border-line bg-surface-info/60 p-3.5" data-testid="log-call-callback-fields">
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Callback date" type="date" value={state.callbackDate} onChange={(e) => set("callbackDate", e.target.value)} data-testid="log-call-callback-date" />
              <TextInput label="Callback time" type="time" value={state.callbackTime} onChange={(e) => set("callbackTime", e.target.value)} data-testid="log-call-callback-time" />
            </div>
            <TextInput label="Note" value={state.callbackNote} maxLength={500} onChange={(e) => set("callbackNote", e.target.value)} placeholder="e.g. Call before noon" hint="Assigned to the journey's assigned team member (or you, if it has none)." data-testid="log-call-callback-note" />
          </div>
        )}

        {!feedbackMode && next === "appointment" && (
          <div className="space-y-3 rounded-card border border-line bg-surface-info/60 p-3.5" data-testid="log-call-appointment-fields">
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Appointment date" type="date" min={today} value={state.apptDate} onChange={(e) => set("apptDate", e.target.value)} data-testid="log-call-appt-date" />
              <TextInput label="Appointment time" type="time" {...(bounds ? { min: bounds.min, max: bounds.max } : {})} value={state.apptTime} onChange={(e) => set("apptTime", e.target.value)} data-testid="log-call-appt-time" />
            </div>
            {hoursHint && <p className="text-[11px] text-ink-2" data-testid="log-call-appt-hours">{hoursHint}</p>}
            {doctors.length > 1 && (
              <SelectInput label="Doctor" value={state.apptDoctorId} onChange={(e) => set("apptDoctorId", e.target.value)} data-testid="log-call-appt-doctor">
                <option value="">Choose a doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </SelectInput>
            )}
            {branches.length > 1 && (
              <SelectInput label="Branch" value={state.apptBranchId} onChange={(e) => set("apptBranchId", e.target.value)} data-testid="log-call-appt-branch">
                <option value="">Choose a branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </SelectInput>
            )}
            {slotBusy && <p className="text-xs font-medium text-warning" role="status" data-testid="log-call-appt-busy">The doctor already has a patient at this time. Choose another time.</p>}
            <CheckRow label="Appointment confirmed with patient" hint={state.apptConfirmed ? "The patient agreed on this call. The WhatsApp confirmation and a 1-hour reminder are scheduled." : "Only booked for now. No message goes to the patient until you confirm the appointment."} checked={state.apptConfirmed} onChange={(v) => set("apptConfirmed", v)} testId="log-call-appt-confirmed" />
          </div>
        )}
      </div>
    </SideSheet>
  );
}
