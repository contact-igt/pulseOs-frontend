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
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { SessionUser } from "@pulseos/types";
import { navForRole } from "./nav";

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
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  HOSPITAL_ADMIN: "Hospital Admin",
  FRONT_DESK: "Front Desk",
  PATIENT_COORDINATOR: "Patient Coordinator",
  DOCTOR: "Doctor",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const groups = navForRole(user.role);

  return (
    <nav className="flex h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex h-14 items-center border-b border-neutral-200 px-4">
        <span className="text-base font-semibold tracking-tight text-primary-700">PulseOS</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                return (
                  <li key={item.href}>
                    {item.implemented ? (
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded px-2 py-1.5 text-sm transition ${
                          active ? "bg-primary-50 font-medium text-primary-700" : "text-neutral-600 hover:bg-neutral-100"
                        }`}
                        data-testid={`nav-${item.href}`}
                      >
                        <Icon size={16} strokeWidth={2} />
                        {item.label}
                      </Link>
                    ) : (
                      <span
                        className="flex cursor-not-allowed items-center gap-2.5 rounded px-2 py-1.5 text-sm text-neutral-300"
                        title="Not built yet"
                        data-testid={`nav-disabled-${item.href}`}
                      >
                        <Icon size={16} strokeWidth={2} />
                        {item.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 border-t border-neutral-200 px-3 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">{user.name}</span>
          <span className="block truncate text-xs text-neutral-500">
            {ROLE_LABEL[user.role]}
            {user.branchName ? ` · ${user.branchName}` : ""}
          </span>
        </span>
      </div>
    </nav>
  );
}
