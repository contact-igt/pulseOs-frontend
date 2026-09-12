"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@pulseos/types";
import { navForRole } from "./nav";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navForRole(role);

  return (
    <nav className="flex h-screen w-56 shrink-0 flex-col border-r border-neutral-200 bg-white px-3 py-4">
      <div className="mb-6 px-2">
        <span className="text-base font-semibold text-primary-700">PulseOS</span>
      </div>
      <ul className="flex-1 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              {item.implemented ? (
                <Link
                  href={item.href}
                  className={`block rounded px-2 py-1.5 text-sm transition ${
                    active ? "bg-primary-50 font-medium text-primary-700" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                  data-testid={`nav-${item.href}`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="block cursor-not-allowed rounded px-2 py-1.5 text-sm text-neutral-300"
                  title="Not built yet"
                  data-testid={`nav-disabled-${item.href}`}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
