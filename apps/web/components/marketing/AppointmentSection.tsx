import { BellRing, CalendarCheck } from "lucide-react";
import { CONTAINER, SectionHead } from "./ui";
import { LogCallPanel, NextActionCard } from "./ProductPanels";

export function AppointmentSection() {
  return (
    <section aria-labelledby="appt-title" className="bg-white py-16 sm:py-24">
      <div className={CONTAINER}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.1fr_0.9fr] sm:items-center">
            <LogCallPanel />
            <div className="space-y-3">
              <NextActionCard tone="success" icon={<CalendarCheck size={16} />} title="Appointment confirmed" meta="Tomorrow · 11:30 AM" />
              <NextActionCard tone="primary" icon={<BellRing size={16} />} title="1-hour reminder planned" meta="Sent when your messaging provider is connected" />
            </div>
          </div>
          <SectionHead eyebrow="Appointments + reminders" title={<span id="appt-title">Book the appointment while you&apos;re speaking to the patient.</span>}>
            <p>Log the call, set the outcome and confirm the date and time in one step. The follow-up task and the appointment stay on the same journey.</p>
            <p className="mt-3">Automate confirmations and reminders when your messaging provider is connected.</p>
          </SectionHead>
        </div>

        <div id="resources" className="mk-anchor mt-16 rounded-panel border border-line bg-surface-muted p-6 sm:p-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-brand">Reminders matter</p>
          <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
            <p className="text-[18px] leading-relaxed text-ink">
              Published healthcare research consistently finds that digital appointment reminders improve attendance and reduce no-shows.
            </p>
            <div>
              <p className="text-[16px] leading-relaxed text-ink-2">
                One systematic review and meta-analysis found patients who received digital (text-message) notifications were 23% more likely to attend clinic and 25% less likely to no-show than patients who received none.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                Independent research, not a PulseOS result. Source:{" "}
                <a className="font-medium text-brand underline underline-offset-2 hover:text-primary-800" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5093388/" target="_blank" rel="noopener noreferrer">
                  Robotham et al., &ldquo;Using digital notifications to improve attendance in clinic: systematic review and meta-analysis&rdquo;, BMJ Open, 2016
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
