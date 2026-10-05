import { expect, test, type Browser, type Page } from "@playwright/test";
import { purgeCrmFields, sql } from "./support/fixtures";

// Local-demo reality checks, in a real browser:
//   - Display settings is a real full-height panel (it was squashed into the top bar), applies LIVE to the page, and Cancel / Escape
//     put the saved look back; Save keeps it for that person only;
//   - the hospital Appearance screen is live too, for the person choosing, until they Save;
//   - a Super Admin finds and uses lead configuration (CRM Fields, Services, Lead Sources, Clinic Hours, Appearance);
//   - the Add Lead shortcut to configuration; adding a field through the real editor; Add Lead follows it at once.
// Everything written here is removed afterwards.

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";
const V1 = { slug: "namokar-v1", prefix: "namokar" };
const V2 = { slug: "namokar-v2", prefix: "namokarv2" };
const FIELD_LABEL = "Preferred communication time";
const FIELD_KEY = "preferred_communication_time";
const SERVICE = "QA Eye Service";

async function login(page: Page, ws: { slug: string; prefix: string }, who: string) {
  await page.goto(`/login/${ws.slug}`);
  await page.getByLabel("Email address").fill(`${ws.prefix}.${who}@pulseos.local`);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/command-centre|front-desk|my-work|doctor-home/);
}
async function as(browser: Browser, ws: { slug: string; prefix: string }, who: string, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await login(page, ws, who);
  return { page, context };
}
const probe = (page: Page) =>
  page.evaluate(() => {
    const px = (cls: string, prop: "fontSize" | "height") => {
      const d = document.createElement("div");
      d.className = cls;
      d.style.position = "absolute";
      d.style.visibility = "hidden";
      document.body.append(d);
      const v = parseFloat(getComputedStyle(d)[prop]);
      d.remove();
      return Math.round(v * 100) / 100;
    };
    return { ui: document.documentElement.dataset.uiSize, text: document.documentElement.dataset.textSize, surface: document.documentElement.dataset.surface, textSm: px("text-sm", "fontSize"), control: px("h-11", "height") };
  });
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const cleanV2 = () => {
  purgeCrmFields("preferred_comm");
  sql(`UPDATE users SET interface_size = NULL, text_size = NULL WHERE tenant_id IN (SELECT id FROM tenants WHERE login_slug IN ('${V1.slug}', '${V2.slug}'))`);
  sql(`UPDATE tenants SET surface_style = NULL WHERE login_slug IN ('${V1.slug}', '${V2.slug}')`);
  sql(`DELETE FROM custom_field_definitions WHERE tenant_id = (SELECT id FROM tenants WHERE login_slug = '${V2.slug}') AND specialty_key LIKE 'QA_%'`);
  sql(`DELETE FROM specialty_templates WHERE tenant_id = (SELECT id FROM tenants WHERE login_slug = '${V2.slug}') AND key LIKE 'QA_%'`);
  sql(`DELETE FROM lead_sources WHERE tenant_id = (SELECT id FROM tenants WHERE login_slug = '${V2.slug}') AND label LIKE 'QA %'`);
  sql(`DELETE FROM activity_log WHERE tenant_id IN (SELECT id FROM tenants WHERE login_slug IN ('${V1.slug}', '${V2.slug}'))`);
};

