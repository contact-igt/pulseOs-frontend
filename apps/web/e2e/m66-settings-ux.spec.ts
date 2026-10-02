import { test, expect, type Page } from "@playwright/test";

// M6.6 Settings UX: the tab strip never scrolls vertically, scrolls sideways when it must, and keeps every tab reachable.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/command-centre|front-desk|my-work|doctor-home/);
}

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

test.describe("M6.6 — Settings tab strip", () => {
  test.skip(!DEMO_PASSWORD, "DEMO_PASSWORD must be set to run this suite");

  for (const vp of VIEWPORTS) {
    test(`${vp.width}x${vp.height}: no vertical scrollbar, every tab reachable, no page overflow`, async ({ page }) => {
      await page.setViewportSize(vp);
      await login(page, "eyev1.admin@pulseos.local");
      await page.goto("/settings");
      const strip = page.getByRole("tablist", { name: "Settings sections" });
      await expect(strip).toBeVisible();

      // 1. The strip has no vertical overflow and the computed overflow-y is not auto/scroll.
      const m = await strip.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, oy: getComputedStyle(el).overflowY, ox: getComputedStyle(el).overflowX }));
      expect(m.oy).toBe("hidden");
      expect(m.ox).toBe("auto");
      expect(m.sh).toBeLessThanOrEqual(m.ch);

      // 2. Every tab can be reached: select the last one; it ends up inside the strip's visible box.
      const tabs = strip.getByRole("tab");
      const count = await tabs.count();
      expect(count).toBeGreaterThan(3);
      const last = tabs.nth(count - 1);
      await last.click();
      await expect(last).toHaveAttribute("aria-selected", "true");
      await expect.poll(async () => {
        const [s, t] = await Promise.all([strip.boundingBox(), last.boundingBox()]);
        return !!s && !!t && t.x >= s.x - 1 && t.x + t.width <= s.x + s.width + 1;
      }).toBe(true);

      // 3. The active tab is visibly marked (not colour alone: it carries aria-selected and an indicator).
      expect(await last.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");

      // 4. Touch targets are at least 44px tall on small screens.
      if (vp.width < 768) expect((await last.boundingBox())!.height).toBeGreaterThanOrEqual(44);

      // 5. The page itself never scrolls sideways.
      const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      expect(sw).toBeLessThanOrEqual(iw);
    });
  }

  test("keyboard: arrow keys move between tabs and the selection follows focus", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, "eyev1.admin@pulseos.local");
    await page.goto("/settings");
    const strip = page.getByRole("tablist", { name: "Settings sections" });
    const first = strip.getByRole("tab").first();
    await first.focus();
    await page.keyboard.press("ArrowRight");
    const second = strip.getByRole("tab").nth(1);
    await expect(second).toHaveAttribute("aria-selected", "true");
    await expect(second).toBeFocused();
    await page.keyboard.press("End");
    await expect(strip.getByRole("tab").last()).toHaveAttribute("aria-selected", "true");
  });
});
