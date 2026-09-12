# PulseOS Prototype Build Ledger (Tasks 5–20)

- **Purpose**: survive context compaction / session restart / subagent failure by recording, after every task, exactly what changed, where, and what was verified.
- **Scope**: Task 5 through Task 20 (the PROTOTYPE CUT LINE). Task 21+ is explicitly out of scope for this loop.
- **Worktrees in use**:
  - Backend: `invictus-chatbot-pulseos-work/` on branch `pulseos/foundation`, rooted at `0e27a1232adeb4d5738b203bed7b58ccfa915608`
  - Frontend: `whatnexus-frontend-pulseos-work/` on branch `pulseos/foundation`, rooted at `c327d1ca20c2edea6d95ac8e16927a091d2cef6d`
- **Demo tenant**: `tenant_id: TT001`, `tenant_user_id: TTU001` (see repo-roots.md — "Demo hospital tenant" section)

## Status legend
`PENDING` → `IN_PROGRESS` → `DONE` (or `BLOCKED` with reason)

## Task Log

| Task | Module | Status | Commit(s) | Notes |
|---|---|---|---|---|
| 5 | M2 | DONE | invictus-chatbot `de103e5` | journey_type/journey_label STRING columns on Lead; TDD test round-tripped against real local DB; test:billing regression clean; full boot sync clean |
| 6 | M2 | DONE | (satisfied by Task 4 `0e27a12`, no new commit) | example journey_type log line + grep-confirmed no ENUM/constraint anywhere |
| 7 | M2 | DONE | whatnexus-frontend `d94b9b6` (+ infra fixes `db184ab`, backend `38832c4`) | nav relabeled "Lead Pool"→"Journeys", group "Contacts & Leads"→"Patients & Journeys"; requiresWhatsApp disabled on Journeys item. **Discovered & fixed 3 blocking pre-existing defects while verifying**: (1) dynamic-nav empty-catalog fallback bug in groupedSidebar.tsx hid the entire static menu for any tenant with no NavigationItems rows — fixed by gating on the raw API payload; (2) Rules-of-Hooks violation in leadsView.tsx (early return between hooks) crashed the page the moment WhatsApp was actually connected — never previously exercised; (3) seeded a mocked `active` WhatsappAccount row for TT001 (explicitly-allowed mock) since several views gate on live WhatsApp status unrelated to their actual function. Verified visually in-browser: full nav renders, Journeys page loads real data (5 existing rows). |
| 8 | M3 | PENDING | | primary_contact_id on Contact |
| 9 | M3 | PENDING | | createJourney service extension |
| 10 | M3 | PENDING | | New Journey UI action |
| 11 | M4 | PENDING | | prototype client-merged Timeline view |
| 12 | M5 | PENDING | | verify is_ai_silenced handoff |
| 13 | M6 | PENDING | | verify scheduled follow-up |
| 14 | M8 | PENDING | | verify stage scope |
| 15 | M10 | PENDING | | verify appointment booking |
| 16 | M10 | PENDING | | journey_id on appointment |
| 17 | M10 | PENDING | | verify outcome recording |
| 18 | M10 | PENDING | | mocked treatment-status chip |
| 19 | M11 | PENDING | | source/journey_type/mocked revenue |
| 20 | — | PENDING | | end-to-end walkthrough — PROTOTYPE CUT LINE |

## Checkpoints

| After Task | Status | Result |
|---|---|---|
| 10 | PENDING | |
| 15 | PENDING | |
| 20 | PENDING | (final prototype review) |

## Review Findings Log

(Populated as tasks complete — issue, severity, resolution.)
