import type { ReactNode } from "react";
import { CalendarCheck, Check, Clock, PhoneCall, Stethoscope, UserRound, Zap } from "lucide-react";
import { Pill, UiCard } from "./ui";
import { FRONT_DESK_QUEUE, FUNNEL_STAGES, PLANNER_ROWS, SERVICE_OUTCOMES, SOURCE_OUTCOMES, TEAM_ROWS, TIMELINE_EVENTS } from "./content";

// Marketing renditions of real PulseOS screens, built with the same tokens, radii, pill language and layout as the app and
// filled with synthetic data. They are static markup (no API, no client JS) so the page stays fast and the text stays
// crisp at every size.

const first = FUNNEL_STAGES[0].count;

/** Funnel list: same construction as the app's Patient Journey Performance card (bar = % of enquiries, drop-off in pp). */
export function FunnelPanel({ compact = false }: { compact?: boolean }) {
  const last = FUNNEL_STAGES[FUNNEL_STAGES.length - 1].count;
  return (
    <UiCard
      title="Patient Journey Performance"
      meta={
        <span>
          <span className="text-base font-semibold tabular-nums text-ink">{Math.round((last / first) * 100)}%</span> enquiry → procedure
        </span>
      }
    >
      <ul className={`flex flex-col ${compact ? "gap-0.5 p-2" : "gap-1 p-3"}`}>
        {FUNNEL_STAGES.map((s, i) => {
          const pct = Math.round((s.count / first) * 100);
          const prev = i > 0 ? Math.round((FUNNEL_STAGES[i - 1].count / first) * 100) : null;
          const drop = prev !== null ? prev - pct : null;
          return (
            <li key={s.key} className={`flex items-center gap-3 px-2 ${compact ? "py-1.5" : "py-2"}`}>
              <span className="w-[7rem] shrink-0 text-[13px] leading-tight text-ink sm:w-40">{s.label}</span>
              <span className="h-2.5 min-w-[24px] flex-1 overflow-hidden rounded-full bg-primary-100" aria-hidden="true">
                <span className="block h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink">{s.count}</span>
              <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-ink-2">{pct}%</span>
              <span className="hidden w-12 shrink-0 text-right text-[11px] tabular-nums text-ink-2 sm:block">{drop ? `-${drop}pp` : ""}</span>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line bg-surface-info px-3.5 py-2 text-xs text-ink-2">
        Largest drop-off: <span className="font-medium text-ink">Enquiry → Appointment booked</span> (-36pp of enquiries)
      </p>
    </UiCard>
  );
}

export function KpiStripPanel({ compact = false }: { compact?: boolean }) {
  const kpis = [FUNNEL_STAGES[0], FUNNEL_STAGES[1], FUNNEL_STAGES[2], FUNNEL_STAGES[3], FUNNEL_STAGES[6]];
  const label = ["Enquiries", "Booked", "Attended", "Consulted", "Procedures done"];
  return (
    <dl className={`grid grid-cols-2 overflow-hidden rounded-card border border-line bg-white sm:grid-cols-5 ${compact ? "" : ""}`}>
      {kpis.map((k, i) => (
        <div key={k.key} className={`px-3.5 py-3 ${i > 0 ? "sm:border-l sm:border-line" : ""} ${i > 1 ? "border-t border-line sm:border-t-0" : ""} ${i === 1 ? "border-l border-line sm:border-l" : ""} ${i === 3 ? "border-l border-line sm:border-l" : ""} ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
          <dd className="text-xl font-semibold tabular-nums text-ink">{k.count}</dd>
          <dt className="text-xs text-ink-2">{label[i]}</dt>
        </div>
      ))}
    </dl>
  );
}

export function SourceTablePanel({ showOutcomes = true }: { showOutcomes?: boolean }) {
  return (
    <UiCard title="By source" meta="Last 30 days">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[300px] text-left text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-2">
              <th className="px-3.5 py-2 font-medium">Source</th>
              <th className="px-2 py-2 text-right font-medium">Enquiries</th>
              {showOutcomes && (
                <>
                  <th className="px-2 py-2 text-right font-medium">Visits</th>
                  <th className="px-2 py-2 text-right font-medium">Consults</th>
                  <th className="px-3.5 py-2 text-right font-medium" title="Procedures done">Done</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {SOURCE_OUTCOMES.map((r) => (
              <tr key={r.source} className="border-t border-line">
                <td className="px-3.5 py-2 font-medium text-ink">{r.source}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.enquiries}</td>
                {showOutcomes && (
                  <>
                    <td className="px-2 py-2 text-right tabular-nums">{r.visits}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.consultations}</td>
                    <td className="px-3.5 py-2 text-right font-semibold tabular-nums text-ink">{r.procedures}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UiCard>
  );
}

export function ServicePanel() {
  const max = Math.max(...SERVICE_OUTCOMES.map((s) => s.enquiries));
  return (
    <UiCard title="By service" meta="Enquiries → procedures advised">
      <ul className="space-y-2.5 p-3.5">
        {SERVICE_OUTCOMES.map((s) => (
          <li key={s.service}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-ink">{s.service}</span>
              <span className="tabular-nums text-ink-2">
                {s.enquiries} → <span className="font-semibold text-ink">{s.advised}</span>
              </span>
            </div>
            <span className="mt-1 block h-2 overflow-hidden rounded-full bg-primary-100" aria-hidden="true">
              <span className="block h-full rounded-full bg-primary-500" style={{ width: `${(s.enquiries / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </UiCard>
  );
}

export function TeamPanel() {
  return (
    <UiCard title="Team" meta="Who is following up">
      <ul>
        {TEAM_ROWS.map((t) => (
          <li key={t.name} className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-2.5 first:border-t-0 text-[13px]">
            <span className="flex items-center gap-2 text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-800" aria-hidden="true">
                {t.name[0]}
              </span>
              {t.name}
            </span>
            <span className="tabular-nums text-ink-2">{t.enquiries} enquiries</span>
            <Pill tone={t.followUps === "Up to date" ? "success" : "warning"}>{t.followUps}</Pill>
          </li>
        ))}
      </ul>
    </UiCard>
  );
}

/** The app's Command Centre / Performance screen, condensed. */
export function OwnerDashboardPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div className="bg-canvas-base p-3 sm:p-4" style={{ backgroundColor: "var(--color-canvas-base)" }}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-sm font-semibold text-ink">Hospital performance</p>
          <p className="text-xs text-ink-2">Last 30 days · all branches · all services</p>
        </div>
        <Pill tone="neutral">Synthetic demo data</Pill>
      </div>
      <KpiStripPanel compact={compact} />
      <div className={`mt-3 grid grid-cols-1 gap-3 ${compact ? "lg:grid-cols-[1.35fr_1fr]" : "lg:grid-cols-[1.3fr_1fr]"}`}>
        <FunnelPanel compact={compact} />
        <div className={`${compact ? "hidden lg:block" : ""} space-y-3`}>
          <SourceTablePanel showOutcomes={!compact} />
          {!compact && <ServicePanel />}
        </div>
      </div>
    </div>
  );
}

export function FrontDeskPanel() {
  const counters = [
    ["2", "Upcoming"],
    ["1", "Checked in"],
    ["1", "Waiting"],
    ["1", "With doctor"],
    ["3", "Completed"],
    ["1", "No-show"],
  ] as const;
  return (
    <div className="bg-canvas-base p-3 sm:p-4" style={{ backgroundColor: "var(--color-canvas-base)" }}>
      <dl className="grid grid-cols-3 overflow-hidden rounded-card border border-line bg-white sm:grid-cols-6">
        {counters.map(([n, l], i) => (
          <div key={l} className={`px-3 py-2.5 ${l === "Waiting" ? "bg-brand text-white" : ""} ${i > 0 ? "border-l border-line" : ""} ${i >= 3 ? "max-sm:border-t max-sm:border-line" : ""} ${i === 3 ? "max-sm:border-l-0" : ""}`}>
            <dd className="text-lg font-semibold tabular-nums">{n}</dd>
            <dt className={`text-[11px] ${l === "Waiting" ? "text-white/90" : "text-ink-2"}`}>{l}</dt>
          </div>
        ))}
      </dl>
      <UiCard title="Today's appointments" meta="Same status for everyone" className="mt-3">
        <ul>
          {FRONT_DESK_QUEUE.map((r) => (
            <li key={r.patient} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 border-t border-line px-3.5 py-2.5 first:border-t-0 sm:grid-cols-[56px_1.2fr_1fr_auto_auto]">
              <span className="text-xs tabular-nums text-ink-2">{r.time}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink">{r.patient}</span>
                <span className="block truncate text-xs text-ink-2 sm:hidden">{r.service}</span>
              </span>
              <span className="hidden truncate text-xs text-ink-2 sm:block">{r.service}</span>
              <span className="flex items-center gap-2">
                <Pill tone={r.tone}>{r.status}</Pill>
                {r.wait && <span className="hidden text-xs tabular-nums text-ink-2 sm:inline">{r.wait}</span>}
              </span>
              <span className="hidden sm:block">{r.next && <span className="rounded-control border border-line-strong px-2.5 py-1 text-xs font-medium text-ink">{r.next}</span>}</span>
            </li>
          ))}
        </ul>
      </UiCard>
    </div>
  );
}

export function DoctorPlannerPanel() {
  return (
    <div className="bg-canvas-base p-3 sm:p-4" style={{ backgroundColor: "var(--color-canvas-base)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Today · Dr. Menon</p>
          <p className="text-xs text-ink-2">5 patients · 1 waiting</p>
        </div>
        <Pill tone="warning">Waiting · 8 min</Pill>
      </div>
      <UiCard>
        <ul>
          {PLANNER_ROWS.map((r) => (
            <li key={r.patient} className="grid grid-cols-[72px_1fr_auto] items-center gap-x-3 border-t border-line px-3.5 py-3 first:border-t-0">
              <span className="text-xs font-medium tabular-nums text-ink-2">{r.time}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink">{r.patient}</span>
                <span className="block truncate text-xs text-ink-2">{r.service}</span>
              </span>
              <Pill tone={r.tone}>{r.status}</Pill>
            </li>
          ))}
        </ul>
      </UiCard>
    </div>
  );
}

const KIND_ICON: Record<string, ReactNode> = {
  lead: <UserRound size={14} />,
  call: <PhoneCall size={14} />,
  appt: <CalendarCheck size={14} />,
  visit: <Clock size={14} />,
  consult: <Stethoscope size={14} />,
  proc: <Zap size={14} />,
};

export function JourneyDetailPanel() {
  return (
    <div className="bg-canvas-base p-3 sm:p-4" style={{ backgroundColor: "var(--color-canvas-base)" }}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
        <UiCard title="Timeline" meta="Oculoplasty journey">
          <ol className="px-3.5 py-3">
            {TIMELINE_EVENTS.map((e, i) => (
              <li key={e.time + e.title} className="relative flex gap-3 pb-4 last:pb-0">
                {i < TIMELINE_EVENTS.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-line-strong/60" aria-hidden="true" />}
                <span className="relative z-10 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">{KIND_ICON[e.kind]}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] font-medium text-ink">
                    {e.title}
                    <span className="text-[11px] font-normal tabular-nums text-ink-2">{e.time}</span>
                  </p>
                  <p className="text-xs text-ink-2">{e.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </UiCard>
        <div className="space-y-3">
          <UiCard title="Patient">
            <div className="space-y-1 px-3.5 py-3 text-[13px]">
              <p className="font-medium text-ink">Meera Pillai</p>
              <p className="text-xs text-ink-2">Oculoplasty · Source: Google</p>
              <p className="text-xs text-ink-2">Owner: Shivani</p>
            </div>
          </UiCard>
          <UiCard title="Next action">
            <div className="space-y-2 px-3.5 py-3">
              <p className="text-[13px] font-medium text-ink">Follow up on procedure decision</p>
              <p className="text-xs text-ink-2">Tomorrow · 11:00 AM · Shivani</p>
              <Pill tone="warning">Due tomorrow</Pill>
            </div>
          </UiCard>
        </div>
      </div>
    </div>
  );
}

export function LogCallPanel() {
  return (
    <UiCard title="Log call" meta="Meera Pillai · Oculoplasty" className="shadow-panel">
      <div className="space-y-3 px-3.5 py-3.5 text-[13px]">
        <Field label="Outcome" value="Patient interested" />
        <Field label="Feedback" value="Asked about eye-bag treatment and timings" />
        <Field label="Next action" value="Book Appointment" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" value="Tomorrow" />
          <Field label="Time" value="11:30 AM" />
        </div>
        <label className="flex items-center gap-2 text-ink">
          <span className="flex h-4 w-4 items-center justify-center rounded border border-brand bg-brand text-white" aria-hidden="true">
            <Check size={11} strokeWidth={3} />
          </span>
          Confirmed with patient
        </label>
        <div className="rounded-control bg-brand px-4 py-2.5 text-center text-[13px] font-semibold text-white">Save call &amp; confirm appointment</div>
      </div>
    </UiCard>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-ink-2">{label}</p>
      <p className="rounded-control border border-line-strong bg-white px-3 py-2 text-[13px] text-ink">{value}</p>
    </div>
  );
}

export function NextActionCard({ title, meta, tone = "warning", icon }: { title: string; meta: string; tone?: "warning" | "success" | "primary"; icon?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-line bg-white p-3 shadow-glass">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${tone === "success" ? "bg-accent-100 text-accent-700" : tone === "primary" ? "bg-primary-100 text-primary-700" : "bg-warning-100 text-warning-700"}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink-2">{meta}</p>
      </div>
    </div>
  );
}
