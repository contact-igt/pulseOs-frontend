"use client";

import { useState } from "react";
import { CONTAINER, Eyebrow, Pill } from "./ui";
import { JOURNEY_STAGES } from "./content";
import { useTabKeys } from "./useTabKeys";

type Stage = (typeof JOURNEY_STAGES)[number];

function StageCard({ stage }: { stage: Stage }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-surface-muted px-5 py-2.5 text-xs text-ink-2">
        <span><span className="font-semibold text-ink">Journey</span> · Cataract · Source: Google</span>
        <span>Owner: Shivani</span>
      </div>
      <div className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-semibold tracking-tight text-ink">{stage.title}</p>
        <Pill tone={stage.tone}>{stage.status}</Pill>
      </div>
      <ul className="mt-3 space-y-2">
        {stage.lines.map((l) => (
          <li key={l} className="flex gap-2.5 text-[15px] leading-snug text-ink-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
            {l}
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}

export function JourneyDemo() {
  const [active, setActive] = useState(0);
  const { onKeyDown, setRef } = useTabKeys(JOURNEY_STAGES.length, active, setActive);
  const stage = JOURNEY_STAGES[active]!;

  return (
    <section id="how-it-works" aria-labelledby="journey-title" className="mk-anchor mk-section-ice border-y border-line py-16 sm:py-24">
      <div className={CONTAINER}>
        <div className="max-w-3xl">
          <Eyebrow>One patient. One continuous journey.</Eyebrow>
          <h2 id="journey-title" className="mt-3 text-balance text-[30px] font-semibold leading-[1.12] tracking-tight text-ink sm:text-[38px] lg:text-[44px]">
            Know exactly where every patient stands.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-2">Select a stage to see what the team sees. Example journey, synthetic data.</p>
        </div>

        <div className="mt-10">
          {/* Desktop: horizontal stepper with one detail card underneath. */}
          <div role="tablist" aria-label="Patient journey stages" aria-orientation="horizontal" onKeyDown={onKeyDown} className="relative hidden grid-cols-7 md:grid" data-testid="journey-tabs">
            <span className="pointer-events-none absolute left-[7%] right-[7%] top-[13px] h-0.5 bg-primary-200" aria-hidden="true" />
            {JOURNEY_STAGES.map((s, i) => (
              <button
                key={s.key}
                ref={setRef(i)}
                role="tab"
                id={`jd-tab-${i}`}
                aria-selected={active === i}
                aria-controls="jd-panel"
                tabIndex={active === i ? 0 : -1}
                type="button"
                onClick={() => setActive(i)}
                className="group relative flex flex-col items-center gap-3 rounded-control px-1 pb-2 text-center"
              >
                <span className={`relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-[var(--color-canvas-base)] transition ${i <= active ? "bg-brand text-white" : "border border-primary-300 bg-white text-primary-700 group-hover:border-brand"}`}>
                  {i + 1}
                </span>
                <span className={`text-sm font-medium leading-tight ${active === i ? "text-ink" : "text-ink-2 group-hover:text-ink"}`}>{s.label}</span>
              </button>
            ))}
          </div>
          <div id="jd-panel" role="tabpanel" aria-labelledby={`jd-tab-${active}`} tabIndex={0} className="mx-auto mt-8 hidden max-w-3xl md:block" data-testid="journey-panel">
            <StageCard stage={stage} />
            {active === 2 && <p className="mt-2 text-xs text-ink-2">* Confirmations and reminders go out when your messaging provider is connected.</p>}
          </div>

          {/* Mobile: vertical list, detail opens inline under the selected stage. */}
          <ol className="md:hidden" data-testid="journey-vertical">
            {JOURNEY_STAGES.map((s, i) => (
              <li key={s.key} className="relative pb-3 pl-10">
                {i < JOURNEY_STAGES.length - 1 && <span className="absolute bottom-0 left-[13px] top-7 w-0.5 bg-primary-200" aria-hidden="true" />}
                <span className={`absolute left-0 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${i <= active ? "bg-brand text-white" : "border border-primary-300 bg-white text-primary-700"}`}>{i + 1}</span>
                <button type="button" aria-expanded={active === i} onClick={() => setActive(i)} className="flex min-h-11 w-full items-center text-left text-base font-semibold text-ink">
                  {s.label}
                </button>
                {active === i && (
                  <div className="mt-1">
                    <StageCard stage={s} />
                    {i === 2 && <p className="mt-2 text-xs text-ink-2">* Confirmations and reminders go out when your messaging provider is connected.</p>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