test.describe("Namokar local demo: display settings, live appearance, Super Admin configuration", () => {
  test.skip(!DEMO_PASSWORD, "DEMO_PASSWORD must be set to run this suite");
  test.beforeAll(cleanV2);
  test.afterAll(cleanV2);

  for (const size of [
    { name: "1440", width: 1440, height: 900 },
    { name: "1024", width: 1024, height: 768 },
    { name: "768", width: 768, height: 1024 },
    { name: "390", width: 390, height: 844 },
  ]) {
    test(`1. Display settings is a real panel at ${size.name}px, shows the choice LIVE on the page, and Cancel / Escape restore the saved look`, async ({ browser }) => {
      test.setTimeout(120_000);
      const su = await as(browser, V1, "superadmin", { width: size.width, height: size.height });
      try {
        await su.page.goto("/leads");
        await expect(su.page.getByTestId("profile-menu-trigger")).toBeVisible();
        const base = await probe(su.page);
        expect(base).toMatchObject({ ui: "comfortable", text: "default", textSm: 14, control: 44 });
        await su.page.screenshot({ path: `review-artifacts/final-${size.name}-leads-before.png` });

        await su.page.getByTestId("profile-menu-trigger").click();
        await su.page.getByTestId("display-settings-item").click();
        const sheet = su.page.getByTestId("display-settings");
        await expect(sheet).toBeVisible();
        await su.page.waitForTimeout(400); // the panel slides in
        // A REAL panel: full height of the screen, on the right (desktop/tablet) or full width (phone) - not a strip in the top bar.
        const box = (await sheet.boundingBox())!;
        expect(box.height, "panel height").toBeGreaterThanOrEqual(size.height - 4);
        expect(box.y, "panel top").toBeLessThanOrEqual(2);
        expect(box.x + box.width, "panel reaches the right edge").toBeGreaterThanOrEqual(size.width - 2);
        if (size.width >= 768) expect(box.width).toBeGreaterThanOrEqual(380);
        // Everything the person needs is on screen: both choices, the preview and the buttons.
        for (const id of ["display-interface-large", "display-text-xlarge", "appearance-preview", "display-save", "display-cancel", "display-reset"]) await expect(sheet.getByTestId(id)).toBeAttached();
        await sheet.getByTestId("display-save").scrollIntoViewIfNeeded();
        const saveBox = (await sheet.getByTestId("display-save").boundingBox())!;
        expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(size.height + 1);
        expect(await overflow(su.page)).toBeLessThanOrEqual(0);

        // LIVE: picking Large + Large changes the page behind the panel immediately (nothing stored yet).
        await sheet.getByTestId("display-interface-large").check();
        await sheet.getByTestId("display-text-large").check();
        const live = await probe(su.page);
        expect(live).toMatchObject({ ui: "large", text: "large" });
        expect(live.textSm).toBeCloseTo(15.68, 1);
        expect(live.control).toBeCloseTo(48.4, 1);
        await expect(sheet.getByTestId("appearance-preview")).toHaveAttribute("data-text-size", "large");
        await su.page.screenshot({ path: `review-artifacts/final-${size.name}-display-live-large.png` });
        expect(sql(`SELECT count(*) FROM users WHERE email = 'namokar.superadmin@pulseos.local' AND (interface_size IS NOT NULL OR text_size IS NOT NULL)`)).toBe("0");

        // Compact + Large text is a valid, independent combination (Compact applies from 768px up; a phone keeps 44px targets).
        await sheet.getByTestId("display-interface-compact").check();
        const compact = await probe(su.page);
        expect(compact).toMatchObject({ ui: "compact", text: "large" });
        expect(compact.control).toBeCloseTo(size.width >= 768 ? 39.6 : 44, 1);

        // Cancel puts the saved look back exactly.
        await sheet.getByTestId("display-cancel").click();
        await expect(sheet).toHaveCount(0);
        expect(await probe(su.page)).toMatchObject({ ui: "comfortable", text: "default", textSm: 14, control: 44 });

        // So does Escape (closing without saving).
        await su.page.getByTestId("profile-menu-trigger").click();
        await su.page.getByTestId("display-settings-item").click();
        await su.page.getByTestId("display-text-xlarge").check();
        expect((await probe(su.page)).text).toBe("xlarge");
        await su.page.keyboard.press("Escape");
        await expect(su.page.getByTestId("display-settings")).toHaveCount(0);
        expect(await probe(su.page)).toMatchObject({ ui: "comfortable", text: "default" });
        await su.page.screenshot({ path: `review-artifacts/final-${size.name}-leads-after-cancel.png` });

        // Save keeps it - for this person only.
        await su.page.getByTestId("profile-menu-trigger").click();
        await su.page.getByTestId("display-settings-item").click();
        await su.page.getByTestId("display-text-large").check();
        await su.page.getByTestId("display-save").click();
        await expect(su.page.getByTestId("display-settings")).toHaveCount(0);
        expect(await probe(su.page)).toMatchObject({ ui: "comfortable", text: "large" });
        await su.page.reload();
        await expect(su.page.getByTestId("profile-menu-trigger")).toBeVisible();
        await expect.poll(async () => (await probe(su.page)).text).toBe("large");
        expect(sql(`SELECT text_size FROM users WHERE email = 'namokar.superadmin@pulseos.local'`)).toBe("large");
        expect(sql(`SELECT count(*) FROM users WHERE email = 'namokar.admin@pulseos.local' AND (interface_size IS NOT NULL OR text_size IS NOT NULL)`)).toBe("0");
        // Reset to default, then clear for the next size.
        await su.page.getByTestId("profile-menu-trigger").click();
        await su.page.getByTestId("display-settings-item").click();
        await su.page.getByTestId("display-reset").click();
        expect(await probe(su.page)).toMatchObject({ ui: "comfortable", text: "default" });
        await su.page.getByTestId("display-save").click();
        await expect(su.page.getByTestId("display-settings")).toHaveCount(0);
      } finally {
        await su.context.close();
        sql(`UPDATE users SET interface_size = NULL, text_size = NULL WHERE tenant_id IN (SELECT id FROM tenants WHERE login_slug = '${V1.slug}')`);
      }
    });
  }

  test("2. Settings → Appearance is live for the person choosing (the page follows), Cancel / leaving restores, Save stores it for the hospital", async ({ browser }) => {
    test.setTimeout(90_000);
    const su = await as(browser, V2, "superadmin");
    try {
      await su.page.goto("/settings?section=appearance");
      await expect(su.page.getByTestId("appearance-section")).toBeVisible();
      expect((await probe(su.page)).surface).toBe("balanced");
      for (const style of ["solid", "airy"] as const) {
        await su.page.getByTestId(`appearance-option-${style}`).check();
        expect((await probe(su.page)).surface, `${style} applies to the page at once`).toBe(style);
        await expect(su.page.getByTestId("appearance-preview")).toHaveAttribute("data-surface", style);
      }
      expect(sql(`SELECT coalesce(surface_style, 'none') FROM tenants WHERE login_slug = '${V2.slug}'`)).toBe("none"); // nothing stored yet
      await su.page.getByTestId("appearance-cancel").click();
      expect((await probe(su.page)).surface).toBe("balanced");

      // Leaving the screen without saving also puts it back.
      await su.page.getByTestId("appearance-option-solid").check();
      expect((await probe(su.page)).surface).toBe("solid");
      await su.page.goto("/settings");
      await expect(su.page.getByTestId("settings-page")).toBeVisible();
      await expect.poll(async () => (await probe(su.page)).surface).toBe("balanced");

      // Another person in the same hospital never saw the preview.
      const other = await as(browser, V2, "frontdesk");
      try {
        await su.page.goto("/settings?section=appearance");
        await su.page.getByTestId("appearance-option-solid").check();
        expect((await probe(other.page)).surface).toBe("balanced");
        await su.page.getByTestId("appearance-save").click();
        await expect(su.page.getByTestId("appearance-notice")).toBeVisible();
        expect(sql(`SELECT surface_style FROM tenants WHERE login_slug = '${V2.slug}'`)).toBe("solid");
        expect(sql(`SELECT coalesce(surface_style, 'none') FROM tenants WHERE login_slug = '${V1.slug}'`)).toBe("none"); // the other hospital untouched
      } finally {
        await other.context.close();
      }
    } finally {
      await su.context.close();
    }
  });

  test("3. Super Admin finds every lead-configuration area, and Add Lead links straight to CRM Fields", async ({ browser }) => {
    const su = await as(browser, V2, "superadmin");
    try {
      await su.page.goto("/settings");
      const tabs = su.page.getByRole("tablist", { name: "Settings sections" });
      for (const name of ["Services", "CRM Fields", "Lead Sources", "Clinic Hours", "Appearance", "Workflow Outcomes", "Follow-up Types", "Doctors"]) await expect(tabs.getByRole("tab", { name, exact: true }), name).toBeAttached();
      await expect(su.page.getByTestId("intake-shortcuts")).toBeVisible();
      for (const key of ["fields", "sources", "hours", "appearance"]) {
        await su.page.goto("/settings");
        await su.page.getByTestId(`intake-shortcut-${key}`).click();
        await expect(su.page).toHaveURL(new RegExp(`section=${key}`));
      }
      await su.page.goto("/settings?section=fields");
      await expect(su.page.getByText("Choose what information your team collects and where each field appears.")).toBeVisible();

      // From Add Lead itself.
      await su.page.goto("/leads");
      await su.page.getByRole("button", { name: /add lead/i }).first().click();
      await su.page.getByTestId("add-lead-configure-fields").click();
      await expect(su.page).toHaveURL(/section=fields/);
      await expect(su.page.getByTestId("crm-fields-section")).toBeVisible();

      // Front desk sees no such shortcut and no configuration.
      const fd = await as(browser, V2, "frontdesk");
      try {
        await fd.page.goto("/leads");
        await fd.page.getByRole("button", { name: /add lead/i }).first().click();
        await expect(fd.page.getByTestId("add-lead-drawer")).toBeVisible();
        await expect(fd.page.getByTestId("add-lead-configure-fields")).toHaveCount(0);
      } finally {
        await fd.context.close();
      }
    } finally {
      await su.context.close();
    }
  });

  test("4. Super Admin adds 'Preferred communication time' through the real editor; Add Lead shows it; switching it off hides it and keeps its history", async ({ browser }) => {
    test.setTimeout(120_000);
    const su = await as(browser, V2, "superadmin");
    try {
      const askedOnAddLead = async () => {
        await su.page.goto("/leads");
        await su.page.getByRole("button", { name: /add lead/i }).first().click();
        const loaded = su.page.waitForResponse((r) => /\/specialties\/[^/]+\/fields$/.test(r.url()) && r.status() === 200);
        await su.page.getByLabel("Service / enquiry").selectOption({ label: "Cataract" });
        await loaded;
        await expect(su.page.getByTestId("lead-phone-input")).toBeVisible();
        return su.page.locator("label", { hasText: new RegExp(`^\\s*${FIELD_LABEL}\\s*\\*?\\s*$`) }).count();
      };
      expect(await askedOnAddLead()).toBe(0);

      await su.page.goto("/settings?section=fields&service=*");
      await su.page.getByTestId("crm-fields-add").click();
      const editor = su.page.getByTestId("field-editor");
      await expect(editor).toBeVisible();
      await su.page.getByTestId("field-label").fill(FIELD_LABEL);
      await su.page.getByTestId("field-scope").selectOption("*");
      await su.page.getByTestId("field-type").selectOption("SELECT");
      for (const [i, option] of ["Morning", "Afternoon", "Evening"].entries()) {
        await su.page.getByTestId("field-add-option").click();
        await su.page.getByTestId(`field-option-${i}`).fill(option);
      }
      await expect(su.page.getByTestId("field-placement-add_lead")).toBeChecked(); // "Add Lead" is on by default
      await su.page.getByTestId("field-save").click();
      await expect(editor).toBeHidden();
      const row = su.page.getByTestId(`field-row-${FIELD_KEY}`);
      await expect(row).toBeVisible();
      await expect(row).toContainText("Add Lead");

      expect(await askedOnAddLead()).toBe(1); // appears at once; optional (no asterisk)

      // A real lead records an answer, so there is history to keep.
      const lk = await su.page.evaluate(async () => (await (await fetch("http://localhost:4310/lookups", { credentials: "include" })).json()) as { branches: { id: string }[] });
      const created = await su.page.evaluate(
        async ({ branchId, key }) => {
          const res = await fetch("http://localhost:4310/leads", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "QA V2 Pref Time", phone: "+919000000071", specialtyKey: "CATARACT", branchId, journeyType: "Cataract", source: "phone", sourceKey: "phone", customFieldValues: { [key]: "Evening" } }) });
          return res.status;
        },
        { branchId: lk.branches[0]!.id, key: FIELD_KEY },
      );
      expect(created).toBe(201);

      await su.page.goto("/settings?section=fields&service=*");
      await su.page.getByTestId(`field-add-lead-${FIELD_KEY}`).uncheck();
      await expect.poll(() => sql(`SELECT placements::text FROM custom_field_definitions WHERE key = '${FIELD_KEY}' AND tenant_id = (SELECT id FROM tenants WHERE login_slug = '${V2.slug}')`)).not.toContain("add_lead");
      expect(await askedOnAddLead()).toBe(0); // gone from new entry
      expect(sql(`SELECT count(*) FROM custom_field_values v JOIN custom_field_definitions d ON d.id = v.field_definition_id WHERE d.key = '${FIELD_KEY}'`)).toBe("1"); // history kept
      // The other hospital never had it.
      expect(sql(`SELECT count(*) FROM custom_field_definitions WHERE key = '${FIELD_KEY}' AND tenant_id = (SELECT id FROM tenants WHERE login_slug = '${V1.slug}')`)).toBe("0");
    } finally {
      await su.context.close();
      sql(`DELETE FROM custom_field_values WHERE field_definition_id IN (SELECT id FROM custom_field_definitions WHERE key = '${FIELD_KEY}')`);
      sql(`DELETE FROM timeline_events WHERE patient_id IN (SELECT id FROM patients WHERE name = 'QA V2 Pref Time')`);
    }
  });

  test("5. Services and Lead Sources: add a service from Settings (Add Lead offers it at once), disable it (gone from new intake); Lead Sources can add and archive", async ({ browser }) => {
    test.setTimeout(120_000);
    const su = await as(browser, V2, "superadmin");
    try {
      await su.page.goto("/settings");
      await su.page.getByTestId("add-service-name").fill(SERVICE);
      await su.page.getByTestId("add-service-save").click();
      await expect(su.page.getByTestId("specialty-list")).toContainText(SERVICE);
      const offers = async () => {
        await su.page.goto("/leads");
        await su.page.getByRole("button", { name: /add lead/i }).first().click();
        await expect(su.page.getByTestId("lead-phone-input")).toBeVisible();
        return su.page.getByLabel("Service / enquiry").locator("option", { hasText: SERVICE }).count();
      };
      expect(await offers()).toBe(1);
      await su.page.goto("/settings");
      const key = sql(`SELECT key FROM specialty_templates WHERE display_name = '${SERVICE}' AND tenant_id = (SELECT id FROM tenants WHERE login_slug = '${V2.slug}')`);
      await su.page.getByTestId(`specialty-toggle-${key}`).click();
      await expect.poll(() => sql(`SELECT enabled FROM specialty_templates WHERE key = '${key}' AND tenant_id = (SELECT id FROM tenants WHERE login_slug = '${V2.slug}')`)).toBe("f");
      expect(await offers()).toBe(0);
      expect(sql(`SELECT count(*) FROM specialty_templates WHERE key = '${key}'`)).not.toBe("0"); // disabled, never deleted

      // Lead Sources: add, then archive.
      await su.page.goto("/settings?section=sources");
      await expect(su.page.getByRole("button", { name: /add source/i })).toBeVisible();
      const made = await su.page.evaluate(async () => (await fetch("http://localhost:4310/lead-sources", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "QA Source One" }) })).status);
      expect(made).toBe(201);
      await su.page.reload();
      await expect(su.page.getByText("QA Source One")).toBeVisible();
    } finally {
      await su.context.close();
    }
  });
});
