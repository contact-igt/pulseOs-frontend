"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@pulseos/api-client";
import { Sidebar } from "../../components/shell/Sidebar";
import { TopBar } from "../../components/shell/TopBar";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/command-centre": { title: "Command Centre", subtitle: "Hospital engagement operation at a glance" },
  "/doctor-home": { title: "Command Centre", subtitle: "Your patients and schedule for today" },
  "/my-work": { title: "My Work", subtitle: "Tasks, callbacks and follow-ups assigned to you" },
  "/journeys": { title: "Journeys", subtitle: "The operational surface behind the Command Centre's numbers" },
  "/patients": { title: "Patients", subtitle: "Every patient across every journey" },
  "/front-desk": { title: "Front Desk", subtitle: "Today's arrivals, waiting queue and confirmations" },
  "/appointments": { title: "Appointments", subtitle: "Every appointment, every state" },
  "/treatments": { title: "Treatments", subtitle: "Operational conversion tracking, not an EMR" },
  "/inbox": { title: "Inbox", subtitle: "Every patient conversation, one queue" },
  "/integrations": { title: "Integrations", subtitle: "Connected providers and their health" },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, isError } = useQuery({ queryKey: ["session"], queryFn: api.session, retry: false });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

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

  const meta =
    PAGE_META[pathname] ?? (pathname.startsWith("/patients/") ? { title: "Patient 360", subtitle: "Full journey context for one patient" } : { title: "PulseOS", subtitle: undefined });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={data.user} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={data.user} title={meta.title} subtitle={meta.subtitle} onMenuClick={() => setMobileNavOpen((v) => !v)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-neutral-50 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
