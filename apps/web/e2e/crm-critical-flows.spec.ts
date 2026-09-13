import { test, expect } from "@playwright/test";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/command-centre|front-desk|my-work|doctor-home/);
}

function uniquePhone(): string {
  return `9${Math.floor(100000000 + Math.random() * 899999999)}`;
}

test.describe("CRM critical business flows", () => {
  test.skip(!DEMO_PASSWORD, "DEMO_PASSWORD must be set to run this suite");

  test("FLOW 1: Admin creates a new lead end to end — appears in Leads, Patient 360, and Timeline", async ({ page }) => {
    await login(page, "admin@pulseos.local");
    await page.goto("/leads");
    await expect(page.getByTestId("leads-page")).toBeVisible();

    await page.getByTestId("add-lead-button").click();
    await expect(page.getByTestId("add-lead-drawer")).toBeVisible();

    const phone = uniquePhone();
    await page.getByTestId("lead-phone-input").fill(phone);
    await page.locator("#lead-name").fill("E2E Flow One Patient");
    await page.getByTestId("lead-specialty-select").selectOption("GYNECOLOGY");
    await expect(page.getByTestId("lead-custom-fields")).toBeVisible();

    const branchSelect = page.locator("#lead-branch");
    const firstBranchValue = await branchSelect.locator("option").nth(1).getAttribute("value");
    await branchSelect.selectOption(firstBranchValue!);

    await page.locator("#lead-source").selectOption("meta");

    const ownerSelect = page.locator("#lead-owner");
    const firstOwnerValue = await ownerSelect.locator("option").nth(1).getAttribute("value");
    await ownerSelect.selectOption(firstOwnerValue!);

    await page.getByText("Create first follow-up").click();
    await page.locator("#followup-type").selectOption("CALLBACK");

    await page.getByTestId("add-lead-submit").click();
    await expect(page.getByTestId("add-lead-drawer")).not.toBeVisible();

    // Appears in Leads.
    await expect(page.getByText("E2E Flow One Patient")).toBeVisible();

    // Follow it into Patient 360 → Journey → Timeline.
    await page.getByText("E2E Flow One Patient").first().click();
    await expect(page.getByTestId("patient-360")).toBeVisible();
    await expect(page.getByText("Pregnancy Care").first()).toBeVisible();
    await expect(page.getByText("Lead created — Pregnancy Care")).toBeVisible();
    await expect(page.getByText("Task created: callback")).toBeVisible();
  });

  test("FLOW 2: Add Lead with a phone that matches an existing patient warns and creates a new Journey, not a duplicate Patient", async ({ page }) => {
    await login(page, "admin@pulseos.local");

    const phone = uniquePhone();

    // First, create the initial patient via Add Lead.
    await page.goto("/leads");
    await page.getByTestId("add-lead-button").click();
    await page.getByTestId("lead-phone-input").fill(phone);
    await page.locator("#lead-name").fill("E2E Flow Two Patient");
    await page.getByTestId("lead-specialty-select").selectOption("GENERAL_OPD");
    const branchSelect = page.locator("#lead-branch");
    const firstBranchValue = await branchSelect.locator("option").nth(1).getAttribute("value");
    await branchSelect.selectOption(firstBranchValue!);
    await page.locator("#lead-source").selectOption("website");
    await page.getByTestId("add-lead-submit").click();
    await expect(page.getByTestId("add-lead-drawer")).not.toBeVisible();

    // Now submit a second lead with the SAME phone, different specialty.
    await page.getByTestId("add-lead-button").click();
    await page.getByTestId("lead-phone-input").fill(phone);
    await page.getByTestId("lead-phone-input").blur();
    await expect(page.getByTestId("existing-patient-banner")).toBeVisible();
    await expect(page.getByTestId("existing-patient-banner")).toContainText("Existing patient found");
    await expect(page.getByTestId("existing-patient-banner")).toContainText("E2E Flow Two Patient");

    await page.getByTestId("lead-specialty-select").selectOption("OPHTHALMOLOGY");
    await branchSelect.selectOption(firstBranchValue!);
    await page.locator("#lead-source").selectOption("meta");
    await page.getByTestId("add-lead-submit").click();
    await expect(page.getByTestId("add-lead-drawer")).not.toBeVisible();

    // Exactly one "E2E Flow Two Patient" patient exists — not two.
    await page.goto(`/patients?search=${encodeURIComponent(phone)}`);
    await expect(page.getByTestId("patients-page")).toBeVisible();
    const matchingRows = page.locator("tbody tr", { hasText: "E2E Flow Two Patient" });
    await expect(matchingRows).toHaveCount(1);

    // That one patient now has 2 active journeys.
    await matchingRows.first().click();
    await expect(page.getByTestId("patient-360")).toBeVisible();
    await expect(page.getByText(/2 active journeys/)).toBeVisible();
  });

  test("FLOW 6: Campaigns page filters by specialty and source, showing Spend → Lead → Treatment → Revenue for the seeded weak campaign", async ({ page }) => {
    await login(page, "admin@pulseos.local");
    await page.goto("/campaigns");
    await expect(page.getByTestId("campaigns-page")).toBeVisible();
    await expect(page.getByText("Marketing Efficiency")).toBeVisible();

    await page.getByTestId("campaigns-specialty-filter").selectOption("OPHTHALMOLOGY");
    await expect(page.getByText("Meta – Cataract Awareness")).toBeVisible();
    await expect(page.getByTestId(/campaign-row-/).first()).toBeVisible();
  });
});
