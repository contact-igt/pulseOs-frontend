# PulseOS — Overnight Full Product Completion Ledger

Plan identity: "PULSEOS — OVERNIGHT FULL PRODUCT COMPLETION MASTER LOOP" (user prompt, 2026-09-21/22).
Autonomous mode: do not stop for normal engineering choices; only stop for sudo/credentials/destructive
actions/major new architecture decisions.

## Canonical state (verified fresh this session, not assumed)

- Worktree: `/Users/sushil/Documents/CODE FILES SUSHIL/PulseOS/.claude/worktrees/pulseos-foundation-convergence`
- Branch: `feature/pulseos-foundation-convergence` (via `.git/worktrees/.../HEAD` → `ref: refs/heads/feature/pulseos-foundation-convergence`)
- HEAD: `f4c6517eb1564bcbd5886093dae37329bf3df59e` (via `.git/refs/heads/feature/pulseos-foundation-convergence`, reflog confirms last commit "fix: address independent review findings (§60)")
- `git` CLI: still blocked, `git status` fails with the unaccepted Xcode license error. User must run `sudo xcodebuild -license` in their own terminal — cannot be run by the assistant. All work below remains uncommitted until then.
- WEB: PID 12064, listening on :3310, `pnpm run dev` from this worktree's `apps/web` (confirmed via prior session's `lsof -p 12064 | grep cwd`).
- API: PID 12062, listening on :4310, same worktree's `apps/api`.
- Uncommitted changes already present at session start (from two prior sessions this same day): the "enterprise-ui-loop" pass (Campaign Detail metric split, Doctor Home empty states, purple-token removal, radial fixes) and this session's own "UI Refinement V2" Command Centre precision pass (see below). None of this is committed — git is blocked.

## IMPORTANT CORRECTION — the §11/§12 "Could not load" screenshot was not a product bug

That screenshot was an artifact of this session's own verification process, not a genuine runtime
failure. Sequence: a browser tab was logged in as `doctor@pulseos.local` to verify the `SegmentedRadial`
container-query fix on Doctor Home; the same tab was then navigated to `/command-centre` (a
Hospital-Admin-only page) without re-authenticating. The API correctly rejected the doctor session's
requests to the admin-only `/dashboard/*` endpoints (403 — visible in the console log captured
immediately after, which was at the time misread as unrelated noise); the frontend correctly rendered
per-panel "Could not load X" messages rather than crashing. This is the graceful-degradation behavior
§30 asks for, working as intended — not a P0 full-stack failure. Logging back in as `admin@pulseos.local`
and reloading Command Centre confirmed all 8 panels render real data with no errors (see UI Refinement V2
screenshots, `review-artifacts/enterprise-ui-refinement-v2/after/02-command-centre-1440.png` etc.).

The one real, narrower question it raises (§12): should a Doctor be able to *navigate* to `/command-centre`
at all via URL, even to hit a graceful per-panel error? Investigated under Phase 1 below.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Recover + protect state | done — see canonical state above |
| 1 | Runtime/full-stack failure recovery | done — reframed per correction above; route-guard finding below |
| 2 | Auth / role / missing fields / schema | in progress |
| 3 | Core functionality workflows | pending |
| 4 | Command Centre precision UI | **done in the immediately preceding pass this session** — see `docs/audits/2026-09-21-pulseos-ui-refinement-v2.md` (3 real defects found+fixed+verified at 1024/1280/1440/768, independent Opus review completed, 4 follow-on findings from that review also fixed, regression test added and proven red→green). Not re-doing this without new evidence, per §36 "do not re-fix geometry already proven correct without evidence." |
| 5 | Product-wide UI/UX refinement | pending |
| 6 | Responsive/accessibility/motion/error states | pending |
| 7 | Performance/security/code efficiency | pending |
| 8 | Full regression/screenshots | partial — full Playwright run already green this session (51 passed, 1 pre-existing skip, 0 failed) after the Command Centre fixes |
| 9 | Final Opus review + fix loop | partial — Command Centre sub-pass already reviewed; full-product review pending |
| 10 | Final audit + runtime handoff | pending |

## Phase 1 finding: Doctor → Command Centre route guard (real bug, fixed)

