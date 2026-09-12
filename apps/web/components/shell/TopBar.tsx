"use client";

import { useRouter } from "next/navigation";
import type { SessionUser } from "@pulseos/types";
import { api } from "@pulseos/api-client";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  HOSPITAL_ADMIN: "Hospital Admin",
  FRONT_DESK: "Front Desk",
  PATIENT_COORDINATOR: "Patient Coordinator",
  DOCTOR: "Doctor",
};

export function TopBar({ user }: { user: SessionUser }) {
  const router = useRouter();
  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  async function logout() {
    await api.logout();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <span className="text-sm text-neutral-500">{today}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-900">{user.name}</span>
        <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{ROLE_LABEL[user.role]}</span>
        <button
          type="button"
          onClick={logout}
          className="rounded px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-slate-900"
          data-testid="logout-button"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
