import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from "react";

export function Card({ children, className = "", ...rest }: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"div">) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-slate-900">{title}</h2>
        {subtitle && <span className="text-xs text-neutral-500">{subtitle}</span>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-200 ${className}`} />;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="flex h-24 items-center justify-center text-sm text-neutral-400">{message}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="flex h-24 items-center justify-center text-sm text-danger-500">{message}</div>;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "warning" | "danger" | "primary"; children: ReactNode }) {
  const tones: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-700",
    warning: "bg-warning-100 text-warning-700",
    danger: "bg-danger-100 text-danger-700",
    primary: "bg-primary-100 text-primary-700",
  };
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40",
  // Quieter than primary — an outlined neutral treatment, never blue, so a
  // row of actions reads as one clear CTA plus muted secondaries rather
  // than several competing "buttons".
  secondary: "border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40",
  ghost: "text-neutral-500 hover:bg-neutral-100 hover:text-slate-900 disabled:opacity-40",
  danger: "border border-danger-100 text-danger-700 hover:bg-danger-100 disabled:opacity-40",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "rounded px-2 py-1 text-xs font-medium",
  md: "rounded-lg px-3.5 py-2 text-sm font-medium",
};

/** The one shared button treatment — variant carries the action-hierarchy signal (primary/secondary/ghost/danger) so pages stop hand-rolling the same className strings with small, accidental drifts. */
export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`inline-flex shrink-0 items-center justify-center gap-1.5 transition ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/**
 * One page header pattern: optional Back control above, title/subtitle left,
 * at most one primary action right — per the "one clear primary action"
 * rule. `back` takes a rendered element (e.g. BackLink) rather than a prop
 * bag, since Back is app-routing-aware and this package stays router-free.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="space-y-1" data-testid="page-header">
      {back}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-neutral-500">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
