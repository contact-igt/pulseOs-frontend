import { CONTAINER, Eyebrow } from "./ui";
import { BeforeAfter } from "./BeforeAfter";

export function ProblemSection() {
  return (
    <section aria-labelledby="problem-title" className="bg-white py-16 sm:py-24">
      <div className={CONTAINER}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <Eyebrow>The problem isn&apos;t getting leads.</Eyebrow>
            <h2 id="problem-title" className="mt-3 text-balance text-[32px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[42px] lg:text-[48px]">
              It&apos;s knowing what happened after the enquiry.
            </h2>
          </div>
          <div className="space-y-4 text-[17px] leading-relaxed text-ink-2">
            <p>
              A patient calls. Another sends a WhatsApp message. Someone fills the website form. Another walks in. Your front desk writes something down. A coordinator follows up later. An appointment may get booked. The doctor sees the patient. A procedure may be advised.
            </p>
            <p className="font-medium text-ink">
              But when the information lives across calls, WhatsApp, notebooks, spreadsheets and different systems, the complete journey disappears.
            </p>
          </div>
        </div>
        <BeforeAfter />
      </div>
    </section>
  );
}