Root cause: `nav.ts` already deliberately scopes each role's sidebar (`navForRole`) — Doctor only ever
sees Doctor Home/Appointments/Patients/My Work — but nothing enforced that outside the sidebar. A direct
URL, stale bookmark, or back-button navigation could land any role on a page outside its own nav, where
the API correctly 401/403's every per-panel request (proven correct RBAC, not a bug) but the frontend had
no graceful redirect, only the per-panel "Could not load X" messages.

Fix: `apps/web/components/shell/nav.ts` — added `ROLE_HOME` (moved out of `login/page.tsx`, which had its
own local duplicate — now both import the one shared map) and `pathAllowedForRole(role, pathname)`, driven
entirely by the existing `navForRole` data (no separate permission list to maintain). `apps/web/app/(app)/layout.tsx`
now redirects to `ROLE_HOME[role]` and renders nothing while redirecting, so an out-of-scope page's data
hooks never fire. One follow-up regression this surfaced and fixed in the same pass: `/treatment` (a
legacy alias that server-redirects to `/treatments`) was being caught by the new guard's own effect faster
than the page's own redirect could complete, sending users to their role home instead — fixed with an
explicit `ROLE_NEUTRAL_REDIRECT_PATHS` allowlist in `nav.ts` (role-neutral by construction: every role ends
up at the same next page regardless of who followed the old link).

Verified: live re-test (Doctor manually navigating to `/command-centre` now redirects cleanly to
`/doctor-home` with real data, confirmed via screenshot + network trace showing zero admin-dashboard
requests fired). `pnpm --filter web typecheck` clean. Full Playwright suite green after a fresh reseed
(see below).

## Full-suite Playwright flake investigated and characterized (not a regression, not a product bug)

Running the full Playwright suite repeatedly in the same session (as this investigation did, several times
in a row) reliably produces two symptom clusters in `crm-critical-flows.spec.ts` (FLOW 1, FLOW 2) that
disappear after `pnpm db:seed`:
- Immediately after 2+ consecutive full-suite runs without reseeding: `FLOW 1` fails with a strict-mode
  "resolved to 2 elements" (duplicate "E2E Flow One Patient" rows) — expected, since these are write tests
  using a fixed name each run.
- `FLOW 2`'s "existing-patient-banner not found" assertion fails specifically when `crm-critical-flows.spec.ts`
  runs as part of the FULL suite (all ~20 spec files together), but passes reliably (3/3) every time it's
  run in isolation, even immediately after a fresh reseed. The underlying feature (phone lookup on Add
  Lead → "Existing patient found" banner) was independently verified correct by hand, twice, replicating
  the test's exact create-then-immediately-relookup-same-phone sequence (see
  `docs/audits/...` — actually verified live in-session, not written to a separate doc). This is a
  pre-existing test-order sensitivity to something else in the full ~20-file suite, not caused by any file
  touched this session (nav.ts/layout.tsx/SourcePerformanceTable.tsx/primitives.tsx/SegmentedRadial.tsx/
  JourneyHealthRadial.tsx/format.ts have no relationship to Add Lead's phone-lookup code path). The
  project's own prior ledger already documents "shared-DB test-order/repeat-run flakes" as a
  previously-investigated category — this looks like a further instance of the same class, not a new one.
  Not chased further past this point (2 genuine investigation cycles: source read + 2x manual reproduction
  + isolated-vs-full-suite bisection), per this prompt's own §66 debugging-escalation discipline. DB
  reseeded clean at the end of this investigation.

## Phase 2 (auth/role/missing-field audit) — real findings, both fixed

**1. Front Desk and Patient Coordinator had the same nav-vs-permission gap as Doctor, unfixed by the
Doctor-only fix.** `nav.ts`'s `navForRole` only special-cased `DOCTOR` — every other role (Hospital Admin,
Super Admin, Front Desk, Patient Coordinator) got the identical `FULL_NAV`. But the server's own
`ROLE_PERMISSIONS` map (`packages/types/src/index.ts`, mirrored by `requirePermission()` preHandlers on
every API route — verified by reading all of them in `apps/api/src/domain/*/,*.routes.ts`) grants Front
Desk and Coordinator meaningfully narrower access: Front Desk lacks `VIEW_ADMIN_COMMAND_CENTRE`,
`VIEW_TREATMENT`, `VIEW_MARKETING`, `VIEW_INTEGRATIONS`; Coordinator lacks `VIEW_ADMIN_COMMAND_CENTRE`,
`VIEW_MARKETING`, `VIEW_INTEGRATIONS`. Their sidebars linked to all of those anyway — the same "Could not
load X" cascade wrongly diagnosed as a P0 for Doctor earlier in this session, just unfixed for two more
roles.

