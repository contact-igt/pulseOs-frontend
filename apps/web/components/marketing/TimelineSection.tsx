import { BrowserFrame, CONTAINER, Caption, SectionHead } from "./ui";
import { JourneyDetailPanel } from "./ProductPanels";

export function TimelineSection() {
  return (
    <section aria-labelledby="timeline-title" className="bg-white py-16 sm:py-24">
      <div className={CONTAINER}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <SectionHead eyebrow="The patient timeline" title={<span id="timeline-title">The context doesn&apos;t disappear when the staff member changes.</span>}>
              <p>Every call, appointment, visit and consultation lands on the same timeline. Hand a patient to another coordinator and they start with the full story, not a question.</p>
            </SectionHead>
            <Caption>Anyone with permission can understand what happened and what should happen next.</Caption>
          </div>
          <BrowserFrame screen="Journey" label="PulseOS patient journey timeline (synthetic demo data)">
            <JourneyDetailPanel />
          </BrowserFrame>
        </div>
      </div>
    </section>
  );
}
