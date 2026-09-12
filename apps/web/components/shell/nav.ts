import type { Role } from "@pulseos/types";

export interface NavItem {
  label: string;
  href: string;
  implemented: boolean;
}

const FULL_NAV: NavItem[] = [
  { label: "Command Centre", href: "/command-centre", implemented: true },
  { label: "Patients", href: "/patients", implemented: true },
  { label: "Journeys", href: "/journeys", implemented: true },
  { label: "Inbox", href: "/inbox", implemented: false },
  { label: "Appointments", href: "/appointments", implemented: false },
  { label: "My Work", href: "/my-work", implemented: true },
  { label: "Treatment", href: "/treatment", implemented: false },
  { label: "Campaigns / Sources", href: "/campaigns", implemented: false },
  { label: "Analytics", href: "/analytics", implemented: false },
  { label: "Team", href: "/team", implemented: false },
  { label: "Integrations", href: "/integrations", implemented: false },
  { label: "Settings", href: "/settings", implemented: false },
];

const DOCTOR_NAV: NavItem[] = [
  { label: "Command Centre", href: "/doctor-home", implemented: true },
  { label: "Appointments", href: "/appointments", implemented: false },
  { label: "Patients", href: "/patients", implemented: true },
  { label: "My Work", href: "/my-work", implemented: true },
];

export function navForRole(role: Role): NavItem[] {
  return role === "DOCTOR" ? DOCTOR_NAV : FULL_NAV;
}