Fix, systemic rather than three more hand-maintained per-role lists: added an optional `permission` field
to `NavItem`, annotated each `FULL_NAV` entry with the `Permission` its page actually requires (reading
the same `requirePermission()` calls above, not guessing), and `navForRole` now filters `FULL_NAV` through
`hasPermission(role, item.permission)` for every non-Doctor role. `pathAllowedForRole` (and the route guard
built on it) picks this up automatically — no separate guard code needed. Verified programmatically (not
guessed): `navForRole("FRONT_DESK")` now excludes `/command-centre`, `/treatments`, `/campaigns`,
`/integrations`; `navForRole("PATIENT_COORDINATOR")` excludes `/command-centre`, `/campaigns`,
`/integrations` (correctly keeps `/treatments`, since Coordinator does have `VIEW_TREATMENT`).
`apps/web/components/shell/nav.ts`. `pnpm --filter web typecheck` clean.

**2. Specialty custom field *values* had no display surface anywhere in the product — likely the actual
substance behind "a lot of fields are missing."** The write path is solid and was already correctly tested
(Settings → configure field → Add Lead → field appears → value saved → archiving preserves the DB row, no
cascade delete — `specialty-config.integration.test.ts`). But nothing ever read `customFieldValues` back
out for display: grepped `apps/api/src/domain/patient`, `apps/api/src/domain/journey`, and the entire
`apps/web` tree — the only reference anywhere outside the lead-creation write path was the Add Lead form
itself. A hospital admin configuring e.g. Ophthalmology's "Eye Concern" field, filling it in on Add Lead,
then opening that patient's journey, would never see it again anywhere.

Fix: `getPatient360` (`apps/api/src/domain/patient/patient.service.ts`) now joins `customFieldValues` →
`customFieldDefinitions` per journey and returns them on the new `JourneyCardVm.customFields` field
(`packages/types/src/index.ts`) — deliberately NOT filtered to `archived = false`, so a value recorded
while a field was active keeps showing even after Settings later archives that field (archiving retires it
from new Add Lead submissions; it must never erase what was already recorded — this is exactly the
"historical values remain intact" requirement). Patient 360's `JourneyCard` (`apps/web/app/(app)/patients/[patientId]/page.tsx`)
renders them as additional label/value rows, matching the existing Owner/Doctor/Next-action rows exactly.
Extended the existing archiving-preserves-values test with before/after-archive assertions against the
live `/patients/:id/360` response (not just the DB row) — proves the value is actually visible, not merely
un-deleted. Full API suite: 35 files, 225 tests, all green. `pnpm --filter @pulseos/types typecheck`,
`pnpm --filter @pulseos/api typecheck`, `pnpm --filter web typecheck`, full monorepo lint — all clean.

Live browser verification of both fixes (Front Desk/Coordinator sidebar, Patient 360 custom field display)
deferred until the parallel CRM-flake debugging subagent — also using the live dev server — finishes, to
avoid two processes mutating the same shared Postgres at once.

## Phase 2/3 — additional findings (documented, not all fixed yet)

