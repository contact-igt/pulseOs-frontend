"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
        <div className="hidden sm:block">
          <GlobalPatientSearch />
        </div>

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

/**
 * Real debounced typeahead over /patients/search (never the full patient
 * directory), 2-char trigger, arrow/Enter/Escape keyboard nav, selecting a
 * row opens Patient 360 directly.
 */
function GlobalPatientSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const trimmed = debouncedQuery.trim();
  const results = useQuery({
    queryKey: ["global-patient-search", trimmed],
    queryFn: () => api.searchPatients(trimmed),
    enabled: trimmed.length >= 2,
  });

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const rows = results.data ?? [];
  const showDropdown = open && trimmed.length >= 2;

  function selectRow(id: string) {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    router.push(`/patients/${id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!showDropdown || rows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? rows.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = activeIndex >= 0 ? rows[activeIndex] : rows[0];
      if (target) selectRow(target.id);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-1.5 rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 focus-within:border-primary-300">
        <Search size={16} className="text-neutral-400" />
        <input
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-patient-search-results"
          aria-autocomplete="list"
          placeholder="Search patients…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-40 bg-transparent text-xs text-slate-900 outline-none placeholder:text-neutral-400 lg:w-56"
          data-testid="global-patient-search"
        />
      </div>

      {showDropdown && (
        <ul
          id="global-patient-search-results"
          role="listbox"
          className="absolute right-0 top-full z-30 mt-1 max-h-80 w-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg sm:w-80"
          data-testid="global-patient-search-results"
        >
          {results.isFetching && rows.length === 0 && <li className="px-3 py-2 text-xs text-neutral-400">Searching…</li>}
          {!results.isFetching && rows.length === 0 && <li className="px-3 py-2 text-xs text-neutral-400">No patients match “{trimmed}”.</li>}
          {rows.map((row, i) => (
            <li key={row.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onClick={() => selectRow(row.id)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs ${i === activeIndex ? "bg-primary-50" : "hover:bg-neutral-50"}`}
                data-testid={`global-search-result-${row.id}`}
              >
                <span className="min-w-0 truncate font-medium text-slate-900">{row.name}</span>
                <span className="shrink-0 text-neutral-400">{row.currentJourneyType ?? row.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
