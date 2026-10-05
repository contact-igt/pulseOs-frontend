"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { BrowserFrame, CONTAINER, Eyebrow } from "./ui";
import { ROLES } from "./content";
import { useTabKeys } from "./useTabKeys";
import { DoctorPlannerPanel, FrontDeskPanel, LogCallPanel, ServicePanel, SourceTablePanel, TeamPanel } from "./ProductPanels";

const SCREEN: Record<string, { name: string; node: ReactNode }> = {
  owner: {
    name: "Performance",
    node: (
      <div className="grid grid-cols-1 items-start gap-3 p-3 sm:p-4 md:grid-cols-2" style={{ backgroundColor: "var(--color-canvas-base)" }}>
        <SourceTablePanel />
        <div className="space-y-3">
          <ServicePanel />
          <TeamPanel />
        </div>
      </div>
    ),
  },
  frontdesk: { name: "Front Desk", node: <FrontDeskPanel /> },
  coordinator: {
    name: "My Work",
    node: (
      <div className="p-3 sm:p-4" style={{ backgroundColor: "var(--color-canvas-base)" }}>
        <div className="mx-auto max-w-md">
          <LogCallPanel />
        </div>
      </div>
    ),
  },
  doctor: { name: "Doctor Planner", node: <DoctorPlannerPanel /> },
};

export function RoleSwitcher() {
  const [active, setActive] = useState(0);
  const { onKeyDown, setRef } = useTabKeys(ROLES.length, active, setActive);
  const role = ROLES[active]!;
  const screen = SCREEN[role.key]!;

  return (
    <section id="for-hospitals" aria-labelledby="roles-title" className="mk-anchor mk-section-ice border-y border-line py-16 sm:py-24">
      <div className={CONTAINER}>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Built around the people who run the day</Eyebrow>
          <h2 id="roles-title" className="mt-3 text-balance text-[30px] font-semibold leading-[1.12] tracking-tight text-ink sm:text-[38px] lg:text-[44px]">
            One platform. A clear view for every role.
          </h2>
        </div>

        <div className="mk-scroll-x mt-8 overflow-x-auto">
          <div role="tablist" aria-label="Choose a role" onKeyDown={onKeyDown} className="mx-auto flex w-max gap-1 rounded-control border border-line-strong bg-white p-1" data-testid="role-tabs">
            {ROLES.map((r, i) => (
              <button
                key={r.key}
                ref={setRef(i)}
                role="tab"
                id={`role-tab-${r.key}`}
                aria-selected={active === i}
                aria-controls="role-panel"
                tabIndex={active === i ? 0 : -1}
                type="button"
                onClick={() => setActive(i)}
                className={`min-h-11 whitespace-nowrap rounded-[8px] px-4 text-[15px] font-semibold transition sm:px-6 ${active === i ? "bg-brand text-white" : "text-ink-2 hover:text-ink"}`}
              >
                {r.tab}
              </button>
            ))}
          </div>
        </div>

        <div id="role-panel" role="tabpanel" aria-labelledby={`role-tab-${role.key}`} tabIndex={0} className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center" data-testid="role-panel">
          <div>
            <Eyebrow>{role.eyebrow}</Eyebrow>
            <h3 className="mt-3 text-balance text-[26px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]" data-testid="role-headline">
              {role.headline}
            </h3>
            <ul className="mt-6 space-y-3">
              {role.benefits.map((b) => (
                <li key={b} className="flex gap-3 text-[16px] leading-snug text-ink">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <BrowserFrame screen={screen.name} label={`PulseOS ${screen.name} screen (synthetic demo data)`}>
            {screen.node}
          </BrowserFrame>
        </div>
      </div>
    </section>
  );
}
