import { Hero } from "../../components/marketing/Hero";
import { ProblemSection } from "../../components/marketing/ProblemSection";
import { PainGrid } from "../../components/marketing/PainGrid";
import { JourneyDemo } from "../../components/marketing/JourneyDemo";
import { TimelineSection } from "../../components/marketing/TimelineSection";
import { OwnerSection } from "../../components/marketing/OwnerSection";
import { AnalyticsSection } from "../../components/marketing/AnalyticsSection";
import { RoleSwitcher } from "../../components/marketing/RoleSwitcher";
import { AppointmentSection } from "../../components/marketing/AppointmentSection";
import { ConfigurableSection } from "../../components/marketing/ConfigurableSection";
import { ArchitectureSection } from "../../components/marketing/ArchitectureSection";
import { TrustSection } from "../../components/marketing/TrustSection";
import { FinalCta } from "../../components/marketing/FinalCta";

// Structured data: describes the product and the organisation only. No ratings, reviews, prices or customer counts.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "PulseOS",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "Patient engagement and revenue intelligence platform for hospitals and clinics: enquiries, calls, follow-ups, appointments, consultations and treatment journeys in one connected view.",
    },
    { "@type": "Organization", name: "PulseOS" },
  ],
};

export default function LandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero />
      <ProblemSection />
      <PainGrid />
      <JourneyDemo />
      <TimelineSection />
      <OwnerSection />
      <AnalyticsSection />
      <RoleSwitcher />
      <AppointmentSection />
      <ConfigurableSection />
      <ArchitectureSection />
      <TrustSection />
      <FinalCta />
    </>
  );
}