- **Inbox AI-scheduling honesty (§12/§24 requirement): already correct, verified.** `apps/web/app/(app)/inbox/page.tsx:552` shows "Automated replies require the AI runtime to be active" whenever a non-manual mode is selected — no fake autonomous-AI claim anywhere. No fix needed.
- **Settings specialty read/write split: already correct, verified.** `/specialties` (list) is readable by every authenticated role (needed for Add Lead); `/specialties/:key` (detail) and all mutations correctly require `MANAGE_SPECIALTIES` both server-side and in the client's `canManage` gating (`settings/page.tsx`) — the detail expansion is hidden entirely for non-privileged roles rather than shown-then-403ing. No fix needed.
- **Appointment state-machine has no server-side transition-order enforcement (lower-priority finding, not fixed).** `applyAppointmentAction` (`apps/api/src/domain/appointment/appointment.service.ts:170-189`) only blocks acting on an already-`completed`/`cancelled` appointment; it does not verify the requested action is a legal next step from the current status (e.g. a direct API call could jump `requested` → `with_doctor`, skipping confirm/check-in/waiting). The frontend (`AppointmentList.tsx`'s `NEXT_ACTION` map) already only ever exposes the single correct next action per status, so this is not reachable through normal product usage — a defense-in-depth gap for a direct/malicious API caller, not a live bug. Documented, not fixed this pass given the much higher-value items still outstanding.

## Login design recovery — no earlier design found; current matches the written approved spec

Searched every accessible source of evidence for a "prior preferred" login: `review-artifacts/` (7
login screenshots across different folders/sessions), `docs/ui/pulseos-visual-reference-notes.md`, and
`git` history (still blocked). All 7 screenshots show the identical current design — they're overwritten
by every Playwright run that captures them, so file timestamps don't indicate design age, and none differs
in content. The visual-reference-notes doc (written 2026-09-13, the actual source-of-truth spec, not a
memory) describes the login exactly as it currently exists: split ~62/38, deep-blue left brand canvas with
wordmark/headline/Acquire-Convert-Grow/stats row, white right auth panel — matching word-for-word. Measured
live: input heights 42px, button 40px, both inside the specified 40–44px target. Conclusion: no differing
"earlier preferred" design exists in any accessible evidence: what's live now already matches the written
spec precisely. Did not change the login layout/direction — changing a page that already matches its own
written spec, based on an unconfirmable memory with zero supporting evidence, would be the wrong call.
Flagged for Brain review in case there's a specific prior screenshot/session outside this worktree's own
history that can be pointed to directly.

## Dev Login — implemented with TDD, verified live

Backend: `apps/api/src/domain/auth/auth.service.ts` — extracted session creation (previously only inside
`loginWithPassword`) into a shared `createSessionFor`, added `loginByRole(db, role)` which reuses it (no
parallel/weaker auth path for the dev convenience). `apps/api/src/domain/auth/auth.routes.ts` — new
`GET /auth/dev-login/roles` and `POST /auth/dev-login` routes, registered conditionally at `buildApp()`
time behind `devLoginEnabled()` = `NODE_ENV !== "production" && ENABLE_DEV_LOGIN === "true"` — so in
production, or with the flag off, the routes don't exist (404), not merely permission-gated. Only the 4
roles with an actual seeded demo account are offered (no seeded `SUPER_ADMIN`).

Tests written first (`apps/api/src/__tests__/dev-login.integration.test.ts`, 9 cases): confirmed RED (6
failing) before implementation, GREEN after. Covers: routes absent with flag off; routes absent in
production even with the flag on; role list correct; all 4 roles produce a real, normal session cookie
that `/auth/session` accepts; a valid-but-unseeded role (`SUPER_ADMIN`) is rejected (404, not a crash); an
invalid role string is rejected (400). Full API suite: 36 files, 234 tests, all green.

Frontend: `apps/web/app/login/page.tsx` — a quiet, collapsed-by-default "Development" section below the
real Sign In button (never a competing CTA), fetches `/auth/dev-login/roles` on mount and renders nothing
at all if that 404s (not an empty placeholder) — so the entire block is structurally absent in production,
matching the backend's own absence rather than a client-side flag that could drift from it. Expanding shows
a compact 2×2 grid of role buttons; clicking one calls `/auth/dev-login` and redirects via the same
`ROLE_HOME` map real login uses. `packages/api-client/src/index.ts` — added `devLoginRoles`/`devLogin`.
`.env.example` and local `.env` updated with `ENABLE_DEV_LOGIN=true` (local dev only).

Verified live end-to-end in the browser (not just tests): expanded the Development section, clicked "Front
Desk", landed on `/front-desk` logged in as the real seeded Kavya Menon account — and confirmed in the same
pass that the sidebar correctly excludes Command Centre/Treatments/Campaigns/Integrations, re-confirming
the earlier nav-permission fix live for the first time (deferred until now to avoid colliding with the
CRM-flake debugging subagent's concurrent use of the dev server). `pnpm --filter web/@pulseos/api-client
typecheck` clean.

**Note on the still-running debugging subagent**: a targeted Playwright rerun (`role-routing.spec.ts`)
showed one test fail with `ENOENT` on a trace file — not a real assertion failure, a file-I/O collision
from the CRM-flake subagent's own concurrent Playwright run writing to the same `test-results/` directory.
Reran that one test in isolation: passes cleanly. Holding off on any further full-suite runs until that
subagent finishes, to avoid more of these false signals.

## Phase 2 fully closed out — live role-matrix + custom-field verification

All 4 roles verified via **direct API calls bypassing the UI entirely** (not nav-hiding — genuine
server-side enforcement): logged in as each role via Dev Login, then called forbidden endpoints directly.
Doctor: 403 on `/dashboard/today` and `/connectors`, 200 on its own `/dashboard/doctor`. Front Desk: 403 on
`/dashboard/today`, `/treatments`, `/campaigns/performance`, `/connectors`. Coordinator: 403 on
`/dashboard/today`/`/connectors`, 200 on `/treatments` (correctly retained — Coordinator does hold
`VIEW_TREATMENT`). Admin: 200 on everything. Custom-field display verified live against real seeded data
(not test-created): Anjali Verma's Pregnancy Care journey shows "Pregnancy status: Yes" / "Gestational
week: 24" as compact label/value rows in Patient 360, exactly matching the existing Owner/Doctor/Next
action row style. Phase 2: done.

## P1 — Appointment state machine: real gap found and fixed with TDD

`applyAppointmentAction` (`apps/api/src/domain/appointment/appointment.service.ts`) previously only
blocked acting on an already-closed (completed/cancelled) appointment — it never checked that the
requested action was a legal NEXT step from the CURRENT status. The frontend already only ever exposes the
correct single next action (`AppointmentList.tsx`'s `NEXT_ACTION` map, `AppointmentDrawer.tsx`'s
`CAN_NO_SHOW`/`CAN_CANCEL` sets), so this was never reachable through the UI, but a direct API call could
skip check-in/waiting entirely or move backward in the flow. (`completeAppointment`, the separate endpoint
for reaching `completed`, was already correctly guarded to only fire from `with_doctor` — no gap there.)

Fix: read the EXACT canonical graph off the frontend's own already-shipped encoding (not invented) and
added `VALID_FROM_STATUSES: Record<AppointmentAction, AppointmentStatus[]>` + a check in
`applyAppointmentAction`, returning `invalid_transition` (409) — no DB mutation, no Timeline event — on an
illegal transition. TDD: `apps/api/src/__tests__/appointment-transitions.integration.test.ts` (8 cases),
confirmed RED (6 failing) before the fix, GREEN after.

This surfaced a genuine pre-existing test-fixture bug in `appointments.integration.test.ts`: two tests used
a `findOpenAppointments()` helper that grabbed ANY seeded appointment not in {completed, cancelled,
with_doctor} — fine when no ordering was enforced, but once real validation exists, a helper-picked row
could already be `confirmed`/`checked_in` rather than the `scheduled` state those tests' own linear
sequences assumed, correctly failing their very first transition. Fixed by replacing it with
`freshScheduledAppointment()` (creates its own lead + appointment, guaranteed `scheduled`) — exactly the
"tests own deterministic data, not seed-state assumptions" principle applied a second time this session.
Full API suite: 37 files, 242 tests, all green.

## Treatment state machine — audited, already fully correct, no fix needed

`updateTreatmentStatus` (`apps/api/src/domain/treatment/treatment.service.ts`) already has an explicit
`VALID_TRANSITIONS` graph (ADVISED→{DECISION_PENDING,ACCEPTED,DECLINED,CANCELLED}, DECISION_PENDING→
{ACCEPTED,DECLINED,CANCELLED}, ACCEPTED→{SCHEDULED,CANCELLED}, SCHEDULED→{COMPLETED,CANCELLED}, all
terminal states →{}), rejects illegal transitions with `invalid_transition`, and correctly fires every
required completion side-effect on COMPLETED (post-care task +1 day, recall task +7 days, conversion-
feedback event) and on ACCEPTED (journey stage → `treatment_advised`, a treatment-decision follow-up task).
Already tested (`treatments.integration.test.ts` exercises both a valid and a rejected-invalid transition
in the same test, plus `post-care.integration.test.ts` and `conversion-feedback-treatment-trigger.integration.test.ts`).
No changes made — re-fixing something already correct would just be manufactured work.

## CRM test-isolation flake — genuinely fixed, not just characterized

The dedicated debugging subagent (dispatched earlier, `a6b1c06ca81a0e07c`) stalled after 600s with no
resolution — but it had already applied a real, correct fix to `apps/web/e2e/crm-critical-flows.spec.ts`
before stalling (confirmed via file mtimes: only that one file touched, at 08:25, well before it hung), and
its final message fragment named the right root cause. Verified its diagnosis and fix independently rather
than trusting it blindly:
- Root cause #1 (confirmed real): FLOW 1/2 used fixed literal patient names ("E2E Flow One/Two Patient")
  across every run against a DB that's never cleared except by `pnpm db:seed` — classic "record-count
  assumption" the master prompt's own §52 warned about. Its fix makes the name unique per run
  (`` `E2E Flow One Patient ${phone}` ``), removing the ambiguity entirely regardless of how many prior
  runs left rows behind.
- Root cause #2 (confirmed real, verified against actual source): FLOW 2's final assertion navigated to
  `/patients?search=...`, but `patients/page.tsx` reads `searchParams.get("q")`, not `search` — the filter
  was silently a no-op, so the "exactly 1 matching row" assertion was actually counting every patient in
  the whole demo hospital. Fixed to `?q=`.
- Applying my own nav-permission fix (see above, session-earlier) surfaced ONE further real issue the agent
  hadn't reached: `connector-checkpoint.spec.ts` stayed logged in as `coordinator` (from an earlier step in
  the same test) when screenshotting `/integrations` at tablet width — Coordinator never actually had
  `VIEW_INTEGRATIONS` (unchanged permission matrix), the test just silently worked before because nothing
  enforced the boundary. Fixed by re-logging in as admin for that one screenshot, matching what the page
  actually requires, rather than weakening either the guard or the assertion.

**Verified properly, not just "passes once":** reseeded once, ran the full suite (55 passed, 1 skipped, 0
failed), then ran it again immediately with **no reseed in between** — also 55/55/0. Genuine back-to-back
repeatability from a single seed, which is what was actually being asked for. Reseeded once more afterward
to leave a clean handoff state.

## Resume point

If context compacts, resume from this file + `git`/filesystem/test state, not conversation memory.
Currently resuming into: Phase 2 (auth/role/missing-fields audit), then Phase 3 (core functionality
workflows). Command Centre precision pass (Phase 4) is already done — see
`docs/audits/2026-09-21-pulseos-ui-refinement-v2.md`. DB was freshly reseeded as the last action before
this resume point — anyone continuing should be aware repeated full-suite Playwright runs will need another
reseed before trusting `crm-critical-flows.spec.ts` results (see flake note above).

## 2026-09-30 — Stabilization + view-system completion loop

**Auth gate (c6727fb) — PASSED.** Login 500 was migration 0016 (`tenants.timezone`) not applied to
`pulseos_dev`; logout 400 was the shared api-client sending `content-type: application/json` on bodyless
POSTs (`FST_ERR_CTP_EMPTY_JSON_BODY`) — fixed in the helper (+204/empty-200 handling, 9 unit tests).
Central Fastify error handler: 5xx bodies are generic (`internal_error`), full error logged server-side
only. Auth session lifecycle integration suite (14) + live auth e2e (4) incl. no-overlay checks.

**V0 shared view primitives (5e1a444)** — recovered, verified (packages/ui 63/63), temporary
`/view-primitives-demo` route removed. ViewSwitcher, CalendarView (day/week/month + agenda), KanbanBoard,
GanttTimeline, tenant-timezone `dates.ts`, `useViewState` (URL state). Controller-owned.

**Analytics (65da880)** — Agent G failed twice on infrastructure; controller finished it directly per the
failure policy. Verified: analytics API 45/45 (incl. timezone boundary suite), web unit 11/11, e2e
analytics + auth 11/11. KPIs reconcile to underlying rows. Fix added by controller: Enquiry trend showed
today's in-progress day as a plunge to 0 → `period.today` added to the API period; the running bucket is
drawn as a dashed open segment with a hollow point, tooltip note and footnote.
Sankey decision: REJECTED — journeys store only the current stage (no stage-transition history), so any
flow diagram would invent paths. Journey tab uses furthest-stage outcome bars by source/service instead.

**Page views** — P1 (Appointments / Doctor Home / Front Desk), P2 (Leads read-only board / My Work /
Patient 360 Upcoming), P3 (Treatments pipeline + procedure calendar / Campaigns calendar + timeline)
launched in parallel with strict file ownership; agents do not write to git; controller integrates.

### Resume point (2026-09-30)
If context compacts: check `git log` (latest controller commits above), then collect P1/P2/P3 reports,
integration-gate them, then reviewers R1–R7, full gate (lint/typecheck/test/build, full Playwright twice
without reseed, final clean reseed), Opus review, final report.

### 2026-09-30 / 10-01 — page views, reviewers, final gate (supersedes the resume point above)

**Page views (f04f2f5 + 370dbb2 + f1e956c + f41c74e).** P1/P2/P3 delivered Appointments (List/Day/Week/
Month/Doctors), Doctor Home (Overview/Schedule), Front Desk (Queue/Today flow), Leads (Table / READ-ONLY
board — no stage-mutation endpoint exists), My Work (List/Board/Calendar; moves map only to real
reschedule/complete), Patient 360 (Timeline/Upcoming), Treatments (Table / Pipeline via the server's
transition endpoint / Procedure Calendar) and Campaigns (Table/Calendar/Timeline; null end date = Ongoing).
Controller integration: hospital timezone on the session (`SessionUser.timezone`) replaces hard-coded
Asia/Kolkata; shared `apps/api/src/lib/hospital-time.ts`; `useViewState` owns Agenda (`cal=agenda`).

**Reviewers R1–R7 (read-only) and Opus final review.** Verified Critical/Important findings fixed:
malformed session cookie 500s every request; Command Centre/Leads/My Work "today" used the API server's
clock zone; sliced analytics dropped spend of campaigns with no enquiries in range; previous-period
comparison counted a half-finished today against full days (now `previousUntil`; future custom ranges 400);
"open day" lost the clicked date; clipped calendar titles; kanban focus/announce; dialog focus trap;
Patient 360 Upcoming never refreshed; failed appointment action discarded typed input; URL writers
overwrote each other and lagged a server round trip (now one `replaceUrlParams` on history.replaceState).
Deferred as Minor (listed in the final report): Drizzle error params in 5xx logs; non-uuid `:id` → 500 on
three routes; chart/Gantt contrast + hard-coded chart hexes; Overdue red-vs-amber; tablet touch targets;
recharts focus stop; cost-per-enquiry denominator; organic folded into "Other"; revenue partial week;
62-day cap on multi-day calendar events; Doctor deep links from Upcoming.

**Test isolation.** API vitest pins TZ=UTC (suite passes under UTC and IST). e2e fixtures are purged by
`e2e/support/fixtures.ts` (views, My Work, Patient 360, Wave 3, CRM flows, connector checkpoint). Two older
screenshot specs asserted the Journey Health radial removed in the 2026-09-29 recomposition; updated to
Service Lines.

**Final gate (fresh evidence).** lint 2/2, typecheck 7/7, tests 717 (api-client 9, design-tokens 6, ui 74,
web 63, api 565), build OK. Full Playwright run A on a fresh seed: 177/178 after the stale-spec fix (1 skipped
by design); run B on the same seed with no reseed: 181 passed, 0 failed, 2 skipped (includes the new
responsive matrix: 11 pages x 5 viewports, no page overflow, no runtime overlay, no console errors).
