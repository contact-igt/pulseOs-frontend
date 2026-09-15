# PulseOS — Foundation Convergence Ledger

Plan: [2026-09-15-pulseos-foundation-convergence-plan.md](2026-09-15-pulseos-foundation-convergence-plan.md)

Branch: `feature/pulseos-foundation-convergence`, from `worktree-pulseos-visual-reconstruction` @ `9980968`.
Worktree: `.claude/worktrees/pulseos-foundation-convergence`.

## Groups

Renumbered 2026-09-16 to match the "FOUNDATION CONVERGENCE + ENTERPRISE UX
COMPLETION MASTER LOOP" prompt's §48 execution order (adds a dedicated
Back-navigation group, splits UI work by page cluster). A-E are unaffected
(same letters, same scope in both prompts).

| Group | Scope | Status | Commit(s) | Tests | Review |
|---|---|---|---|---|---|
| A | Convergence workspace + baseline gate | done | c0faf9b, 12fbb38 | 129/129 pass | self |
| B | Migration/schema reconciliation | done | 05067f7 | 129/129 pass | self |
| C | Phone normalization + connector-mode reconciliation | done | 35bafeb | 138/138 pass | self, browser-verified |
| D | Unified acquisition ingestion | done | 70a8ce8 | 139/139 pass | self, browser-verified |
| E | Full first/last-touch attribution reconciliation | done | 89ac3a6 | 142/142 pass | self, browser-verified |
| F | Website / Meta / Google / GBP adapters ported | done | f5855f3 | 34/34 files, 202/202 pass | self, browser-verified |
| G | Campaign analytics + conversion feedback + INR fix + date filter + Campaign Detail route | done | d77646e, dd31243, 8596ec0 | 12/12 campaigns.integration + 6/6 UI + full suite green | self, browser-verified |
| H | Specialty Settings completion (reorder/required/options) | not started | — | — | — |
| I | Action/button/dead-control audit | not started | — | — | — |
| J | Shared table system unification | not started | — | — | — |
| K | Navigation hierarchy + Back system | in progress (BackLink primitive done) | 1bbff04 | n/a (no web unit tests) | self, browser-verified |
| L | Inbox enterprise reconstruction | not started | — | — | — |
| M | Patient 360 / Appointment / Treatment UX | not started | — | — | — |
| N | Command Centre / Leads / Campaigns UI | not started | — | — | — |
| O | Responsive / accessibility / motion | not started | — | — | — |
| P | E2E + screenshot package | not started | — | — | — |
| Q | Final whole-branch review | not started | — | — | — |

## Resume point for the next session

Groups A, B, C, D, E, F, G are done and committed (`c0faf9b`, `12fbb38`,
`99476fb`, `05067f7`, `35bafeb`, `06a13fa` [seed fix], `70a8ce8`, `89ac3a6`,
`1bbff04` [Group K start], `f5855f3` [Group F], `d77646e` [Group G part 1:
campaign sync/GBP sync/conversion feedback], `dd31243` [Group G part 2: INR
compact formatting fix + campaign date filter], `8596ec0` [Group G part 3:
Campaign Detail route]). Group K is started (BackLink primitive, wired into
Patient 360 and all 7 of its entry points, plus now Campaign Detail →
Patient 360 as an 8th). Groups H, I, J, L, M, N, O, P, Q are **not started**
— do not assume otherwise from anything outside this ledger + `git log`
after a context compaction.

**What Group F actually built:** all 4 acquisition adapters
(`website-form.service.ts`, `adapters/meta-lead-ads.ts`,
`adapters/google-ads-lead-forms.ts`, `adapters/google-business-profile.ts`)
funnel through the same `lead-ingestion.service.ts::ingestNormalizedLead` →
`resolveOrCreatePatient` + `recordTouchpoint` path — no adapter duplicates
identity/attribution logic. GBP only implements `syncPerformance` (no
`patients`/`journeys` touch by construction — no FK column exists). Verified
live: cross-provider multi-touch (Meta then Google on one journey → first
touch stays Meta, last becomes Google), same-patient repeat-lead dedup,
idempotent duplicate webhook delivery. Also fixed a real bug in passing:
`whatsapp-meta-cloud.ts` was pinned to EOL Graph API `v23.0`; extracted a
shared `meta-webhook.ts` used by both WhatsApp and Meta Lead Ads, now on
`v25.0`.

