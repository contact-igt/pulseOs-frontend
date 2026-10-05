import { expect, test } from "@playwright/test";

// The public marketing site at "/". Needs only the web app (no API, no database): it is static and uses synthetic data.

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1024", width: 1024, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

test.describe("public site", () => {
  test("/ is the public landing page, not a redirect to login, with no app chrome", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Know what happened after every patient enquiry.");
    await expect(page.locator(".app-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("dev-login-block")).toHaveCount(0);
    await expect(page).toHaveTitle("PulseOS — Patient Engagement & Hospital Operations Platform");
  });

  test("nav and CTAs point where they say", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Product" })).toHaveAttribute("href", "#product");
    await expect(nav.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "#journey");
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toHaveAttribute("href", "/login");
    await page.getByRole("link", { name: "Watch a patient journey" }).click();
    await expect(page.locator("#journey")).toBeInViewport();
    await page.getByRole("link", { name: "Book demo" }).click();
    await expect(page.locator("#demo")).toBeInViewport();
  });

  test("the interactive patient journey moves the timeline and the owner funnel", async ({ page }) => {
    await page.goto("/");
    await page.locator("#journey").scrollIntoViewIfNeeded();
    const count = (i: number) => page.getByTestId(`journey-count-${i}`);
    await expect(count(0)).toHaveText("43");
    for (const label of ["Log the call", "Confirm appointment", "Check in", "Send to doctor"]) {
      await expect(page.getByTestId("journey-action")).toContainText(label);
      await page.getByTestId("journey-action").click();
    }
    await expect(page.getByTestId("journey-timeline")).toContainText("Procedure advised");
    await expect(count(4)).toHaveText("10");
    await expect(page.getByTestId("journey-action")).toContainText("Replay the journey");
    await page.getByTestId("journey-action").click();
    await expect(count(4)).toHaveText("9");
  });

  test("role tabs work with the keyboard and swap copy and screen", async ({ page }) => {
    await page.goto("/");
    const first = page.getByRole("tab", { name: "Owner" });
    await first.scrollIntoViewIfNeeded();
    await first.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Front desk" })).toBeFocused();
    await expect(page.getByTestId("role-headline")).toHaveText("Run today's patient flow without paper queues.");
    await page.keyboard.press("End");
    await expect(page.getByTestId("role-headline")).toHaveText("Know who's next and why they're here.");
    await expect(page.getByTestId("role-panel")).toContainText("Dr. Menon");
  });

  test("workflow switches change the Add Lead preview", async ({ page }) => {
    await page.goto("/");
    const preview = page.getByTestId("add-lead-preview");
    await preview.scrollIntoViewIfNeeded();
    await expect(preview).not.toContainText("Date of Birth");
    await page.getByRole("switch", { name: "Show Date of Birth on Add Lead" }).click();
    await expect(preview).toContainText("Date of Birth");
  });

  test("the demo form never silently drops a request", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Name").fill("Dr Rao");
    await page.getByLabel("Hospital / Clinic").fill("Lakeview Eye");
    await page.getByLabel("Phone").fill("+91 90000 00000");
    await page.getByLabel("Work email").fill("rao@lakeview.example");
    // Without NEXT_PUBLIC_DEMO_REQUEST_EMAIL the form must say nothing was sent; with it, it hands off to the mail app.
    await page.getByRole("button", { name: "Book a live demo" }).click();
    await expect(page.getByTestId("demo-form-status")).toContainText(/nothing was sent|email app should now be open/);
  });

  test("reduced motion shows every finished state with no hidden content", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await page.locator("#oldway-title").scrollIntoViewIfNeeded();
    const items = page.getByTestId("old-way").locator("ol li");
    for (const i of [0, 4]) expect(await items.nth(i).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await page.getByTestId("hook-stairs").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("hook-stairs")).toHaveAttribute("data-phase", "static");
    const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getComputedTiming().duration as number) > 50).length);
    expect(anims).toBe(0);
    await context.close();
  });

  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow at ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
      // Every interactive control meets a usable touch target on small screens.
      if (vp.width <= 768) {
        const small = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("button, [role=tab], summary")]
            .filter((e) => e.offsetParent !== null)
            .map((e) => ({ t: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30), h: e.getBoundingClientRect().height }))
            .filter((x) => x.h < 40),
        );
        expect(small).toEqual([]);
      }
    });
  }

  test("sign-in routes are untouched by the public site", async ({ page }) => {
    for (const path of ["/login", "/login/namokar-v1", "/login/namokar-v2"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator(".mk-site")).toHaveCount(0);
      await expect(page.getByLabel("Email address")).toBeVisible();
    }
  });
});
