"use client";

import { useEffect, useState } from "react";
import type { AppointmentAction, AppointmentRow, AppointmentStatus } from "@pulseos/types";
import { Badge } from "./primitives";
import type { TimelineEventVm } from "./Timeline";
import { useDialogFocus } from "./useDialogFocus";
import { ConfirmDialog } from "./ConfirmDialog";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  requested: "Requested",
  scheduled: "Confirmed",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  waiting: "Waiting",
  with_doctor: "With Doctor",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<AppointmentStatus, "neutral" | "warning" | "danger" | "primary"> = {
  requested: "neutral",
  scheduled: "neutral",
  confirmed: "neutral",
  checked_in: "warning",
  waiting: "warning",
  with_doctor: "primary",
  completed: "neutral",
  no_show: "danger",
  cancelled: "neutral",
};

const PRIMARY_ACTION: Partial<Record<AppointmentStatus, { action: AppointmentAction; label: string }>> = {
  requested: { action: "confirm", label: "Confirm" },
  scheduled: { action: "confirm", label: "Confirm" },
  confirmed: { action: "check_in", label: "Check In" },
  checked_in: { action: "mark_waiting", label: "Mark Waiting" },
  waiting: { action: "send_to_doctor", label: "Send to Doctor" },
};

const CAN_NO_SHOW = new Set<AppointmentStatus>(["requested", "scheduled", "confirmed"]);
const CAN_CANCEL = new Set<AppointmentStatus>(["requested", "scheduled", "confirmed", "checked_in", "waiting"]);
const CAN_RESCHEDULE = new Set<AppointmentStatus>(["requested", "scheduled", "confirmed", "no_show", "cancelled"]);

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function AppointmentDrawer({
  appointment,
  recentEvents,
  onClose,
  onAction,
  onComplete,
  onReschedule,
  readOnly = false,
}: {
  appointment: AppointmentRow | null;
  recentEvents?: TimelineEventVm[];
  onClose: () => void;
  onAction: (row: AppointmentRow, action: AppointmentAction) => void;
  onComplete: (row: AppointmentRow) => void;
  onReschedule: (row: AppointmentRow, newIso: string) => void;
  /** Hide the Confirm/Check-In/Complete/Reschedule/No-show/Cancel actions for a viewer who can't call them (e.g. Doctor, VIEW_APPOINTMENTS only). */
  readOnly?: boolean;
}) {
  const [rescheduling, setRescheduling] = useState(false);
  const [newDateTime, setNewDateTime] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  useEffect(() => {
    setRescheduling(false);
    setNewDateTime("");
    setConfirmingCancel(false);
  }, [appointment?.id]);

  const dialogRef = useDialogFocus<HTMLDivElement>(!!appointment, onClose);

  if (!appointment) return null;
  const row = appointment;
  const primary = PRIMARY_ACTION[row.status];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Appointment details">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30 transition-opacity duration-200 motion-reduce:transition-none"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-neutral-200 bg-white shadow-xl transition-transform duration-200 motion-reduce:transition-none focus:outline-none"
        data-testid="appointment-drawer"
      >
        {/* Header */}
        <div className="border-b border-neutral-100 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-900">{row.patientName}</h2>
              <p className="mt-0.5 truncate text-xs text-neutral-500">{row.reason ?? "Consultation"}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close appointment details" className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-slate-900" data-testid="appointment-drawer-close">
              ✕
            </button>
          </div>
          <div className="mt-2">
            <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
          </div>
        </div>

        {/* Appointment details */}
        <div className="border-b border-neutral-100 p-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Appointment Details</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-neutral-500">Date &amp; time</dt><dd className="text-slate-900">{fmtDateTime(row.scheduledAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-500">Branch</dt><dd className="text-slate-900">{row.branchName ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-500">Doctor</dt><dd className="text-slate-900">{row.doctorName ?? "—"}</dd></div>
          </dl>
        </div>

        {/* Recent activity */}
        <div className="flex-1 border-b border-neutral-100 p-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Recent Activity</h3>
          {!recentEvents || recentEvents.length === 0 ? (
            <p className="text-xs text-neutral-400">No recent activity on this journey.</p>
          ) : (
            <ol className="space-y-2.5 border-l border-neutral-200 pl-3">
              {recentEvents.slice(0, 8).map((e) => (
                <li key={e.id}>
                  <p className="text-xs text-slate-900">{e.title}</p>
                  <p className="text-[11px] text-neutral-400">{fmtTime(e.occurredAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Operational context / patient link */}
        <div className="p-5">
          <a href={`/patients/${row.patientId}`} className="text-xs font-medium text-primary-700 hover:underline">
            View full patient context →
          </a>
        </div>

        {/* Actions */}
        {!readOnly && (
        <div className="sticky bottom-0 space-y-2 border-t border-neutral-100 bg-white p-4">
          {rescheduling ? (
            <div className="space-y-2">
              <input
                type="datetime-local"
                value={newDateTime}
                onChange={(e) => setNewDateTime(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!newDateTime}
                  onClick={() => {
                    onReschedule(row, new Date(newDateTime).toISOString());
                    setRescheduling(false);
                  }}
                  className="flex-1 rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-primary-700 disabled:opacity-40"
                >
                  Save new time
                </button>
                <button type="button" onClick={() => setRescheduling(false)} className="rounded border border-neutral-200 px-3 py-2 text-xs text-neutral-600 hover:bg-neutral-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {row.status === "with_doctor" && (
                <button
                  type="button"
                  onClick={() => onComplete(row)}
                  className="w-full rounded bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                  data-testid="drawer-action-complete"
                >
                  Complete Consultation
                </button>
              )}
              {primary && (
                <button
                  type="button"
                  onClick={() => onAction(row, primary.action)}
                  className="w-full rounded bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                  data-testid={`drawer-action-${primary.action}`}
                >
                  {primary.label}
                </button>
              )}

              <div className="flex gap-2">
                {CAN_RESCHEDULE.has(row.status) && (
                  <button
                    type="button"
                    onClick={() => setRescheduling(true)}
                    className="flex-1 rounded border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
                    data-testid="drawer-action-reschedule"
                  >
                    Reschedule
                  </button>
                )}
                {CAN_NO_SHOW.has(row.status) && (
                  <button
                    type="button"
                    onClick={() => onAction(row, "mark_no_show")}
                    className="flex-1 rounded border border-danger-100 px-3 py-2 text-xs font-medium text-danger-700 transition hover:bg-danger-100"
                    data-testid="drawer-action-no-show"
                  >
                    No-show
                  </button>
                )}
                {CAN_CANCEL.has(row.status) && (
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(true)}
                    className="flex-1 rounded border border-danger-100 px-3 py-2 text-xs font-medium text-danger-700 transition hover:bg-danger-100"
                    data-testid="drawer-action-cancel"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancel this appointment?"
        description={`This frees ${fmtDateTime(row.scheduledAt)} on ${row.doctorName ? `${row.doctorName}'s` : "the doctor's"} schedule and the patient will no longer be expected. PulseOS does not notify the patient automatically — let them know separately if they haven't already.`}
        confirmLabel="Cancel appointment"
        cancelLabel="Keep appointment"
        onConfirm={() => {
          setConfirmingCancel(false);
          onAction(row, "cancel");
        }}
        onCancel={() => setConfirmingCancel(false)}
      />
    </div>
  );
}
