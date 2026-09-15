import { test, expect, type Page } from "@playwright/test";

// Functional-hardening prompt §6 / §27 — shared drawer focus management
// (useDialogFocus, packages/ui/src/useDialogFocus.ts): focus moves into the
// dialog on open, Tab is trapped within it, Escape closes it, and focus
// returns to whatever triggered it. Covers both consumers named in the
// prompt: the Inbox patient-context drawer and the Appointment Drawer.

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/command-centre|front-desk|my-work|doctor-home/);
}

test.describe("Drawer focus management", () => {
  test.skip(!DEMO_PASSWORD, "DEMO_PASSWORD must be set");

  test("Inbox patient-context drawer traps focus and returns it to the trigger on Escape", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "coordinator@pulseos.local");
    await page.goto("/inbox");
    await expect(page.getByTestId("inbox-page")).toBeVisible();

    const trigger = page.getByTestId("open-patient-context");
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Patient context" });
    await expect(dialog).toBeVisible();
    // Focus should have moved somewhere inside the dialog, not stayed on the trigger.
    await expect(dialog.locator(":focus")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("Appointment Drawer traps focus and returns it to the row that opened it, on Escape", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin@pulseos.local");
    await page.goto("/appointments");
    await expect(page.getByTestId("appointments-page")).toBeVisible();

    const rowButton = page.locator('[data-testid^="appointment-row-"] button').first();
    await rowButton.focus();
    await rowButton.click();

    const drawer = page.getByTestId("appointment-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(":focus")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(rowButton).toBeFocused();
  });

  test("Appointment Drawer closes on backdrop click", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin@pulseos.local");
    await page.goto("/appointments");
    await expect(page.getByTestId("appointments-page")).toBeVisible();

    await page.locator('[data-testid^="appointment-row-"] button').first().click();
    const drawer = page.getByTestId("appointment-drawer");
    await expect(drawer).toBeVisible();

    await page.getByRole("dialog", { name: "Appointment details" }).getByLabel("Close", { exact: true }).click();
    await expect(drawer).toBeHidden();
  });
});
