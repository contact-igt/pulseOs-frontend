import { hasPermission, type Permission, type Role } from "@pulseos/types";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  implemented: boolean;
  /** Omit for items every non-Doctor role can reach (e.g. Settings, whose
   * page itself degrades gracefully for a role without MANAGE_SPECIALTIES —
   * see settings/page.tsx's own `canManage` gating). When set, the item
   * (and the route guard it feeds) is filtered against the same
   * ROLE_PERMISSIONS map the API enforces server-side, so a role's sidebar
   * can never link to a page its session is actually forbidden to load. */
  permission?: Permission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const FULL_NAV: NavGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Command Centre", href: "/command-centre", icon: "LayoutDashboard", implemented: true, permission: "VIEW_ADMIN_COMMAND_CENTRE" },
      { label: "My Work", href: "/my-work", icon: "ListChecks", implemented: true, permission: "VIEW_TASKS" },
    ],
  },
  {
    label: "Acquisition",
    items: [{ label: "Leads", href: "/leads", icon: "UserPlus", implemented: true, permission: "MANAGE_LEADS" }],
  },
  {
    label: "Patients",
    items: [
      { label: "Patients", href: "/patients", icon: "Users", implemented: true, permission: "VIEW_PATIENTS" },
      { label: "Journeys", href: "/journeys", icon: "GitBranch", implemented: true, permission: "VIEW_JOURNEYS" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Front Desk", href: "/front-desk", icon: "CalendarCheck", implemented: true, permission: "VIEW_APPOINTMENTS" },
      { label: "Appointments", href: "/appointments", icon: "CalendarCheck", implemented: true, permission: "VIEW_APPOINTMENTS" },
      { label: "Treatments", href: "/treatments", icon: "Stethoscope", implemented: true, permission: "VIEW_TREATMENT" },
      { label: "Inbox", href: "/inbox", icon: "Inbox", implemented: true, permission: "VIEW_INBOX" },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Campaigns / Sources", href: "/campaigns", icon: "Megaphone", implemented: true, permission: "VIEW_MARKETING" },
      { label: "Analytics", href: "/analytics", icon: "BarChart3", implemented: false },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Team", href: "/team", icon: "UsersRound", implemented: false },
      { label: "Integrations", href: "/integrations", icon: "Plug", implemented: true, permission: "VIEW_INTEGRATIONS" },
      { label: "Settings", href: "/settings", icon: "Settings", implemented: true },
    ],
  },
];

const DOCTOR_NAV: NavGroup[] = [
  {
    label: "Main",
    items: [{ label: "Command Centre", href: "/doctor-home", icon: "LayoutDashboard", implemented: true }],
  },
  {
    label: "Patients",
    items: [
      { label: "Appointments", href: "/appointments", icon: "CalendarCheck", implemented: true },
      { label: "Patients", href: "/patients", icon: "Users", implemented: true },
    ],
  },
  {
    label: "Operations",
    items: [{ label: "My Work", href: "/my-work", icon: "ListChecks", implemented: true }],
  },
];

export function navForRole(role: Role): NavGroup[] {
  // Doctor's nav is a deliberately different information architecture (its
  // own "Command Centre" pointing at /doctor-home, no Treatments/Campaigns/
  // Integrations even though a Doctor's VIEW_TREATMENT permission would
  // technically allow reading them) — curated explicitly, not derived.
  if (role === "DOCTOR") return DOCTOR_NAV;

  // Every other role shares one nav shape, filtered down to what its actual
  // permissions allow. Front Desk and Patient Coordinator previously saw
  // Hospital Admin's full sidebar regardless of their real (narrower, always
  // server-enforced) permissions — e.g. Front Desk lacks VIEW_TREATMENT,
  // VIEW_MARKETING and VIEW_INTEGRATIONS, so its old sidebar linked to 3
  // pages that would 403 on every request the moment they loaded, the same
  // failure class the Doctor route-guard fix addressed. Filtering here means
  // pathAllowedForRole (below) picks the fix up automatically, with no
  // separate per-role guard list to maintain.
  return FULL_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || hasPermission(role, item.permission)),
  })).filter((group) => group.items.length > 0);
}

// The one shared map from role to landing page — login redirects here after
// sign-in, and the route guard below redirects here from any page outside
// the role's own nav. Previously duplicated as a local const in
// login/page.tsx; consolidated so the two can't drift.
export const ROLE_HOME: Record<Role, string> = {
  DOCTOR: "/doctor-home",
  HOSPITAL_ADMIN: "/command-centre",
  SUPER_ADMIN: "/command-centre",
  FRONT_DESK: "/front-desk",
  PATIENT_COORDINATOR: "/my-work",
};

// Legacy URLs that exist only to `redirect()` a browser straight to their
// canonical replacement (see app/(app)/treatment/page.tsx) — role-neutral by
// definition, since every role ends up at the same next page regardless of
// who followed the old link. The guard must not treat these as "not
// allowed": that redirect is a Server Component effect that runs before the
// client ever mounts, but the client route guard's own effect can still fire
// on the pre-redirect pathname in the same tick and win the race, sending
// the user to their role home instead of where the old link actually meant
// to go.
const ROLE_NEUTRAL_REDIRECT_PATHS = ["/treatment"];

// True if `pathname` is reachable from this role's own sidebar, or is a
// detail sub-route of something that is (e.g. /patients/abc123 under a nav
// entry for /patients). Driven entirely by the existing nav data — no
// separate permission list to keep in sync with it.
export function pathAllowedForRole(role: Role, pathname: string): boolean {
  if (ROLE_NEUTRAL_REDIRECT_PATHS.includes(pathname)) return true;
  const items = navForRole(role).flatMap((group) => group.items);
  return items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