**What Group G actually built:**
- `campaign-sync.service.ts` / `gbp-performance.service.ts` (adapter-agnostic
  sync orchestration, reused verbatim from the acquisition branch) +
  `POST /connectors/:id/sync-campaigns` / `sync-performance` routes.
- `conversion-feedback.service.ts` — consent-gated (`patients.marketingConsent`,
  checked *before* any write), idempotent per `journeyId:eventType`, wired
  into `treatment.service.ts`'s COMPLETED-status branch so treatment
  completion fires `TREATMENT_COMPLETED` with real attribution context.
- Fixed a real seed.ts FK-ordering bug this session's own work exposed
  (`conversionFeedbackEvents`/`gbpPerformanceMetrics` deletes were missing,
  crashing `db:seed` once those tables had reachable rows).
- Fixed the INR "₹46,666.667" bug: root cause was two local duplicate
  formatters (`SpendAtRisk.tsx`'s `money()`, `KpiStrip.tsx`'s `formatInr()`),
  not the shared `format.ts` (already correct). Added `formatInrCompact` as
  the one shared compact-context formatter; both components + `treatments/page.tsx`
  now use shared formatters, zero local duplicates.
- Added `dateFrom`/`dateTo` to `CampaignFilters`, filtered on
  `campaignTouchpoints.occurredAt` in `campaign.service.ts`, compact From/To
  inputs on the Campaigns filter bar.
- Built `/campaigns/[id]` (Campaign Detail): header + `MetricStrip` (reuses
  `getCampaignPerformance` with a `campaignId` filter) + an
  Attribution/Journeys table (reuses `listJourneys` with a `campaignId`
  filter — no new backend domain). Added `connectorMode` to
  `CampaignPerformanceRow` (same join pattern as `getSourcePerformance`) so
  FIXTURE-mode campaigns never read as LIVE on this page or the Campaigns
  list; exported the existing `ConnectorModeBadge` from
  `SourcePerformanceTable` as the one shared badge instead of a per-page
  duplicate. Campaigns list rows now link into the detail route via
  `withFrom(..., "campaigns")`; detail page's journey rows link into Patient
  360 via `withFrom(..., "campaigns")`; BackLink round-trips correctly
  (verified live in browser).
- **Known pre-existing issue, not caused by this session:** the Spend At
  Risk panel's `SectionHeading` (title + subtitle inline) wraps awkwardly in
  the Campaigns page's narrow right-column layout (`Spend At` / `Risk` split
  across lines, crowding the subtitle). Confirmed live in browser 2026-09-15
  during Group G verification. Not a regression from the `formatInrCompact`
  change (only the number formatting inside that component changed) —
  belongs to the deferred full visual-refinement pass, not this block.

**What actually exists now that F/G build on:**
- `domain/patient/identity.service.ts::resolveOrCreatePatient` — the one
  identity path. Every new ingestion source (Website/Meta/Google) should
  call this, never re-implement dedupe.
- `domain/acquisition/attribution.service.ts::recordTouchpoint` — the one
  touchpoint-writing path (first/last-touch aware). Every new ingestion
  source should call this too, passing a `TouchpointDetails` (medium/utm/
  external ids/click ids — the columns are already on `campaign_touchpoints`
  from Group B, just not populated by anything except manual leads yet).
- `domain/acquisition/attribution.service.ts::resolveCampaign` — find-or-
  create a `MarketingCampaign` by `externalCampaignId`, ready for adapter
  webhooks to call directly.
- `connectors.mode` (FIXTURE/SANDBOX/LIVE) is real and UI-honest (Group C) —
  any newly-ported adapter should default new connectors to `FIXTURE` and
  never claim LIVE without real credentials.

