import { CalendarCheck, Phone } from "lucide-react";
import { CONTAINER, Pill, UiCard } from "./ui";
import { PAIN_POINTS } from "./content";

function Fragment({ k }: { k: string }) {
  switch (k) {
    case "followups":
      return (
        <UiCard>
          <div className="flex items-center gap-3 px-3.5 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-warning-100 text-warning-700"><Phone size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">Call patient · Cataract enquiry</p>
              <p className="text-xs text-ink-2">Today · 5:00 PM · Shivani</p>
            </div>
            <Pill tone="warning">Due today</Pill>
          </div>
        </UiCard>
      );
    case "showed":
      return (
        <UiCard>
          {[["Booked", "neutral", "11:00 Meera P."], ["Checked in", "warning", "11:15 Anil J."], ["No-show", "danger", "11:30 Tanvi S."]].map(([s, t, n]) => (
            <div key={n} className="flex items-center justify-between border-t border-line px-3.5 py-2 first:border-t-0">
              <span className="text-[13px] text-ink">{n}</span>
              <Pill tone={t as "neutral"}>{s}</Pill>
            </div>
          ))}
        </UiCard>
      );
    case "report":
      return (
        <UiCard>
          {[["Google", "40 enquiries", "5 procedures"], ["Instagram", "35 enquiries", "1 procedure"]].map(([s, a, b]) => (
            <div key={s} className="flex items-center justify-between gap-2 border-t border-line px-3.5 py-2 text-[13px] first:border-t-0">
              <span className="font-medium text-ink">{s}</span>
              <span className="text-ink-2">{a}</span>
              <span className="font-semibold text-ink">{b}</span>
            </div>
          ))}
        </UiCard>
      );
    case "phones":
      return (
        <UiCard>
          {["09:48 Incoming call", "10:12 WhatsApp message", "10:40 Walk-in at front desk"].map((r) => (
            <div key={r} className="border-t border-line px-3.5 py-2 text-[13px] text-ink first:border-t-0">
              {r} <span className="text-ink-2">· one timeline</span>
            </div>
          ))}
        </UiCard>
      );
    case "coordinator":
      return (
        <UiCard>
          <div className="space-y-2 px-3.5 py-3 text-[13px]">
            <p className="text-ink">Owner changed: <span className="font-medium">Shivani → Deepa</span></p>
            <p className="text-xs text-ink-2">12 earlier events stay on the journey</p>
          </div>
        </UiCard>
      );
    default:
      return (
        <UiCard>
          <div className="flex items-center gap-3 px-3.5 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-primary-100 text-primary-700"><CalendarCheck size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">Cataract surgery advised</p>
              <p className="text-xs text-ink-2">Source: Google · Meera P.</p>
            </div>
            <Pill tone="primary">Advised</Pill>
          </div>
        </UiCard>
      );
  }
}

export function PainGrid() {
  return (
    <section aria-label="Where hospitals lose patients" className="mk-section-ice border-y border-line py-16 sm:py-20">
      <div className={CONTAINER}>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PAIN_POINTS.map((p) => (
            <li key={p.key} className="flex flex-col rounded-panel border border-line bg-white p-5">
              <h3 className="text-balance text-[19px] font-semibold leading-snug tracking-tight text-ink">{p.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{p.body}</p>
              <div className="mt-auto pt-5" aria-hidden="true">
                <Fragment k={p.key} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
