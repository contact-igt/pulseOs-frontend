import { ArrowRight, Check } from "lucide-react";
import { CONTAINER, Pill, SectionHead } from "./ui";
import { COMPARISON, SOURCES } from "./content";

const CORE = ["Lead / enquiry", "Patient journey", "Calls", "Follow-ups", "Appointments", "Front desk", "Doctor planner", "Treatment follow-up", "Analytics"];
const CLINICAL = ["EMR", "HIS / HMIS", "Billing", "Clinical records", "Other hospital systems"];

export function ArchitectureSection() {
  return (
    <section id="integrations" aria-labelledby="arch-title" className="mk-anchor bg-white py-16 sm:py-24">
      <div className={CONTAINER}>
        <SectionHead eyebrow="Where PulseOS sits" title={<span id="arch-title">Connect the operational layer between patient acquisition and clinical care.</span>}>
          <p>PulseOS does not need to replace your existing EMR or HMIS. It manages the patient engagement and operational journey around those systems and can integrate where supported.</p>
        </SectionHead>

        <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1.25fr_auto_1fr]" data-testid="architecture">
          <div className="rounded-panel border border-line bg-surface-muted p-5">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">Patient acquisition and contact</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {SOURCES.map((s) => (
                <li key={s} className="rounded-card border border-line bg-white px-3 py-2 text-sm font-medium text-ink">{s}</li>
              ))}
            </ul>
          </div>
          <ArrowRight className="mx-auto self-center rotate-90 text-brand lg:rotate-0" aria-hidden="true" />
          <div className="rounded-panel border-2 border-primary-300 bg-primary-50 p-5 shadow-glass">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-brand">PulseOS · engagement + operations</p>
            <ul className="mt-4 grid grid-cols-2 gap-2">
              {CORE.map((c) => (
                <li key={c} className="rounded-card border border-line bg-white px-3 py-2 text-sm font-medium text-ink">{c}</li>
              ))}
            </ul>
          </div>
          <ArrowRight className="mx-auto self-center rotate-90 text-brand lg:rotate-0" aria-hidden="true" />
          <div className="rounded-panel border border-line bg-surface-muted p-5">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">Clinical and hospital systems</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {CLINICAL.map((s) => (
                <li key={s} className="rounded-card border border-line bg-white px-3 py-2 text-sm font-medium text-ink">{s}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink-2">Clinical charting, prescriptions and billing stay where they belong.</p>
          </div>
        </div>
        <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <Pill tone="neutral">Built, connect per hospital</Pill>
          WhatsApp, calling (IVR) and ad-reporting connections go live when your hospital connects its own provider. EMR / HMIS integration depends on what your system supports.
        </p>

        <div className="mt-20">
          <SectionHead eyebrow="CRM vs IVR vs EMR" title="Not another system trying to do everything." align="center" />
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="comparison">
            {COMPARISON.map((c) => {
              const hero = c.key === "pulse";
              return (
                <li key={c.key} className={`flex flex-col rounded-panel border p-5 ${hero ? "border-primary-300 bg-primary-50 shadow-glass" : "border-line bg-white"}`}>
                  <h3 className={`text-lg font-semibold tracking-tight ${hero ? "text-brand" : "text-ink"}`}>{c.name}</h3>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-2">{hero ? "Connects" : "Handles"}</p>
                  <ul className="mt-2 space-y-1.5">
                    {c.handles.map((h) => (
                      <li key={h} className="flex gap-2 text-[15px] text-ink">
                        <Check size={16} className="mt-0.5 shrink-0 text-accent-700" aria-hidden="true" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  {c.missing && (
                    <>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-2">Usually missing</p>
                      <p className="mt-1.5 text-[15px] leading-snug text-ink-2">{c.missing}</p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-center text-[16px] text-ink-2">Designed to work around, and where possible with, the systems you already use.</p>
        </div>
      </div>
    </section>
  );
}
