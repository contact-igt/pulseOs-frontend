import type { Role } from "@pulseos/types";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  implemented: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const FULL_NAV: NavGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Command Centre", href: "/command-centre", icon: "LayoutDashboard", implemented: true },
      { label: "My Work", href: "/my-work", icon: "ListChecks", implemented: true },
    ],
  },
  {
    label: "Patients",
    items: [
      { label: "Patients", href: "/patients", icon: "Users", implemented: true },
      { label: "Journeys", href: "/journeys", icon: "GitBranch", implemented: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Front Desk", href: "/front-desk", icon: "CalendarCheck", implemented: true },
      { label: "Appointments", href: "/appointments", icon: "CalendarCheck", implemented: true },
      { label: "Treatments", href: "/treatment", icon: "Stethoscope", implemented: true },
      { label: "Inbox", href: "/inbox", icon: "Inbox", implemented: true },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Campaigns / Sources", href: "/campaigns", icon: "Megaphone", implemented: false },
      { label: "Analytics", href: "/analytics", icon: "BarChart3", implemented: false },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Team", href: "/team", icon: "UsersRound", implemented: false },
      { label: "Integrations", href: "/integrations", icon: "Plug", implemented: false },
      { label: "Settings", href: "/settings", icon: "Settings", implemented: false },
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
      { label: "Appointments", href: "/appointments", icon: "CalendarCheck", implemented: false },
      { label: "Patients", href: "/patients", icon: "Users", implemented: true },
    ],
  },
  {
    label: "Operations",
    items: [{ label: "My Work", href: "/my-work", icon: "ListChecks", implemented: true }],
  },
];

export function navForRole(role: Role): NavGroup[] {
  return role === "DOCTOR" ? DOCTOR_NAV : FULL_NAV;
}
