"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@pulseos/api-client";
import { Sidebar } from "../../components/shell/Sidebar";
import { TopBar } from "../../components/shell/TopBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({ queryKey: ["session"], queryFn: api.session, retry: false });

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-sm text-neutral-400">Loading PulseOS…</div>;
  }

  if (!data) return null;

  return (
    <div className="flex">
      <Sidebar role={data.user.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar user={data.user} />
        <main className="flex-1 bg-neutral-50 p-6">{children}</main>
      </div>
    </div>
  );
}
