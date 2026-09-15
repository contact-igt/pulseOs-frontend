import { test, expect, type Page } from "@playwright/test";
import path from "path";

// Command Centre acceptance screenshots (funcional-hardening prompt §23) —
// verifies the Journey Health radial centering fix and Journey Funnel
// replacement hold up across every required breakpoint.

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";
const ARTIFACTS_DIR = path.resolve(__dirname, "../../../review-artifacts/brain-review");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@pulseos.local");
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/command-centre/);
}

test.describe("Command Centre — responsive acceptance", () => {
  test.skip(!DEMO_PASSWORD, "DEMO_PASSWORD must be set");

  test("captures 1440/1280/1024/768 and asserts no horizontal overflow", async ({ page }) => {
    // fullPage: false (viewport-only) deliberately — a fullPage capture with
    // this shell's `position: fixed` sidebar re-paints the sidebar at every
    // scrolled segment Playwright stitches together, producing a misleading
    // "sidebar overlapping content" artifact that doesn't reflect any real
    // runtime bug (confirmed by comparing against a live viewport render).
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await expect(page.getByTestId("command-centre")).toBeVisible();
    await expect(page.getByTestId("journey-funnel")).toBeVisible();
    await expect(page.getByTestId("journey-health-radial")).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "command-centre-1440.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "command-centre-1280.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "command-centre-1024.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "command-centre-768.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
