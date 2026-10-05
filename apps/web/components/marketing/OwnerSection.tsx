import { Check } from "lucide-react";
import { BrowserFrame, CONTAINER, Caption, Eyebrow, PrimaryCta } from "./ui";
import { FunnelPanel, KpiStripPanel, ServicePanel, SourceTablePanel, TeamPanel } from "./ProductPanels";

const ASKS = ["Which source creates consultations", "Which service creates procedures", "Where patients drop off", "Which follow-ups are overdue"];

export function OwnerSection() {
  return (
    <section id="product" aria-labelledby="owner-title" className="mk-anchor mk-section-ice border-y border-line py-16 sm:py-24">
      <div className={CONTAINER}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <Eyebrow>For the owner</Eyebrow>
            <h2 id="owner-title" className="mt-3 text-balance text-[30px] font-semibold leading-[1.12] tracking-tight text-ink sm:text-[38px] lg:text-[44px]">
              Stop asking your team for updates. See the hospital journey yourself.
            </h2>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-2">
              Not just &ldquo;how many leads did we get?&rdquo; PulseOS shows how many patients moved from enquiry to appointment, visit, consultation and procedure, by source, by service and by team member.
            </p>
          </div>
          <div className="rounded-panel border border-line bg-white p-5">
            <h3 className="text-base font-semibold text-ink">Understand</h3>
            <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
              {ASKS.map((a) => (
                <li key={a} className="flex gap-3 text-[16px] leading-snug text-ink">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
            <PrimaryCta className="mt-5 w-full sm:w-auto" />
          </div>
        </div>

        <div className="mt-10">
          <BrowserFrame screen="Performance" label="PulseOS owner performance screen with the patient funnel, sources, services and team (synthetic demo data)">
            <div className="space-y-3 p-3 sm:p-4" style={{ backgroundColor: "var(--color-canvas-base)" }}>
              <KpiStripPanel />
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_1fr]">
                <FunnelPanel />
                <div className="space-y-3">
                  <SourceTablePanel />
                  <ServicePanel />
                </div>
              </div>
              <TeamPanel />
            </div>
          </BrowserFrame>
          <Caption>See where patients move forward, and where they don&apos;t. Illustrative numbers.</Caption>
        </div>
      </div>
    </section>
  );
}
