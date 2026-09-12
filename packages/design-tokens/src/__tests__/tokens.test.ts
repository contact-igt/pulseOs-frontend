import { describe, expect, it } from "vitest";
import { colors, spacing, typography } from "../index";

describe("design tokens contract", () => {
  it("primary color scale is complete from 50 to 900", () => {
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
    for (const step of steps) {
      expect(colors.primary[step]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("warning and danger scales exist for operational alerts only", () => {
    expect(colors.warning[500]).toBeDefined();
    expect(colors.danger[500]).toBeDefined();
  });

  it("spacing scale follows a 4px rhythm", () => {
    expect(spacing[1]).toBe("4px");
    expect(spacing[2]).toBe("8px");
    expect(spacing[4]).toBe("16px");
  });

  it("typography scale defines every named step", () => {
    for (const key of ["xs", "sm", "base", "md", "lg", "xl"] as const) {
      expect(typography.scale[key].size).toMatch(/px$/);
    }
  });
});
