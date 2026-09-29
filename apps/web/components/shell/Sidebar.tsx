"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  GitBranch,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Plug,
  Settings,
  Stethoscope,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { SessionUser } from "@pulseos/types";
import { initials, navForRole } from "./nav";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  ListChecks,
  Users,
  GitBranch,
  CalendarCheck,
  Stethoscope,
  Inbox,
  Megaphone,
  BarChart3,
  UsersRound,
  Plug,
  Settings,
  UserPlus,
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  HOSPITAL_ADMIN: "Hospital Admin",
  FRONT_DESK: "Front Desk",
  PATIENT_COORDINATOR: "Patient Coordinator",
  DOCTOR: "Doctor",
};


export function Sidebar({ user, open = false, onClose }: { user: SessionUser; open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const groups = navForRole(user.role);

  return (
    <>
      {open && (
        <div
          className="fixed inset-y-0 left-56 right-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          data-testid="sidebar-backdrop"
        />
      )}
      <nav
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-56 shrink-0 flex-col app-sidebar transition-[transform,visibility] duration-200 lg:static lg:translate-x-0 ${
          // Closed on small screens: off-canvas AND out of the tab order / a11y tree.
          open ? "translate-x-0" : "-translate-x-full max-lg:invisible"
        }`}
        data-testid="sidebar"
      >
      <div className="flex h-16 items-center border-b border-white/10 px-4">
        <span className="text-base font-semibold tracking-tight text-white">PulseOS</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary-200">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                return (
                  <li key={item.href}>
                    {item.implemented ? (
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded px-2 py-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white lg:py-1.5 ${
                          active ? "bg-white/12 font-medium text-white shadow-[inset_2px_0_0_var(--color-accent-300)]" : "text-primary-100 hover:bg-white/8 hover:text-white"
                        }`}
                        data-testid={`nav-${item.href}`}
                      >
                        <Icon size={18} strokeWidth={2} />
                        {item.label}
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="flex cursor-not-allowed items-center gap-2.5 rounded px-2 py-2.5 text-sm text-primary-300/70 lg:py-1.5"
                        title="Not built yet"
                        data-testid={`nav-disabled-${item.href}`}
                      >
                        <Icon size={18} strokeWidth={2} />
                        {item.label}
                        <span className="sr-only"> (coming soon)</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 border-t border-white/10 px-3 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{user.name}</span>
          <span className="block truncate text-xs text-primary-200">
            {ROLE_LABEL[user.role]}
            {user.branchName ? ` · ${user.branchName}` : ""}
          </span>
        </span>
      </div>
      </nav>
    </>
  );
}