**Suggested next task: Group H (Specialty Settings completion).** Current
inline Settings UI (`apps/web/app/(app)/settings/page.tsx`) already supports
enable/disable specialty, add custom field, archive field. Backend
(`specialtyTemplates`/`customFieldDefinitions` schema +
`specialty.service.ts`) already has `sortOrder`/`required`/`archived`/
`options` columns and `updateCustomField` already persists all of them — the
service layer needs almost no work. Missing: UI for editing display label +
default Journey type on `specialtyTemplates` (needs
`UpdateSpecialtyInput`/`updateSpecialty` to accept `defaultJourneyType`, not
just `displayName`/`enabled`); Required/Optional toggle on existing fields
(currently read-only after creation); up/down reorder controls (swap two
fields' `sortOrder` via existing single-field PATCH, no new endpoint needed);
Select-type `options` editor (create-field form has no options input at
all). `AddLeadDrawer.tsx` already fully honors `required`/`options`/order
from the API with zero form-side changes needed. Do NOT create
`/settings/specialties/[key]` — stay inline, per the standing scope
decision.

**Group K status:** BackLink now has 8 wired entry points (Patient 360's 7
+ Campaign Detail → Patient 360, added in Group G). Campaign Detail itself
now exists (`/campaigns/[id]`, built in Group G) with its own BackLink to
`/campaigns`. Settings/specialty-editor still has no dedicated detail route
(deliberately, per the standing "no `/settings/specialties/[key]` yet"
decision) — Back does not apply there by design, not by omission.

**Group M's INR 3-decimal issue is now FIXED (done in Group G, not held for
Group M).** Root cause: two local duplicate formatters
(`SpendAtRisk.tsx`'s `money()`, `KpiStrip.tsx`'s `formatInr()`), not the
shared `format.ts`. Fixed via new shared `formatInrCompact`; see Group G
section above for detail. Verified live: Campaigns page now shows
`₹1,56,000`/`₹75,000` etc., never a 3-decimal value.

**Group G's connector-mode scope gap is now closed.** The Campaigns page
now shows `ConnectorModeBadge` (same shared component `dashboard.service.ts`
uses for Command Centre) on both the Campaigns list and Campaign Detail —
`campaign.service.ts::getCampaignPerformance` now joins `connectors.mode`
the same way `getSourcePerformance` does.

## Rulings

- Attribution model, migration strategy, Exotel/Superfone, `/treatment` redirect, AI
  runtime scope: see plan doc "Key rulings" — carried here as binding for this branch.

## Group B — what was actually done

