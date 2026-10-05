"use client";

import { useState } from "react";
import { CONTAINER, Pill, SectionHead, UiCard } from "./ui";
import { CRM_FIELDS } from "./content";

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition ${on ? "bg-brand" : "bg-neutral-300"} ${disabled ? "opacity-60" : ""}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );
}

const CHIPS: Record<string, string[]> = {
  Services: ["Cataract", "Oculoplasty", "Squint", "Laser vision correction"],
  "Lead sources": ["Google", "Instagram", "Website", "Walk-in", "Referral"],
  "Clinic hours": ["Mon–Sat 9:00–18:00", "Sun closed"],
};

export function ConfigurableSection() {
  const [onAdd, setOnAdd] = useState<Record<string, boolean>>({ phone: true, name: true, area: true, dob: false });

  return (
    <section aria-labelledby="config-title" className="mk-section-ice border-y border-line py-16 sm:py-24">
      <div className={CONTAINER}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHead eyebrow="Configurable to the hospital" title={<span id="config-title">Your hospital shouldn&apos;t have to work like someone else&apos;s.</span>}>
              <p>Choose what your team collects, where it appears, and which fields are required. PulseOS adapts to your workflow instead of forcing one generic CRM form.</p>
            </SectionHead>
            <p className="mt-8 text-lg font-semibold leading-snug text-ink">Don&apos;t turn a two-minute enquiry into a 15-field registration form.</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">Collect the phone number, service and source on the first call. Add UID, address, PIN, gender and service-specific details later, when they matter.</p>
          </div>

          <div className="space-y-4">
            <UiCard title="Settings · CRM Fields" meta="Try the switches">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-ink-2">
                      <th className="px-3.5 py-2 font-medium">Field name</th>
                      <th className="px-2 py-2 font-medium">Required</th>
                      <th className="px-2 py-2 font-medium">Filterable</th>
                      <th className="px-2 py-2 font-medium">Used in</th>
                      <th className="px-3.5 py-2 text-right font-medium">On Add Lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CRM_FIELDS.map((f) => (
                      <tr key={f.key} className="border-t border-line">
                        <td className="px-3.5 py-2.5 font-medium text-ink">{f.name}</td>
                        <td className="px-2 py-2.5">{f.required ? <Pill tone="primary">Required</Pill> : <span className="text-ink-2">Optional</span>}</td>
                        <td className="px-2 py-2.5 text-ink-2">{f.filterable ? "Yes" : "No"}</td>
                        <td className="px-2 py-2.5 text-ink-2">{f.usedIn}</td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex justify-end">
                            <Switch on={onAdd[f.key] ?? false} disabled={f.locked} label={`Show ${f.name} on Add Lead`} onChange={(v) => setOnAdd((s) => ({ ...s, [f.key]: v }))} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </UiCard>

            <UiCard title="Add Lead" meta="Preview of what your team sees" className="shadow-panel">
              <div className="grid grid-cols-1 gap-3 px-3.5 py-3.5 text-[13px] sm:grid-cols-2" data-testid="add-lead-preview">
                {CRM_FIELDS.filter((f) => onAdd[f.key]).map((f) => (
                  <div key={f.key}>
                    <p className="mb-1 text-[11px] font-medium text-ink-2">
                      {f.name}
                      {f.required ? " *" : f.key === "name" ? " (optional at first)" : ""}
                    </p>
                    <p className="h-9 rounded-control border border-line-strong bg-white" />
                  </div>
                ))}
                {["New / existing patient", "Service", "Source"].map((l) => (
                  <div key={l}>
                    <p className="mb-1 text-[11px] font-medium text-ink-2">{l}</p>
                    <p className="h-9 rounded-control border border-line-strong bg-white" />
                  </div>
                ))}
              </div>
            </UiCard>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Object.entries(CHIPS).map(([title, items]) => (
                <div key={title} className="rounded-card border border-line bg-white p-3.5">
                  <p className="text-[13px] font-semibold text-ink">{title}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {items.map((i) => (
                      <li key={i} className="rounded-chip bg-primary-50 px-2 py-1 text-xs text-primary-800 ring-1 ring-inset ring-primary-200">{i}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
