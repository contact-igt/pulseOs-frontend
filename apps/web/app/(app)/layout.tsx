"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@pulseos/api-client";
import { Sidebar } from "../../components/shell/Sidebar";
import { TopBar } from "../../components/shell/TopBar";
import { QuickCreateProvider } from "../../components/shell/QuickCreateProvider";
import { pathAllowedForRole, ROLE_HOME } from "../../components/shell/nav";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/command-centre": { title: "Command Centre", subtitle: "Hospital engagement operation at a glance" },
  "/my-work": { title: "My Work", subtitle: "Tasks, callbacks and follow-ups assigned to you" },
  "/journeys": { title: "Journeys", subtitle: "The operational surface behind the Command Centre's numbers" },
  "/patients": { title: "Patients", subtitle: "Every patient across every journey" },
  "/front-desk": { title: "Front Desk", subtitle: "Today's arrivals, waiting queue and confirmations" },
  "/appointments": { title: "Appointments", subtitle: "Every appointment, every state" },
  "/treatments": { title: "Treatments", subtitle: "Operational conversion tracking, not an EMR" },
  "/inbox": { title: "Inbox", subtitle: "Every patient conversation, one queue" },
  "/integrations": { title: "Integrations", subtitle: "Connected providers and their health" },
  "/leads": { title: "Leads", subtitle: "Track every enquiry from source to appointment" },
  "/campaigns": { title: "Campaigns / Sources", subtitle: "Where spend turns into treatment revenue" },
  "/settings": { title: "Settings", subtitle: "Specialties, custom fields and hospital configuration" },
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function doctorGreetingName(name: string) {
  const parts = name.split(" ");
  return parts[0] === "Dr." ? `${parts[0]} ${parts[1]}` : parts[0];
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, isError } = useQuery({ queryKey: ["session"], queryFn: api.session, retry: false });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  // A role's sidebar only ever links to pages it's meant to use (see nav.ts)
  // — but nothing previously stopped a direct URL, stale bookmark, or back
  // button from landing a role on a page outside that set. The API already
  // correctly rejects those requests (401/403 per-endpoint), so this was
  // never a security gap, but the result was a broken-looking page of
  // per-panel "Could not load" errors instead of a normal redirect home.
  const role = data?.user.role;
  const allowed = role ? pathAllowedForRole(role, pathname) : true;
  useEffect(() => {
    if (role && !allowed) router.replace(ROLE_HOME[role]);
  }, [role, allowed, router]);

  // Close the mobile drawer on navigation without an effect (React's
  // recommended "adjust state during render" pattern for prop-driven resets).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileNavOpen(false);
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-sm text-neutral-400">Loading PulseOS…</div>;
  }

  if (!data) return null;

  // Redirecting away (effect above) — render nothing rather than the
  // requested page, so its data hooks never fire the doomed requests.
  if (!allowed) return null;

  const meta =
    pathname === "/doctor-home"
      ? { title: `${greeting()}, ${doctorGreetingName(data.user.name)}`, subtitle: "Here's your schedule for today" }
      : (PAGE_META[pathname] ??
        (pathname.startsWith("/patients/")
          ? { title: "Patient 360", subtitle: "Full journey context for one patient" }
          : pathname.startsWith("/campaigns/")
            ? { title: "Campaign Detail", subtitle: "Spend, attribution and outcomes for one campaign" }
            : { title: "PulseOS", subtitle: undefined }));

  return (
    <QuickCreateProvider role={data.user.role}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar user={data.user} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={data.user} title={meta.title} subtitle={meta.subtitle} onMenuClick={() => setMobileNavOpen((v) => !v)} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-neutral-50 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </QuickCreateProvider>
  );
}
