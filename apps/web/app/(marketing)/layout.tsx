import type { Metadata } from "next";
import { MarketingNav } from "../../components/marketing/MarketingNav";
import { MarketingFooter } from "../../components/marketing/MarketingFooter";

export const metadata: Metadata = {
  title: { absolute: "PulseOS — Patient Engagement & Hospital CRM Platform" },
  description: "Track hospital enquiries, calls, follow-ups, appointments, consultations and treatment journeys in one connected patient engagement platform.",
  keywords: ["hospital CRM India", "healthcare CRM", "patient engagement platform", "hospital lead management software", "patient journey management", "hospital appointment and follow-up software"],
  openGraph: {
    type: "website",
    siteName: "PulseOS",
    title: "PulseOS — Patient Engagement & Hospital CRM Platform",
    description: "From first enquiry to final follow-up, one connected patient journey for hospitals and clinics.",
  },
  twitter: { card: "summary", title: "PulseOS — Patient Engagement & Hospital CRM Platform", description: "One connected patient journey for hospitals and clinics." },
};

/** Public marketing shell: its own nav and footer, none of the signed-in app chrome (sidebar, dev login, internal nav). */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk-site min-h-screen bg-white text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-overlay)] focus:rounded-control focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-glass">
        Skip to content
      </a>
      <MarketingNav />
      <main id="main">{children}</main>
      <MarketingFooter />
    </div>
  );
}
