import { describe, expect, it } from "vitest";
import { lockedNavItems, navForRole, pathAllowedForRole } from "../nav";

const hrefs = (role: Parameters<typeof navForRole>[0], edition: Parameters<typeof navForRole>[1]) => navForRole(role, edition).flatMap((g) => g.items.map((i) => i.href));

describe("edition-aware navigation", () => {
  it("a Beta V1 tenant's Admin gets the core CRM and none of the growth pages", () => {
    const v1 = hrefs("HOSPITAL_ADMIN", "BETA_V1_CORE");
    for (const core of ["/command-centre", "/my-work", "/leads", "/patients", "/journeys", "/appointments", "/front-desk", "/treatments", "/integrations", "/settings"]) expect(v1).toContain(core);
    for (const growth of ["/inbox", "/campaigns", "/analytics"]) expect(v1).not.toContain(growth);
  });

  it("a Beta V2 tenant keeps every page it had", () => {
    const v2 = hrefs("HOSPITAL_ADMIN", "BETA_V2_GROWTH");
    for (const growth of ["/inbox", "/campaigns", "/analytics"]) expect(v2).toContain(growth);
  });

  it("the route guard refuses a growth URL on V1 but not on V2 (a stale bookmark is redirected home)", () => {
    expect(pathAllowedForRole("HOSPITAL_ADMIN", "/campaigns", "BETA_V1_CORE")).toBe(false);
    expect(pathAllowedForRole("HOSPITAL_ADMIN", "/campaigns/abc", "BETA_V1_CORE")).toBe(false);
    expect(pathAllowedForRole("HOSPITAL_ADMIN", "/analytics", "BETA_V1_CORE")).toBe(false);
    expect(pathAllowedForRole("HOSPITAL_ADMIN", "/inbox", "BETA_V1_CORE")).toBe(false);
    expect(pathAllowedForRole("HOSPITAL_ADMIN", "/campaigns", "BETA_V2_GROWTH")).toBe(true);
    expect(pathAllowedForRole("HOSPITAL_ADMIN", "/journeys/abc", "BETA_V1_CORE")).toBe(true);
  });

  it("the Inbox is shown dimmed as Beta V2 on V1 for roles that could use it, and never for V2 or Doctor", () => {
    expect(lockedNavItems("FRONT_DESK", "BETA_V1_CORE").map((i) => i.href)).toEqual(["/inbox"]);
    expect(lockedNavItems("FRONT_DESK", "BETA_V2_GROWTH")).toEqual([]);
    expect(lockedNavItems("DOCTOR", "BETA_V1_CORE")).toEqual([]);
  });

  it("Doctor navigation is unchanged by edition", () => {
    expect(hrefs("DOCTOR", "BETA_V1_CORE")).toEqual(hrefs("DOCTOR", "BETA_V2_GROWTH"));
  });
});
