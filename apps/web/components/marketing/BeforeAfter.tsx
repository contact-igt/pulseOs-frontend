"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, FileSpreadsheet, MessageCircle, NotebookPen, PhoneCall, CalendarDays } from "lucide-react";
import { ARTIFACTS, SOURCES } from "./content";
import { Pill } from "./ui";

const ARTIFACT_ICON = [FileSpreadsheet, NotebookPen, PhoneCall, MessageCircle, CalendarDays];
const TILT = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "-rotate-[1.5deg]"];

const AFTER_STEPS = [
  { label: "Lead created", detail: "Google · Cataract" },
  { label: "Call logged", detail: "Next action set" },
  { label: "Appointment confirmed", detail: "10 Oct · 10:30 AM" },
  { label: "Visit attended", detail: "Checked in, waiting 8 min" },
  { label: "Consultation completed", detail: "Dr. Menon" },
  { label: "Procedure advised", detail: "Cataract surgery" },
];

/**
 * Before → PulseOS. Starts on "Before" (the fragmented sources, the scattered notes, the unanswered question). When the
 * visual scrolls into view it moves to PulseOS once, unless the visitor prefers reduced motion or has already chosen a
 * side. The toggle always works and nothing else on the page auto-advances.
 */
export function BeforeAfter() {
  const [after, setAfter] = useState(false);
  const touched = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          timer = setTimeout(() => {
            if (!touched.current) setAfter(true);
          }, 2600);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  function choose(next: boolean) {
    touched.current = true;
    setAfter(next);
  }

  return (
    <div ref={ref} className="mt-12 rounded-panel border border-line bg-surface-muted p-4 sm:p-6 lg:p-8" data-testid="before-after">
      <div className="mb-6 flex justify-center">
        <div role="group" aria-label="Compare before and after" className="inline-flex rounded-control border border-line-strong bg-white p-1">
          {([false, true] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={after === v}
              onClick={() => choose(v)}
              className={`min-h-11 rounded-[8px] px-4 text-[15px] font-semibold transition sm:px-6 ${after === v ? "bg-brand text-white" : "text-ink-2 hover:text-ink"}`}
              data-testid={v ? "ba-after" : "ba-before"}
            >
              {v ? "With PulseOS" : "Before"}
            </button>
          ))}
        </div>
      </div>

      {!after ? (
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1.15fr_auto_1fr]" data-testid="ba-before-view">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2" aria-label="Where patients come from">
            {SOURCES.map((s) => (
              <li key={s} className="rounded-card border border-line bg-white px-3 py-2.5 text-center text-sm font-medium text-ink">
                {s}
              </li>
            ))}
          </ul>
          <ArrowRight className="mx-auto rotate-90 text-neutral-400 lg:rotate-0" aria-hidden="true" />
          <ul className="flex flex-wrap justify-center gap-3" aria-label="Where the details end up">
            {ARTIFACTS.map((a, i) => {
              const Icon = ARTIFACT_ICON[i]!;
              return (
                <li key={a} className={`flex items-center gap-2 rounded-card border border-line-strong bg-white px-3.5 py-3 text-sm text-ink shadow-panel ${TILT[i]}`}>
                  <Icon size={16} className="text-neutral-500" aria-hidden="true" />
                  {a}
                </li>
              );
            })}
          </ul>
          <ArrowRight className="mx-auto rotate-90 text-neutral-400 lg:rotate-0" aria-hidden="true" />
          <div className="rounded-card border border-dashed border-line-strong bg-white p-5 text-center">
            <p className="text-xl font-semibold leading-snug text-ink">&ldquo;What happened to this patient?&rdquo;</p>
            <p className="mt-2 text-sm text-ink-2">Did anyone call? Did they ever come?</p>
          </div>
        </div>
      ) : (
        <div className="mk-rise" data-testid="ba-after-view">
          <div className="mx-auto max-w-4xl rounded-card border border-line bg-white p-4 shadow-panel sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <p className="text-[15px] font-semibold text-ink">One patient journey · Meera Pillai</p>
              <Pill tone="primary">Source: Google</Pill>
            </div>
            <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {AFTER_STEPS.map((s, i) => (
                <li key={s.label} className="flex items-start gap-3 rounded-control bg-surface-muted px-3 py-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden="true">
                    {i === AFTER_STEPS.length - 1 ? <Check size={12} strokeWidth={3} /> : <span className="text-[11px] font-semibold">{i + 1}</span>}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-ink">{s.label}</span>
                    <span className="block text-xs text-ink-2">{s.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-4 text-center text-[15px] font-medium text-ink">Every call, visit and decision on one journey.</p>
        </div>
      )}
    </div>
  );
}
