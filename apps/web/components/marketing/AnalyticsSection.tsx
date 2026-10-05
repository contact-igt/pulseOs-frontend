import { CONTAINER, Pill, SectionHead } from "./ui";
import { SOURCE_OUTCOMES } from "./content";

export function AnalyticsSection() {
  const [google, instagram] = SOURCE_OUTCOMES;
  const rows = [google, instagram];
  return (
    <section aria-labelledby="analytics-title" className="bg-white py-16 sm:py-24">
      <div className={CONTAINER}>
        <SectionHead eyebrow="Analytics beyond lead count" title={<span id="analytics-title">A lead report tells you who enquired. PulseOS tells you what happened next.</span>} align="center" />
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2">
          <div className="rounded-panel border border-line bg-surface-muted p-5 sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-2">A traditional marketing dashboard</p>
            <ul className="mt-5 space-y-3">
              {[["Google", 40], ["Instagram", 35], ["Website", 18]].map(([s, n]) => (
                <li key={s} className="flex items-center justify-between rounded-card border border-line bg-white px-4 py-3.5 text-[16px]">
                  <span className="font-medium text-ink">{s}</span>
                  <span className="tabular-nums text-ink-2">{n} leads</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[15px] text-ink-2">Which source brought a patient who actually came? The report can&apos;t say.</p>
          </div>
          <div className="rounded-panel border border-primary-300 bg-white p-5 shadow-glass sm:p-6">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand">PulseOS <Pill tone="primary">Same sources, full journey</Pill></p>
            <ul className="mt-5 space-y-3">
              {rows.map((r) => (
                <li key={r.source} className="rounded-card border border-line bg-surface-muted px-4 py-3">
                  <p className="text-[16px] font-semibold text-ink">{r.source}</p>
                  <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
                    {[["Enquiries", r.enquiries], ["Visits", r.visits], ["Consultations", r.consultations], ["Procedures done", r.procedures]].map(([l, v]) => (
                      <div key={l}>
                        <dd className="text-xl font-semibold tabular-nums text-ink">{v}</dd>
                        <dt className="text-[11px] leading-tight text-ink-2 sm:text-xs">{l}</dt>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[15px] text-ink-2">Same enquiries. Very different outcomes. Illustrative numbers.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
