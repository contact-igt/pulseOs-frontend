# PulseOS Workspace — Repository Boundaries

- **Status**: Established by Plan Task 1 (M0)
- **Date**: 2026-09-12
- **Purpose**: record the confirmed, safe repository boundaries for all PulseOS implementation work, and the hazard this record exists to prevent.

## PulseOS workspace repo

- **Path**: `/Users/sushil/Documents/CODE FILES SUSHIL/PulseOS`
- **Created**: this task, via `git init` at this exact path
- **Confirmed toplevel**: `git rev-parse --show-toplevel` run from this path now returns this path itself (verified after `git init`, no longer falls through to `/Users/sushil`)
- **Scope**: holds `docs/superpowers/**` and any future workspace-level (non-application) planning artifacts only
- **`.gitignore`**: excludes `backend/`, `frontend/`, `invictus-chatbot/`, `whatnexus-frontend/`, `node_modules/` — guarantees the four nested project repos can never be accidentally tracked by this workspace-level repo, even via a broad `git add -A`

## Hazard: `/Users/sushil`

`/Users/sushil` (the user's home directory) is itself a pre-existing git repository — remote `origin` = `https://github.com/contact-igt/igt.git`, zero commits, discovered during the PulseOS discovery audit. It is **not** a PulseOS project repository.

**Rule, binding for all future PulseOS work**: no `git add`, `git commit`, `git push`, `git reset`, `git clean`, `git checkout`, or worktree operation for PulseOS work is ever run with cwd at `/Users/sushil` or any path outside the five repositories named in this document (the four project repos, plus this new PulseOS workspace repo). This new workspace repo's creation directly removes the need to ever fall through to `/Users/sushil` for documentation work — verified above.

## The four project repositories

| Repo | Confirmed root (`git rev-parse --show-toplevel`) | Branch | HEAD |
|---|---|---|---|
| Lead Panel backend | `/Users/sushil/Documents/CODE FILES SUSHIL/PulseOS/backend` | `development` | `22b081198f54bb3f3a987b36c5c46dcb1a5175d0` |
| Lead Panel frontend | `/Users/sushil/Documents/CODE FILES SUSHIL/PulseOS/frontend` | `development` | `bf187207fcc1c6cc2dbe65709bd3a4f40a42524d` |
| PulseOS backend (WhatsNexus) | `/Users/sushil/Documents/CODE FILES SUSHIL/PulseOS/invictus-chatbot` | `main` | `19e75667b4060af245739a62bb668d86c6b906a6` |
| PulseOS frontend (WhatsNexus) | `/Users/sushil/Documents/CODE FILES SUSHIL/PulseOS/whatnexus-frontend` | `main` | `88b9dcce74809b41c20a2a2a65608f7dfdb0a1e8` |

Each of the four `git -C <repo> rev-parse --show-toplevel` commands resolves to that repo's own directory, confirming each is genuinely its own independent git repository and none fall through to `/Users/sushil` or to this new workspace repo.

## Pre-existing dirty state (captured before any PulseOS implementation)

All four repos carry pre-existing uncommitted changes from the earlier local-setup session (running `npm approve-scripts` to approve native-module install scripts), predating any PulseOS work:

| Repo | Dirty files | Nature of change |
|---|---|---|
| `backend` | `package.json` | adds an `"allowScripts"` block (`bcrypt@6.0.0`, `fsevents@2.3.3`) |
| `frontend` | `package.json`, `package-lock.json` | adds an `"allowScripts"` block; lockfile has an unrelated transitive dependency removal (`tailwindcss`'s nested `yaml`) |
| `invictus-chatbot` | `package.json` | adds an `"allowScripts"` block (`protobufjs`, `sharp`, `bcrypt`, `ffmpeg-static`, `fsevents`, `msgpackr-extract`) |
| `whatnexus-frontend` | `package.json` | adds an `"allowScripts"` block (`esbuild`, `fsevents`, `sharp`, `tesseract.js`, `unrs-resolver`) |

Full diffs were inspected (`git -C <repo> diff -- package.json package-lock.json`) and confirmed to contain **only** these `allowScripts` additions and the one unrelated lockfile entry noted above — no other content. This record exists so that no future PulseOS commit in `invictus-chatbot` or `whatnexus-frontend` (the two repos PulseOS implementation will touch) can be mistaken for having introduced these changes. Per the plan, isolating these into their own dedicated commits happens in Task 3, not this task — Task 1 only records and protects them; no file has been staged, committed, reset, stashed, or cleaned in any of the four repos by this task.

## Worktree isolation policy

Not yet decided — this is Task 2's scope, not Task 1's. No worktree has been created by this task.
