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
| F | Website / Meta / Google / GBP adapters ported | not started | — | — | — |
| G | Campaign analytics + conversion feedback | not started | — | — | — |
| H | Specialty Settings completion (reorder/required/options) | not started | — | — | — |
| I | Action/button/dead-control audit | not started | — | — | — |
| J | Shared table system unification | not started | — | — | — |
| K | Navigation hierarchy + Back system | in progress | — | — | — |
| L | Inbox enterprise reconstruction | not started | — | — | — |
| M | Patient 360 / Appointment / Treatment UX | not started | — | — | — |
| N | Command Centre / Leads / Campaigns UI | not started | — | — | — |
| O | Responsive / accessibility / motion | not started | — | — | — |
| P | E2E + screenshot package | not started | — | — | — |
| Q | Final whole-branch review | not started | — | — | — |

## Resume point for the next session

Groups A-C are done, committed (`c0faf9b`, `12fbb38`, `05067f7`, `35bafeb`),
and fully verified (fresh lint/typecheck/test/build, plus a live browser
check of the Integrations page). Groups D-P are **not started** — do not
assume otherwise from anything outside this ledger + `git log` after a
context compaction.

**Suggested next task: Group D (unified acquisition ingestion).** The
building block already exists and is proven —
`connector/patient-identity.service.ts::findOrCreatePatientByPhone` (Group C)
is the canonical phone-based identity resolver; `lead.service.ts::createLead`
and `patient.service.ts::createPatient` currently each re-implement the same
dedupe-then-create logic inline rather than calling into one shared
function. Group D's actual work is consolidating those three (plus, once
Group F ports them, the Website/Meta/Google ingestion paths) onto one
call path, per plan §12 (raw enquiry → normalize → resolve-or-create Patient
→ create/attach Journey → touchpoint → custom fields → assignment →
Timeline → optional Task). Group E (attribution) is a natural follow-on
since `attribution.service.ts::recordTouchpoint` needs to become that one
path's touchpoint-writing step, replacing `lead.service.ts`'s current inline
`touchType: "first_touch"` insert.

**Known issue for Group M (not fixed, out of scope for A-C):** Command
Centre's "Spend At Risk" panel renders amounts with 3 decimal places
(`₹41,333.333` instead of `₹41,333`) — a pre-existing display-formatting
defect, confirmed still present live in the browser during Group C's
verification pass. Same root cause the original audit found on the
Campaigns page.

**Known scope boundary for Group G:** the Campaigns page
(`apps/web/app/(app)/campaigns/page.tsx`) queries through
`campaign.service.ts`'s own `campaignPerformance`, a separate path from
`dashboard.service.ts::getSourcePerformance` (which Group C's connector-mode
badge was wired into, via `SourcePerformanceTable`, used by Command Centre).
The Campaigns page does not yet show connector-mode badges — deliberately
left for Group G rather than expanding Group C's diff into a second,
parallel backend path.

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