Ported the additive acquisition-branch schema into `schema.ts` (no drops, no
renames, no column-type changes): `tenants.default_phone_region`;
`marketing_campaigns.connector_id`/`external_account_id` + a
`(tenant_id, external_campaign_id)` unique index; 14 new nullable columns on
`campaign_touchpoints` (medium/utm_*/external_*/gclid family);
`connectors.mode` (new `connector_mode` enum FIXTURE/SANDBOX/LIVE, default
FIXTURE); `connector_type` gains `ACQUISITION`; `connector_capability` gains
8 acquisition-related values; four new tables
(`conversion_feedback_events`, `gbp_performance_metrics`,
`connector_disposition_mappings`, `connector_config_audit_events`).
Updated `packages/types` (`ConnectorMode`, `ConnectorRow.mode`,
`SourcePerformanceRow.connectorMode`, widened `ConnectorType`/
`ConnectorCapability`), `connector.service.ts` (`toRow` now returns `mode`),
`dashboard.service.ts` (`getSourcePerformance` now joins the owning
connector's mode per campaign), and the Integrations page's
type/icon/label maps (added `ACQUISITION`).

Generated migration `0008_brave_bulldozer.sql` via `drizzle-kit generate` —
pure `CREATE TYPE`/`ALTER TYPE ... ADD VALUE`/`CREATE TABLE`/
`ALTER TABLE ... ADD COLUMN` statements, linear after this branch's `0007`.
Verified by migrating a throwaway clean database
(`createdb pulseos_migration_test` → `db:migrate` → `db:seed` → `dropdb`)
end to end with no errors.

**Known gap, recorded rather than silently patched:** the shared local
`pulseos_dev` database (used by every worktree's `pnpm dev`) already has 13
applied migrations in `drizzle.__drizzle_migrations` — more than any single
branch's own migration folder — meaning a prior session hand-applied a
combination of branches' migrations directly against it outside of git
history. Its actual column/table shape already matches what this branch's
`schema.ts` + migration `0008` produce (verified column-by-column:
`connectors.mode`, `campaign_touchpoints` new columns,
`tenants.default_phone_region`, all four new tables already present). The
full API test suite (129/129) and a browser-verified `pnpm dev` both run
correctly against it as-is. However, `pulseos_dev`'s migration journal does
**not** contain an entry matching this branch's `0008` file (different
filename/hash than whatever combination produced its current state), so
running `pnpm db:migrate` against `pulseos_dev` from this branch **will
currently fail** with "already exists" errors if attempted. This is a
pre-existing operational-ops gap in the shared dev database, not introduced
by this session — recommended follow-up (not done here, out of scope for a
schema-reconciliation checkpoint): rebuild `pulseos_dev` from a clean
`db:migrate`+`db:seed` on this branch once it's the adopted lineage, so the
journal and the branch agree again.

## Known blockers

- See "Group B — what was actually done" above re: `pulseos_dev`'s
  migration journal vs. this branch's `0008` — not a functional blocker
  (server runs fine), but `db:migrate` should not be run against the shared
  dev DB from this branch until reconciled.

## Baseline gate results

Ran 2026-09-15 in `.claude/worktrees/pulseos-foundation-convergence` (fresh `pnpm install`):
- `pnpm lint`: PASS (2/2 tasks, 1 cached).
- `pnpm typecheck`: PASS (7/7 packages, 6 cached).
- `pnpm test`: initially 2 pre-existing failures unrelated to convergence
  (confirmed identical on untouched `pulseos-visual-reconstruction` worktree —
  `encryption.test.ts` missing ambient `CONNECTOR_ENCRYPTION_KEY` under bare
  `vitest run`, `KpiStrip.test.tsx` querying a now-removed nested `<button>`
  after the `MetricStrip` connected-cell refactor). Both fixed (commit
  `12fbb38`). Re-ran fresh after `pnpm db:seed`: **21/21 files, 129/129 tests
  PASS**.
- `pnpm build`: PASS (web + api, 18 routes generated including `/leads`,
  `/campaigns`, `/settings`, `/patients/[patientId]`).
- DB reseeded again after the test run (integration tests mutate shared
  Postgres state; a repeat `pnpm test` run without reseeding shows spurious
  failures on exact-count assertions — this is test-suite behavior, not a
  bug, and is expected of every fresh baseline/verification pass in this
  repo, not just this one).

## Group B — schema reconciliation scoping (found before writing code)

Read both branches' `schema.ts` directly rather than assuming the audit's
"conflict" framing. Actual finding: **the campaign_touchpoints/marketing_campaigns
schema itself has NO real conflict** — acquisition's version is a strict
superset of visual-reconstruction's (14 additional nullable columns on
campaign_touchpoints: medium/utm_*/external_*/gclid family; 2 additional
columns + 1 unique index on marketing_campaigns). Same for `connectors`
(acquisition adds one `mode` enum column) and `connector_type`/
`connector_capability` enums (acquisition adds "ACQUISITION" + 8 capability
values, purely additive). The real conflict the audit flagged is entirely in
the **service layer**: visual-recon's `lead.service.ts` has the only write
site for `campaign_touchpoints` and always writes `touchType: "first_touch"`;
acquisition's `attribution.service.ts` (`recordTouchpoint`/
`getAttributionSummary`) has the correct first-then-last-touch logic already
built and tested. Plan: port `attribution.service.ts` + `touchpoint.ts`
close to verbatim, replace the one call site.

Phone normalization is a **real** conflict, correctly identified by the
audit, but narrower than feared: acquisition's richer `identity/phone.ts`
(libphonenumber-js, E.164, tenant-region-aware) is currently only wired into
the *connector* ingestion path (`patient-identity.service.ts`), not into
acquisition's own manual flows (acquisition branch has no Leads UI at all).
Visual-recon's simpler `patient/phone.ts` (hand-rolled, India-only, bare
10-digit key) has exactly 2 call sites (`lead.service.ts`,
`patient.service.ts`). Ruling: adopt E.164 as canonical for *all* entry
points (manual, website, Meta, Google) — required for Group D's "one
identity resolution path" to be coherent, and the only way a manually-added
patient and a later Meta-sourced touch for the same person actually match.
`tenants.default_phone_region` (text, default `'IN'`) is a new additive
column. Since all current data is fictional demo/seed data (CLAUDE.md
security rule), no backfill migration is written for existing rows — this
is recorded here as a deliberate scope decision for a *pilot-readiness*
follow-up once real tenant data exists, not for this checkpoint.
