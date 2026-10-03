"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { SetupStatus } from "@pulseos/types";
import { Button } from "@pulseos/ui";
import { useQuickCreate } from "@/components/shell/QuickCreateProvider";

interface Step {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  cta: { label: string; href?: string; onClick?: () => void };
}

/**
 * What a brand-new hospital sees instead of a dashboard full of zeros: how PulseOS works, and the few things to do
 * first. As soon as the first lead exists the normal Command Centre takes over.
 */
export function WorkspaceWelcome({ status, hospitalName }: { status: SetupStatus; hospitalName?: string }) {
  const quickCreate = useQuickCreate();
  const steps: Step[] = [
    { key: "lead", title: "Add your first lead", detail: "Record an enquiry from a call, WhatsApp, walk-in or your website. It becomes a patient journey.", done: status.hasJourneys, cta: { label: "Add lead", onClick: () => quickCreate.openAddLead() } },
    { key: "crm", title: "Configure your CRM fields", detail: "Choose the services you offer and the questions your team asks at enquiry.", done: status.crmConfigured, cta: { label: "Open CRM settings", href: "/settings?section=fields" } },
    { key: "doctors", title: "Add your doctors", detail: "So appointments can be booked against real schedules.", done: status.hasDoctors, cta: { label: "Add doctors", href: "/settings?section=doctors" } },
    { key: "calling", title: "Connect calling / IVR", detail: "Bring call logs, missed calls and recordings into each patient's journey.", done: status.callingConnected, cta: { label: "Connect calling", href: "/integrations" } },
    { key: "whatsapp", title: "Set up WhatsApp reminders", detail: "Confirm appointments and remind patients automatically.", done: status.whatsappConnected, cta: { label: "Connect WhatsApp", href: "/integrations" } },
    { key: "staff", title: "Invite your staff", detail: "Give front desk, coordinators and doctors their own sign-in.", done: status.hasStaff, cta: { label: "Manage staff", href: "/settings" } },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5" data-testid="workspace-welcome">
      <section className="rounded-panel border border-line bg-white p-5 shadow-glass sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Welcome to PulseOS</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{hospitalName ? `${hospitalName} is ready.` : "Your workspace is ready."}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          PulseOS follows every patient from the first enquiry to treatment and follow-up, so your team always knows where each patient came from, what happened next and what needs attention.
        </p>
        <ol className="mt-5 grid gap-2 text-xs sm:grid-cols-5" aria-label="How PulseOS works">
          {["Enquiry", "Appointment", "Consultation", "Treatment", "Follow-up"].map((label, i) => (
            <li key={label} className="flex items-center gap-2 rounded-control border border-line bg-primary-50/50 px-3 py-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[11px] font-semibold text-white">{i + 1}</span>
              <span className="font-medium text-ink">{label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-ink-2">Once you add your first lead, this page becomes your Command Centre: today&apos;s enquiries, appointments, follow-ups and what needs attention.</p>
      </section>

      <section aria-label="Get started" className="rounded-panel border border-line bg-white p-5 shadow-glass sm:p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Get started</h2>
          <p className="text-xs text-ink-2" data-testid="welcome-progress">{doneCount} of {steps.length} done</p>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {steps.map((s, i) => (
            <li key={s.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3" data-testid={`welcome-step-${s.key}`} data-done={s.done}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${s.done ? "bg-accent-100 text-accent-700" : "bg-primary-100 text-primary-700"}`} aria-hidden="true">
                {s.done ? <Check size={14} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm font-medium text-ink">
                  {s.title}
                  {s.done && <span className="ml-2 text-xs font-normal text-accent-700">Done</span>}
                </p>
                <p className="text-xs text-ink-2">{s.detail}</p>
              </div>
              {s.cta.href ? (
                <Link href={s.cta.href} className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-line-strong bg-white px-3 text-xs font-medium text-primary-700 transition hover:border-primary-300 hover:bg-primary-50 sm:min-h-8" data-testid={`welcome-cta-${s.key}`}>
                  {s.cta.label} <ArrowRight size={13} aria-hidden="true" />
                </Link>
              ) : (
                <Button variant={s.key === "lead" ? "primary" : "secondary"} size="sm" onClick={s.cta.onClick} className="max-md:min-h-11" data-testid={`welcome-cta-${s.key}`}>
                  {s.cta.label}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
