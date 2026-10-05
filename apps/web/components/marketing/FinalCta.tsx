import { CONTAINER, SecondaryCta } from "./ui";
import { DemoRequestForm } from "./DemoRequestForm";

export function FinalCta() {
  return (
    <section id="demo" aria-labelledby="demo-title" className="mk-anchor app-shell border-t border-line py-16 sm:py-24">
      <div className={CONTAINER}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <h2 id="demo-title" className="text-balance text-[34px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[46px] lg:text-[54px]">
              See every patient journey clearly.
            </h2>
            <p className="mt-5 max-w-lg text-[18px] leading-relaxed text-ink-2">
              We&apos;ll show you how PulseOS can fit your hospital&apos;s enquiry, follow-up and appointment workflow.
            </p>
            <div className="mt-8">
              <SecondaryCta href="#product">See the Product</SecondaryCta>
            </div>
          </div>
          <div className="rounded-panel border border-line bg-white p-5 shadow-glass sm:p-7">
            <h3 className="mb-4 text-lg font-semibold text-ink">Book a live demo</h3>
            <DemoRequestForm />
          </div>
        </div>
      </div>
    </section>
  );
}
