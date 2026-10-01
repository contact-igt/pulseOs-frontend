"use client";

import { useState } from "react";
import {
  INTERACTION_CHANNEL_LABEL,
  MANUAL_INTERACTION_CHANNELS,
  UNKNOWN_PATIENT_NAME,
  type CreateLeadInput,
  type InteractionChannel,
  type LeadSourceVm,
  type CreateLeadResult,
  type CustomFieldDefinitionVm,
  type LeadPhoneLookupResult,
  type Lookups,
  type SourceChannel,
  type SpecialtyTemplateVm,
  type TaskPriority,
  type TaskType,
} from "@pulseos/types";
import { useDialogFocus } from "./useDialogFocus";
import { CustomFieldInputs, defaultsFor, normalizeFieldValues } from "./CustomFieldInputs";

const FOLLOW_UP_TYPES: TaskType[] = ["CALLBACK", "FOLLOW_UP", "APPOINTMENT_CONFIRMATION", "OTHER"];

const inputClass =
  "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500";
const labelClass = "mb-1 block text-xs font-medium text-neutral-600";

interface FormState {
  patientId?: string;
  name: string;
  age: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  preferredLanguage: string;
  specialtyKey: string;
  branchId: string;
  doctorId: string;
  sourceKey: string;
  channel: InteractionChannel | "";
  campaignId: string;
  journeyType: string;
  ownerId: string;
  priority: TaskPriority;
  notes: string;
  customFieldValues: Record<string, unknown>;
  createFollowUp: boolean;
  followUpType: TaskType;
  followUpDueAt: string;
  followUpAssignedTo: string;
}

