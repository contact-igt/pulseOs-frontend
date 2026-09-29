"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  type LucideIcon,
} from "lucide-react";
import { PulseLockup } from "@pulseos/ui";
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
  // Unbuilt destinations are hidden, not shown greyed out: no dead navigation.
  const groups = navForRole(user.role)
    .map((group) => ({ ...group, items: group.items.filter((item) => item.implemented) }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {open && (
        <div
          className="fixed inset-y-0 right-0 left-[min(18rem,86vw)] z-30 bg-slate-900/30 lg:hidden"
          onClick={onClose}
          data-testid="sidebar-backdrop"
        />
      )}
      <nav
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-72 max-w-[86vw] shrink-0 flex-col app-sidebar transition-[transform,visibility] duration-200 max-lg:rounded-r-shell lg:static lg:m-3 lg:h-[calc(100dvh-1.5rem)] lg:w-56 lg:translate-x-0 lg:rounded-shell ${
          // Closed on small screens: off-canvas AND out of the tab order / a11y tree.
          open ? "translate-x-0" : "-translate-x-full max-lg:invisible"
        }`}
        data-testid="sidebar"
      >
        <div className="nav-divider flex h-16 shrink-0 items-center border-b px-4" data-testid="sidebar-brand">
          <PulseLockup tone="onWhite" size={28} />
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="nav-group-label px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = ICONS[item.icon] ?? LayoutDashboard;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={`nav-link flex items-center gap-2.5 rounded-control px-2.5 py-3 text-[13px] lg:py-1.5 ${active ? "font-semibold" : "font-medium"}`}
                        data-testid={`nav-${item.href}`}
                      >
                        <Icon size={17} strokeWidth={active ? 2.25 : 2} className="nav-icon shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="nav-divider flex shrink-0 items-center gap-2.5 border-t px-3 py-3">
          <span className="nav-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{initials(user.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{user.name}</span>
            <span className="nav-secondary block truncate text-xs">
              {ROLE_LABEL[user.role]}
              {user.branchName ? ` · ${user.branchName}` : ""}
            </span>
          </span>
        </div>
      </nav>
    </>
  );
}
