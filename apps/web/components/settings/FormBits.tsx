"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

// Shared form pieces for the Settings editors. 44px targets on a phone, compact on desktop.
export const CONTROL = "h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink outline-none placeholder:text-neutral-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-ink-2 sm:h-9";

export function FormField({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-ink-2">{hint}</p>}
    </div>
  );
}

export function TextInput({ label, hint, ...props }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FormField label={label} hint={hint} htmlFor={id}>
      <input id={id} className={CONTROL} {...props} />
    </FormField>
  );
}

export function SelectInput({ label, hint, children, ...props }: { label: string; hint?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FormField label={label} hint={hint} htmlFor={id}>
      <select id={id} className={CONTROL} {...props}>
        {children}
      </select>
    </FormField>
  );
}

export function CheckRow({ label, hint, checked, onChange, disabled, testId }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; testId?: string }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-start gap-2.5 py-1 sm:min-h-0">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-line-strong text-primary-600 focus:ring-primary-500 sm:h-4 sm:w-4" data-testid={testId} />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
        {hint && <span className="mt-0.5 block text-[11px] leading-snug text-ink-2">{hint}</span>}
      </label>
    </div>
  );
}

/** An inline, non-blocking error that keeps whatever was typed. */
export function FormError({ message, testId = "form-error" }: { message: string | null; testId?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-control border border-danger-100 bg-danger-100/60 px-3 py-2 text-xs text-danger-700" data-testid={testId}>
      {message}
    </p>
  );
}
