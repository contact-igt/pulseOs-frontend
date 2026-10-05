import { CONTAINER, Eyebrow, SectionHead } from "./ui";
import { INDIA_REALITIES, PRINCIPLES, SECURITY_POINTS } from "./content";

export function TrustSection() {
  return (
    <>
      <section aria-labelledby="india-title" className="mk-section-ice border-y border-line py-16 sm:py-24">
        <div className={CONTAINER}>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
            <SectionHead eyebrow="Built for Indian hospital operations" title={<span id="india-title">Built with real hospital workflows.</span>}>
              <p>Built for how Indian hospitals actually receive and follow up with patients: calls, WhatsApp, walk-ins, referrals, websites and digital campaigns.</p>
              <p className="mt-3">Designed around front-desk, coordinator, owner and doctor workflows, and configurable per hospital.</p>
            </SectionHead>
            <ul className="flex flex-wrap gap-2.5" aria-label="Workflow realities PulseOS is built for">
              {INDIA_REALITIES.map((r) => (
                <li key={r} className="rounded-full border border-line-strong bg-white px-4 py-2.5 text-[15px] font-medium text-ink">{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="security-title" className="bg-white py-16 sm:py-24">
        <div className={CONTAINER}>
          <SectionHead eyebrow="Security and control" title={<span id="security-title">Your team sees what their role allows.</span>} />
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {SECURITY_POINTS.map((s) => (
              <li key={s.title} className="rounded-panel border border-line bg-surface-muted p-5">
                <h3 className="text-[17px] font-semibold tracking-tight text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Product principles" className="border-y border-line bg-primary-50 py-10">
        <div className={CONTAINER}>
          <Eyebrow className="mb-5">What we hold to</Eyebrow>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => (
              <li key={p} className="border-l-2 border-brand pl-4 text-[17px] font-medium leading-snug text-ink">{p}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
