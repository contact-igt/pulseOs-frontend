"use client";

import { useState } from "react";
import type {
  CreateLeadInput,
  CreateLeadResult,
  CustomFieldDefinitionVm,
  LeadPhoneLookupResult,
  Lookups,
  SourceChannel,
  SpecialtyTemplateVm,
  TaskPriority,
  TaskType,
} from "@pulseos/types";
import { useDialogFocus } from "./useDialogFocus";

const SOURCE_OPTIONS: { value: SourceChannel; label: string }[] = [
  { value: "meta", label: "Meta Ads" },
  { value: "google", label: "Google Ads" },
  { value: "website", label: "Website" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Phone" },
  { value: "walk_in", label: "Walk-in" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

const FOLLOW_UP_TYPES: TaskType[] = ["CALLBACK", "FOLLOW_UP", "APPOINTMENT_CONFIRMATION", "OTHER"];

const inputClass =
  "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500";
const labelClass = "mb-1 block text-xs font-medium text-neutral-600";

interface FormState {
  patientId?: string;
  name: string;
  phone: string;
  email: string;
  preferredLanguage: string;
  specialtyKey: string;
  branchId: string;
  doctorId: string;
  source: SourceChannel;
  campaignId: string;
  journeyType: string;
  ownerId: string;
  priority: TaskPriority;
  notes: string;
  customFieldValues: Record<string, string | boolean>;
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

function emptyForm(defaultSource?: SourceChannel): FormState {
  return {
    name: "",
    phone: "",
    email: "",
    preferredLanguage: "English",
    specialtyKey: "",
    branchId: "",
    doctorId: "",
    source: defaultSource ?? "website",
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
  defaultSource?: SourceChannel;
  onPhoneLookup: (phone: string) => Promise<LeadPhoneLookupResult>;
  onLoadCustomFields: (specialtyKey: string) => Promise<CustomFieldDefinitionVm[]>;
  onSubmit: (input: CreateLeadInput) => Promise<CreateLeadResult>;
  onCreated?: (result: CreateLeadResult) => void;
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultSource));
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
      setForm((f) => ({ ...f, patientId: result.patient!.id, name: result.patient!.name }));
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
  }

  function setCustomField(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, customFieldValues: { ...f.customFieldValues, [key]: value } }));
  }

  const canSubmit = form.name.trim() && form.phone.trim() && form.specialtyKey && form.branchId && form.journeyType.trim() && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const input: CreateLeadInput = {
        patientId: form.patientId,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        preferredLanguage: form.preferredLanguage || undefined,
        specialtyKey: form.specialtyKey,
        branchId: form.branchId,
        doctorId: form.doctorId || undefined,
        source: form.source,
        campaignId: form.campaignId || undefined,
        journeyType: form.journeyType.trim(),
        ownerId: form.ownerId || undefined,
        priority: form.priority,
        notes: form.notes.trim() || undefined,
        customFieldValues: Object.keys(form.customFieldValues).length > 0 ? form.customFieldValues : undefined,
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

  const campaignsForSource = lookups.campaigns.filter((c) => c.source === form.source);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Add Lead">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/30 transition-opacity duration-200" />
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={handleSubmit}
        className="relative flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-neutral-200 bg-white shadow-xl transition-transform duration-200 focus:outline-none"
        data-testid="add-lead-drawer"
      >
        <div className="flex items-start justify-between gap-2 border-b border-neutral-100 p-5">
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
                  Name <span className="text-danger-500">*</span>
                </label>
                <input
                  id="lead-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={!!existingPatient}
                  className={`${inputClass} disabled:bg-neutral-50 disabled:text-neutral-500`}
                />
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
                  Specialty / Service <span className="text-danger-500">*</span>
                </label>
                <select id="lead-specialty" required value={form.specialtyKey} onChange={(e) => onSpecialtyChange(e.target.value)} className={inputClass} data-testid="lead-specialty-select">
                  <option value="">Select specialty…</option>
                  {specialties.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
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
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as SourceChannel, campaignId: "" }))}
                    className={inputClass}
                  >
                    {SOURCE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
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
              <div className="grid grid-cols-2 gap-3">
                {fields.map((field) => (
                  <div key={field.id} className={field.fieldType === "TEXT" ? "col-span-2" : ""}>
                    <label className={labelClass} htmlFor={`field-${field.id}`}>
                      {field.label} {field.required && <span className="text-danger-500">*</span>}
                    </label>
                    {field.fieldType === "BOOLEAN" ? (
                      <label className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-slate-700">
                        <input
                          id={`field-${field.id}`}
                          type="checkbox"
                          checked={!!form.customFieldValues[field.key]}
                          onChange={(e) => setCustomField(field.key, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-600"
                        />
                        Yes
                      </label>
                    ) : field.fieldType === "SELECT" ? (
                      <select id={`field-${field.id}`} required={field.required} value={(form.customFieldValues[field.key] as string) ?? ""} onChange={(e) => setCustomField(field.key, e.target.value)} className={inputClass}>
                        <option value="">Select…</option>
                        {(field.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.fieldType === "NUMBER" ? (
                      <input id={`field-${field.id}`} type="number" required={field.required} value={(form.customFieldValues[field.key] as string) ?? ""} onChange={(e) => setCustomField(field.key, e.target.value)} className={inputClass} />
                    ) : field.fieldType === "DATE" ? (
                      <input id={`field-${field.id}`} type="date" required={field.required} value={(form.customFieldValues[field.key] as string) ?? ""} onChange={(e) => setCustomField(field.key, e.target.value)} className={inputClass} />
                    ) : (
                      <input id={`field-${field.id}`} type="text" required={field.required} value={(form.customFieldValues[field.key] as string) ?? ""} onChange={(e) => setCustomField(field.key, e.target.value)} className={inputClass} />
                    )}
                  </div>
                ))}
              </div>
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

        <div className="sticky bottom-0 flex gap-2 border-t border-neutral-100 bg-white p-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-40"
            data-testid="add-lead-submit"
          >
            {submitting ? "Creating…" : "Create Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
