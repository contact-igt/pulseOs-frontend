import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-neutral-200 bg-white ${className}`}>{children}</div>;
}

export function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold tracking-wide text-slate-900">{title}</h2>
      {subtitle && <span className="text-xs text-neutral-500">{subtitle}</span>}
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
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    primary: "bg-primary-100 text-primary-700",
  };
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
