"use client";

import { useEffect, useState } from "react";
import type { AppointmentRow, CreateAppointmentInput, JourneyCardVm, LookupOption, PatientListRow } from "@pulseos/types";

type PatientRef = Pick<PatientListRow, "id" | "name" | "phone">;

const inputClass =
  "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500";
const labelClass = "mb-1 block text-xs font-medium text-neutral-600";

function defaultDateTime(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export function NewAppointmentDrawer({
  open,
  onClose,
  branches,
  doctors,
  initialPatient,
  onSearchPatients,
  onLoadPatientJourneys,
  onSubmit,
  onCreated,
  onCreateLeadInstead,
}: {
  open: boolean;
  onClose: () => void;
  branches: LookupOption[];
  doctors: LookupOption[];
  initialPatient?: PatientRef | null;
  onSearchPatients: (query: string) => Promise<PatientListRow[]>;
  onLoadPatientJourneys: (patientId: string) => Promise<JourneyCardVm[]>;
  onSubmit: (input: CreateAppointmentInput) => Promise<AppointmentRow>;
  onCreated?: (row: AppointmentRow) => void;
  onCreateLeadInstead?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PatientListRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<PatientRef | null>(initialPatient ?? null);
  const [journeys, setJourneys] = useState<JourneyCardVm[]>([]);
  const [journeyId, setJourneyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultDateTime());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setResults(null);
      setPatient(initialPatient ?? null);
      setJourneys([]);
      setJourneyId("");
      setBranchId("");
      setDoctorId("");
      setScheduledAt(defaultDateTime());
      setReason("");
      setError(null);
    }
  }, [open, initialPatient]);

  useEffect(() => {
    if (open && initialPatient) {
      onLoadPatientJourneys(initialPatient.id).then((rows) => {
        setJourneys(rows);
        setJourneyId(rows[0]?.id ?? "");
      });
    }
  }, [open, initialPatient, onLoadPatientJourneys]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function runSearch() {
    if (!search.trim()) return;
    setSearching(true);
    try {
      setResults(await onSearchPatients(search.trim()));
    } finally {
      setSearching(false);
    }
  }

  async function selectPatient(p: PatientListRow) {
    setPatient(p);
    setResults(null);
    const rows = await onLoadPatientJourneys(p.id);
    setJourneys(rows);
    setJourneyId(rows[0]?.id ?? "");
  }

  const canSubmit = patient && journeyId && branchId && doctorId && scheduledAt && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !patient) return;
    setSubmitting(true);
    setError(null);
    try {
      const row = await onSubmit({ patientId: patient.id, journeyId, branchId, doctorId, scheduledAt: new Date(scheduledAt).toISOString(), reason: reason.trim() || undefined });
      onCreated?.(row);
      onClose();
    } catch {
      setError("Could not book this appointment. Check the required fields and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="New Appointment">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/30 transition-opacity duration-200" />
      <form onSubmit={handleSubmit} className="relative flex h-full w-full max-w-md flex-col overflow-hidden border-l border-neutral-200 bg-white shadow-xl" data-testid="new-appointment-drawer">
        <div className="flex items-start justify-between gap-2 border-b border-neutral-100 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">New Appointment</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Book a visit for an existing patient and journey.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-slate-900" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className={labelClass} htmlFor="appt-patient-search">
              Patient <span className="text-danger-600">*</span>
            </label>
            {patient ? (
              <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm">
                <span className="text-primary-800">
                  {patient.name} <span className="text-primary-500">· {patient.phone}</span>
                </span>
                <button type="button" onClick={() => setPatient(null)} className="text-xs text-primary-600 hover:underline">
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    id="appt-patient-search"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
                    placeholder="Search by name or phone…"
                    className={inputClass}
                  />
                  <button type="button" onClick={runSearch} className="shrink-0 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                    {searching ? "…" : "Search"}
                  </button>
                </div>
                {results && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-neutral-200">
                    {results.length === 0 ? (
                      <div className="p-3 text-center">
                        <p className="text-xs text-neutral-400">No patient found.</p>
                        {onCreateLeadInstead && (
                          <button type="button" onClick={onCreateLeadInstead} className="mt-1 text-xs font-medium text-primary-600 hover:underline">
                            Create Lead / Patient instead →
                          </button>
                        )}
                      </div>
                    ) : (
                      results.map((p) => (
                        <button key={p.id} type="button" onClick={() => selectPatient(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-neutral-50">
                          <span className="text-slate-900">{p.name}</span>
                          <span className="text-neutral-400">{p.phone}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {patient && (
            <div>
              <label className={labelClass} htmlFor="appt-journey">
                Journey <span className="text-danger-600">*</span>
              </label>
              <select id="appt-journey" required value={journeyId} onChange={(e) => setJourneyId(e.target.value)} className={inputClass}>
                {journeys.length === 0 && <option value="">No active journeys</option>}
                {journeys.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.journeyType} — {j.stage}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="appt-branch">
                Branch <span className="text-danger-600">*</span>
              </label>
              <select id="appt-branch" required value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
                <option value="">Select…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="appt-doctor">
                Doctor <span className="text-danger-600">*</span>
              </label>
              <select id="appt-doctor" required value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
                <option value="">Select…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="appt-time">
              Date &amp; time <span className="text-danger-600">*</span>
            </label>
            <input id="appt-time" type="datetime-local" required value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass} htmlFor="appt-reason">
              Reason
            </label>
            <input id="appt-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
          </div>

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
          <button type="submit" disabled={!canSubmit} className="flex-1 rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-40" data-testid="new-appointment-submit">
            {submitting ? "Booking…" : "Book Appointment"}
          </button>
        </div>
      </form>
    </div>
  );
}