function defaultDueAt(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function emptyForm(sourceKey: string): FormState {
  return {
    name: "",
    age: "",
    dateOfBirth: "",
    phone: "",
    email: "",
    preferredLanguage: "English",
    specialtyKey: "",
    branchId: "",
    doctorId: "",
    sourceKey,
    channel: "",
    campaignId: "",
    journeyType: "",
    ownerId: "",
    priority: "normal",
    notes: "",
    customFieldValues: {},
    createFollowUp: false,
    followUpType: "CALLBACK",
    followUpDueAt: defaultDueAt(),
    followUpAssignedTo: "",
  };
}

export function AddLeadDrawer({
  open,
  onClose,
  specialties,
  lookups,
  leadSources,
  defaultSource,
  onPhoneLookup,
  onLoadCustomFields,
  onSubmit,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  specialties: SpecialtyTemplateVm[];
  lookups: Lookups;
  /** The sources the hospital offers for a new lead (non-archived). */
  leadSources: LeadSourceVm[];
  /** Preselects the first offered source whose coarse bucket matches (e.g. from a campaign page). */
  defaultSource?: SourceChannel;
  onPhoneLookup: (phone: string) => Promise<LeadPhoneLookupResult>;
  onLoadCustomFields: (specialtyKey: string) => Promise<CustomFieldDefinitionVm[]>;
  onSubmit: (input: CreateLeadInput) => Promise<CreateLeadResult>;
  onCreated?: (result: CreateLeadResult) => void;
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm((defaultSource && leadSources.find((s) => s.bucket === defaultSource)?.key) || leadSources[0]?.key || ""));
  const [existingPatient, setExistingPatient] = useState<{ id: string; name: string; activeJourneyCount: number } | null>(null);
  const [phoneChecked, setPhoneChecked] = useState(false);
  const [fields, setFields] = useState<CustomFieldDefinitionVm[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialogFocus<HTMLFormElement>(open, onClose);

  if (!open) return null;

  async function checkPhone() {
    if (form.phone.replace(/\D/g, "").length < 10) return;
    const result = await onPhoneLookup(form.phone);
    setPhoneChecked(true);
    if (result.patient) {
      setExistingPatient(result.patient);
      // A patient whose name is not known yet has nothing to prefill — the name stays editable so it can be added.
      const known = result.patient.name !== UNKNOWN_PATIENT_NAME;
      setForm((f) => ({ ...f, patientId: result.patient!.id, name: known ? result.patient!.name : "" }));
    } else {
      setExistingPatient(null);
      setForm((f) => ({ ...f, patientId: undefined }));
    }
  }

  async function onSpecialtyChange(key: string) {
    const template = specialties.find((s) => s.key === key);
    setForm((f) => ({ ...f, specialtyKey: key, journeyType: template?.defaultJourneyType ?? f.journeyType, customFieldValues: {} }));
    const activeFields = key ? await onLoadCustomFields(key) : [];
    setFields(activeFields);
    // Pre-fill the defaults configured for these fields (Settings → CRM Fields).
    setForm((f) => (f.specialtyKey === key ? { ...f, customFieldValues: defaultsFor(activeFields) } : f));
  }

  function setCustomField(key: string, value: unknown) {
    setForm((f) => ({ ...f, customFieldValues: { ...f.customFieldValues, [key]: value } }));
  }

  const canSubmit = form.phone.trim() && form.sourceKey && form.specialtyKey && form.branchId && form.journeyType.trim() && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const input: CreateLeadInput = {
        patientId: form.patientId,
        name: form.name.trim() || undefined,
        age: form.age.trim() ? Number(form.age) : undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        preferredLanguage: form.preferredLanguage || undefined,
        specialtyKey: form.specialtyKey,
        branchId: form.branchId,
        doctorId: form.doctorId || undefined,
        sourceKey: form.sourceKey,
        channel: form.channel || undefined,
        campaignId: form.campaignId || undefined,
        journeyType: form.journeyType.trim(),
        ownerId: form.ownerId || undefined,
        priority: form.priority,
        notes: form.notes.trim() || undefined,
        customFieldValues: normalizeFieldValues(fields, form.customFieldValues),
        followUp: form.createFollowUp ? { type: form.followUpType, dueAt: new Date(form.followUpDueAt).toISOString(), assignedTo: form.followUpAssignedTo || undefined } : null,
      };
      const result = await onSubmit(input);
      onCreated?.(result);
      onClose();
    } catch {
      setError("Could not create this lead. Check the required fields and try again.");
      // See AddPatientDrawer: disabling the submit button on `submitting`
      // blurs it to <body>, outside the dialog, which would let a failed
      // submit silently escape the Tab trap. Pull focus back in.
      dialogRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  const selectedBucket = leadSources.find((s) => s.key === form.sourceKey)?.bucket;
  const campaignsForSource = lookups.campaigns.filter((c) => c.source === selectedBucket);
  const selectedService = specialties.find((s) => s.key === form.specialtyKey);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Add Lead">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 drawer-backdrop bg-slate-900/30" />
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={handleSubmit}
        className="relative flex h-full w-full max-w-lg flex-col overflow-hidden drawer-panel focus:outline-none"
        data-testid="add-lead-drawer"
      >
        <div className="flex items-start justify-between gap-2 border-b border-line p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add Lead</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Create a new enquiry and assign the next action.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-slate-900" aria-label="Close" data-testid="add-lead-drawer-close">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Patient */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Patient</h3>
            <div className="space-y-3">
              <div>
                <label className={labelClass} htmlFor="lead-phone">
                  Phone <span className="text-danger-500">*</span>
                </label>
                <input
                  id="lead-phone"
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, phone: e.target.value }));
                    setPhoneChecked(false);
                  }}
                  onBlur={checkPhone}
                  className={inputClass}
                  placeholder="+91 98765 43210"
                  autoComplete="off"
                  data-testid="lead-phone-input"
                />
                {phoneChecked && existingPatient && (
                  <p className="mt-1.5 rounded-lg bg-primary-50 px-2.5 py-1.5 text-xs text-primary-700" data-testid="existing-patient-banner">
                    Existing patient found — {existingPatient.name} ({existingPatient.activeJourneyCount} active journey{existingPatient.activeJourneyCount === 1 ? "" : "s"}). This will
                    create a new journey, not a duplicate patient.
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="lead-name">
                  Name
                </label>
                <input
                  id="lead-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={!!existingPatient && form.name !== "" && existingPatient.name !== UNKNOWN_PATIENT_NAME}
                  placeholder="Add when you have it"
                  className={`${inputClass} disabled:bg-neutral-50 disabled:text-neutral-500`}
                  data-testid="lead-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="lead-age">
                    Age
                  </label>
                  <input id="lead-age" type="number" inputMode="numeric" min={0} max={120} step={1} value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} className={inputClass} placeholder="Years" data-testid="lead-age-input" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="lead-dob">
                    Date of birth
                  </label>
                  <input id="lead-dob" type="date" value={form.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className={inputClass} data-testid="lead-dob-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="lead-email">
                    Email
                  </label>
                  <input id="lead-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="lead-language">
                    Preferred language
                  </label>
                  <input id="lead-language" type="text" value={form.preferredLanguage} onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))} className={inputClass} />
                </div>
              </div>
            </div>
          </section>

          {/* Enquiry details */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Enquiry Details</h3>
            <div className="space-y-3">
              <div>
                <label className={labelClass} htmlFor="lead-specialty">
                  Service / enquiry <span className="text-danger-500">*</span>
                </label>
                <select id="lead-specialty" required value={form.specialtyKey} onChange={(e) => onSpecialtyChange(e.target.value)} className={inputClass} data-testid="lead-specialty-select">
                  <option value="">Select service…</option>
                  {specialties.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
                {selectedService?.departmentName && (
                  <p className="mt-1 text-[11px] text-neutral-500" data-testid="lead-department">
                    Department: {selectedService.departmentName}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="lead-branch">
                    Branch <span className="text-danger-500">*</span>
                  </label>
                  <select id="lead-branch" required value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))} className={inputClass}>
                    <option value="">Select branch…</option>
                    {lookups.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="lead-doctor">
                    Preferred doctor
                  </label>
                  <select id="lead-doctor" value={form.doctorId} onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))} className={inputClass}>
                    <option value="">No preference</option>
                    {lookups.doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="lead-source">
                    Source <span className="text-danger-500">*</span>
                  </label>
                  <select
                    id="lead-source"
                    required
                    value={form.sourceKey}
                    onChange={(e) => setForm((f) => ({ ...f, sourceKey: e.target.value, campaignId: "" }))}
                    className={inputClass}
                    data-testid="lead-source-select"
                  >
                    {leadSources.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-neutral-500">Where the patient originally came from.</p>
                </div>
                <div>
                  <label className={labelClass} htmlFor="lead-campaign">
                    Campaign
                  </label>
                  <select id="lead-campaign" value={form.campaignId} onChange={(e) => setForm((f) => ({ ...f, campaignId: e.target.value }))} className={inputClass} disabled={campaignsForSource.length === 0}>
                    <option value="">{campaignsForSource.length === 0 ? "No campaigns for this source" : "None"}</option>
                    {campaignsForSource.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="lead-channel">
                  How did they get in touch?
                </label>
                <select id="lead-channel" value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as InteractionChannel | "" }))} className={inputClass} data-testid="lead-channel-select">
                  <option value="">Not specified</option>
                  {MANUAL_INTERACTION_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {INTERACTION_CHANNEL_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="lead-journey-type">
                  Journey type <span className="text-danger-500">*</span>
                </label>
                <input id="lead-journey-type" type="text" required value={form.journeyType} onChange={(e) => setForm((f) => ({ ...f, journeyType: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="lead-owner">
                    Owner / Coordinator
                  </label>
                  <select id="lead-owner" value={form.ownerId} onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value }))} className={inputClass}>
                    <option value="">Unassigned</option>
                    {lookups.owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="lead-priority">
                    Priority
                  </label>
                  <select id="lead-priority" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))} className={inputClass}>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="lead-notes">
                  Notes
                </label>
                <textarea id="lead-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={inputClass} />
              </div>
            </div>
          </section>

          {/* Specialty custom fields */}
          {fields.length > 0 && (
            <section data-testid="lead-custom-fields">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">{specialties.find((s) => s.key === form.specialtyKey)?.displayName} Details</h3>
              <CustomFieldInputs fields={fields} values={form.customFieldValues} onChange={setCustomField} idPrefix="lead-field" testId="lead-custom-field-inputs" />
            </section>
          )}

          {/* Next action */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Next Action</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="followup" checked={!form.createFollowUp} onChange={() => setForm((f) => ({ ...f, createFollowUp: false }))} className="h-3.5 w-3.5 text-primary-600" />
                No follow-up yet
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="followup" checked={form.createFollowUp} onChange={() => setForm((f) => ({ ...f, createFollowUp: true }))} className="h-3.5 w-3.5 text-primary-600" />
                Create first follow-up
              </label>
            </div>
            {form.createFollowUp && (
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                <div>
                  <label className={labelClass} htmlFor="followup-type">
                    Type
                  </label>
                  <select id="followup-type" value={form.followUpType} onChange={(e) => setForm((f) => ({ ...f, followUpType: e.target.value as TaskType }))} className={inputClass}>
                    {FOLLOW_UP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="followup-due">
                    Due date/time
                  </label>
                  <input id="followup-due" type="datetime-local" value={form.followUpDueAt} onChange={(e) => setForm((f) => ({ ...f, followUpDueAt: e.target.value }))} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass} htmlFor="followup-assignee">
                    Assigned user
                  </label>
                  <select id="followup-assignee" value={form.followUpAssignedTo} onChange={(e) => setForm((f) => ({ ...f, followUpAssignedTo: e.target.value }))} className={inputClass}>
                    <option value="">Same as owner</option>
                    {lookups.owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </section>

          {error && (
            <p role="alert" className="rounded-lg bg-danger-100 px-3 py-2 text-xs text-danger-700">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-line bg-white/90 p-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-control border border-line-strong px-3 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 rounded-control bg-primary-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-40"
            data-testid="add-lead-submit"
          >
            {submitting ? "Creating…" : "Create Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
