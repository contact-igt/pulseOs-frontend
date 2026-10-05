import { CalendarCheck, Clock, Phone } from "lucide-react";
import { BrowserFrame, CONTAINER, Eyebrow, PrimaryCta, SecondaryCta } from "./ui";
import { NextActionCard, OwnerDashboardPanel } from "./ProductPanels";

const delay = (ms: number) => ({ "--mk-d": `${ms}ms` }) as React.CSSProperties;

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="app-shell relative overflow-hidden border-b border-line">
      <div className={`${CONTAINER} pb-16 pt-12 sm:pt-16 lg:pb-24 lg:pt-20`}>
        <div className="mx-auto max-w-4xl text-center">
          <Eyebrow className="mk-rise" >Patient engagement + revenue intelligence</Eyebrow>
          <h1 id="hero-title" className="mk-rise mt-4 text-balance text-[40px] font-semibold leading-[1.06] tracking-tight text-ink sm:text-[52px] lg:text-[66px]" style={delay(40)}>
            From first enquiry to final follow-up, never lose track of a patient again.
          </h1>
          <p className="mk-rise mx-auto mt-6 max-w-2xl text-pretty text-[17px] leading-relaxed text-ink-2 sm:text-[19px]" style={delay(100)}>
            PulseOS connects calls, website leads, WhatsApp, appointments, front-desk activity, consultations and treatment follow-ups in one operational view, without replacing your existing EMR or HMIS.
          </p>
          <div className="mk-rise mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center" style={delay(160)}>
            <PrimaryCta />
            <SecondaryCta />
          </div>
        </div>

        <div className="relative mx-auto mt-12 max-w-[1120px] lg:mt-16">
          <div className="mk-rise" style={delay(200)}>
            <BrowserFrame screen="Command Centre" label="PulseOS Command Centre showing enquiries, appointments, visits and consultations (synthetic demo data)">
              <OwnerDashboardPanel compact />
            </BrowserFrame>
          </div>

          {/* Status cards: stacked under the screen on small widths, floating at its edges from lg. */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:mt-0 lg:block">
            <div className="mk-rise lg:absolute lg:-left-8 lg:-top-6 lg:w-[250px]" style={delay(380)}>
              <NextActionCard tone="success" icon={<CalendarCheck size={16} />} title="Appointment confirmed" meta="Tomorrow · 10:30 AM" />
            </div>
            <div className="mk-rise lg:absolute lg:-bottom-6 lg:-right-8 lg:w-[260px]" style={delay(440)}>
              <NextActionCard tone="primary" icon={<Phone size={16} />} title="Next action" meta="Call patient today · 5:00 PM" />
            </div>
            <div className="mk-rise lg:absolute lg:-bottom-6 lg:left-10 lg:w-[230px]" style={delay(500)}>
              <NextActionCard icon={<Clock size={16} />} title="Patient waiting" meta="8 min · with front desk" />
            </div>
          </div>
        </div>
        <p className="mt-10 text-center text-sm text-ink-2 lg:mt-14">Product screens on this page use synthetic demo data. No real patient or hospital information.</p>
      </div>
    </section>
  );
}
