# PulseOS — Foundation Convergence Ledger

Plan: [2026-09-15-pulseos-foundation-convergence-plan.md](2026-09-15-pulseos-foundation-convergence-plan.md)

Branch: `feature/pulseos-foundation-convergence`, from `worktree-pulseos-visual-reconstruction` @ `9980968`.
Worktree: `.claude/worktrees/pulseos-foundation-convergence`.

## Groups

| Group | Scope | Status | Commit(s) | Tests | Review |
|---|---|---|---|---|---|
| A | Convergence workspace + baseline gate | done | c0faf9b, 12fbb38 | 129/129 pass | self |
| B | Migration/schema reconciliation | in progress | — | — | — |
| C | Phone normalization + connector-mode reconciliation | pending | — | — | — |
| D | Unified acquisition ingestion | pending | — | — | — |
| E | Full attribution reconciliation | pending | — | — | — |
| F | Meta/Google/Website/GBP adapters ported | pending | — | — | — |
| G | Campaign analytics + conversion feedback | pending | — | — | — |
| H | Settings specialty controls completion | pending | — | — | — |
| I | Action/button audit | pending | — | — | — |
| J | Shared table system unification | pending | — | — | — |
| K | Inbox responsive reconstruction | pending | — | — | — |
| L | Patient 360 Timeline visual refinement | pending | — | — | — |
| M | Command Centre / Campaigns enterprise polish | pending | — | — | — |
| N | Responsive / motion / accessibility pass | pending | — | — | — |
| O | Full E2E + screenshot review | pending | — | — | — |
| P | Final code review + verification | pending | — | — | — |

## Rulings

- Attribution model, migration strategy, Exotel/Superfone, `/treatment` redirect, AI
  runtime scope: see plan doc "Key rulings" — carried here as binding for this branch.

## Known blockers

(none yet)

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
