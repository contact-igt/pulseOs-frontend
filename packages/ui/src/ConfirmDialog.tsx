"use client";

import { useDialogFocus } from "./useDialogFocus";

/**
 * Shared confirmation dialog for destructive/consequential actions (Cancel
 * Appointment, Decline Treatment, Close Conversation, Archive field, …) — one
 * implementation so every confirmation gets the same focus trap, Escape/
 * backdrop-close-as-cancel, and visual treatment instead of a bespoke
 * `window.confirm` or one-off modal per call site. `description` should
 * state the actual consequence, not a generic "Are you sure?".
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for irreversible/destructive actions (the default); false for a merely consequential one. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(open, onCancel);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cancel" onClick={onCancel} className="absolute inset-0 bg-slate-900/40 motion-reduce:transition-none" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-5 shadow-xl focus:outline-none"
        data-testid="confirm-dialog"
      >
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">{description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            data-testid="confirm-dialog-cancel"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded px-3 py-1.5 text-xs font-medium text-white ${danger ? "bg-danger-600 hover:bg-danger-700" : "bg-primary-600 hover:bg-primary-700"}`}
            data-testid="confirm-dialog-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
