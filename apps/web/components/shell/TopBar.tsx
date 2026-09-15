"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Search } from "lucide-react";
import { QuickCreateMenu, type QuickCreateItem } from "@pulseos/ui";
import type { SessionUser } from "@pulseos/types";
import { api } from "@pulseos/api-client";
import { useQuickCreate } from "./QuickCreateProvider";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  HOSPITAL_ADMIN: "Hospital Admin",
  FRONT_DESK: "Front Desk",
  PATIENT_COORDINATOR: "Patient Coordinator",
  DOCTOR: "Doctor",
};

export function TopBar({
  user,
  title,
  subtitle,
  onMenuClick,
}: {
  user: SessionUser;
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const quickCreate = useQuickCreate();

  const quickCreateItems: QuickCreateItem[] = [
    user.role !== "DOCTOR" && { key: "lead", label: "Add Lead", onClick: () => quickCreate.openAddLead() },
    user.role !== "DOCTOR" && { key: "appointment", label: "Add Appointment", onClick: () => quickCreate.openNewAppointment() },
    user.role !== "DOCTOR" && { key: "task", label: "Add Task", onClick: () => quickCreate.openAddTask() },
    user.role !== "DOCTOR" && { key: "patient", label: "Add Patient", onClick: () => quickCreate.openAddPatient() },
  ].filter((x): x is QuickCreateItem => !!x);

  async function logout() {
    await api.logout();
    router.push("/login");
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/patients?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="-ml-1 shrink-0 rounded p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-slate-900 lg:hidden"
          title="Open menu"
          data-testid="mobile-menu-button"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="truncate text-xs text-neutral-500">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <form onSubmit={submitSearch} className="hidden sm:block">
          <div className="flex items-center gap-1.5 rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 focus-within:border-primary-300">
            <Search size={16} className="text-neutral-400" />
            <input
              type="text"
              placeholder="Search patients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-40 bg-transparent text-xs text-slate-900 outline-none placeholder:text-neutral-400 lg:w-56"
              data-testid="global-patient-search"
            />
          </div>
        </form>

        <QuickCreateMenu items={quickCreateItems} />

        {/* Not wired to anything yet (no notifications domain exists) —
            visibly disabled rather than a silent no-op click. */}
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded p-1.5 text-neutral-300"
          title="Notifications — coming soon"
          aria-label="Notifications — coming soon"
          data-testid="notifications-button"
        >
          <Bell size={16} />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-left transition hover:bg-neutral-100"
            data-testid="profile-menu-trigger"
          >
            <span className="text-sm text-slate-900">{user.name}</span>
            <ChevronDown size={14} className="text-neutral-400" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded border border-neutral-200 bg-white py-1 shadow-sm">
              <div className="border-b border-neutral-100 px-3 py-2">
                <p className="text-xs font-medium text-slate-900">{ROLE_LABEL[user.role]}</p>
                {user.branchName && <p className="text-xs text-neutral-500">{user.branchName}</p>}
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-600 transition hover:bg-neutral-100 hover:text-slate-900"
                data-testid="logout-button"
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
