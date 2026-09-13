# PulseOS — Project Rules

## Product north star

> **"PulseOS is the Patient Engagement and Revenue Intelligence Operating System for Indian hospitals — connecting every enquiry, conversation, appointment, consultation, treatment and follow-up into one continuous patient journey."**
> Supporting line: **"Know where every patient came from, what happened next, what needs attention, and what revenue was generated."**

PulseOS is the full daily operational loop (enquiry → patient → journey → follow-up → appointment → check-in/waiting → consultation → treatment decision → treatment → post-care → next action) with source/cost/conversion/revenue as a continuous thread through it — not a generic hospital CRM, not an EMR/HIS, and not only a marketing analytics dashboard. Marketing attribution (Spend At Risk, ROAS, source performance) is a first-class layer, not the sole product purpose — see [north-star addendum](docs/superpowers/specs/2026-09-12-pulseos-marketing-journey-northstar.md) for the binding detail (operational loop, dashboard hierarchy, spend-at-risk definition, attribution formulas).

Greenfield India-first Patient Engagement CRM / Hospital Operations Command Centre, built around that north star.
Source of truth: [docs/superpowers/specs/2026-09-12-pulseos-greenfield-foundation-design.md](docs/superpowers/specs/2026-09-12-pulseos-greenfield-foundation-design.md), [north-star addendum](docs/superpowers/specs/2026-09-12-pulseos-marketing-journey-northstar.md), [docs/superpowers/plans/2026-09-12-pulseos-greenfield-foundation-plan.md](docs/superpowers/plans/2026-09-12-pulseos-greenfield-foundation-plan.md), execution amendment in the same `plans/` directory.

## Locked decisions
- `apps/web`/`apps/api` are new — never scaffolded from `whatnexus-frontend`/`invictus-chatbot`/Lead Panel.
- `Journey` is a dedicated first-class entity. Never Lead-as-Journey.
- Patient != Journey. A patient can have multiple concurrent journeys.

## Reference repos (read-only, never a runtime dependency)
`backend`, `frontend` (Lead Panel), `invictus-chatbot`, `whatnexus-frontend` (WhatsNexus), and their `-pulseos-work` variants. Extraction rule: read → identify dependencies → extract smallest useful unit → adapt to PulseOS interfaces → write a failing test first → verify independently. Never import wholesale.

## Stack (locked)
Node 24, pnpm workspaces, Turborepo. Web: Next.js 16 / React 19 / TS strict / App Router / Tailwind CSS 4 / Radix / Lucide / TanStack Query+Table / React Hook Form / Zod / Recharts. API: Fastify 5 / TS strict / modular monolith / Zod / Drizzle ORM / PostgreSQL. Testing: Vitest + Playwright. Auth: Argon2id, httpOnly session cookie, no token in localStorage/sessionStorage.

No MUI. No generic admin template. No decorative animation libraries. No microservices. Shared `packages/*` only when ≥2 real consumers need them.

## Design system
`DESIGN_VARIANCE=7`, `MOTION_INTENSITY=4`, `VISUAL_DENSITY=8` (revised 2026-09-13 UI redesign checkpoint — supersedes the earlier 5/3/7). Tokens live in `packages/design-tokens` (`--color-*` re-declared in `apps/web/app/globals.css` for Tailwind's `@theme`, since Tailwind reads CSS vars, not the TS export — keep both in sync). Palette: strong healthcare blue primary, teal/cyan accent, cool blue-white neutral surfaces (not warm), light blue-gray borders, dark navy/slate type. Semantic: success=teal/green, warning=amber, danger=red — amber/red reserved for operational warnings only, never for active-nav or default UI state. Avoid glassmorphism, gradients, giant KPI cards, decorative motion, brochure layouts, card-grid overload, emoji icons. Shell geometry: sidebar ~220–232px, topbar ~60–64px, content gutter 24px desktop / 16px tablet, card radius 12–14px with a subtle border and minimal/no shadow.

## Domain ownership
PulseOS core owns Patient, Journey, Timeline/TimelineEvent, Task/NextAction, Appointment, MarketingCampaign, CampaignTouchpoint, ConsultationOutcome, TreatmentOpportunity, RevenueEvent, CustomField*, Pipeline/PipelineStage, Consent, AuditEvent. External systems are adapters (`WhatsAppProvider`, `TelephonyProvider`, `AdsProvider`, `LLMProvider`, `StorageProvider`, `HISConnector`) — never `if provider === "runo"` inside domain logic.

## Content wording
Prefer: Patient, Journey, Consultation, Treatment, Next Action, Spend At Risk, Marketing Spend, Attributed Revenue, Cost per Treatment. Avoid "Lead"/"Opportunity" outside technical/admin contexts. Never call recoverable active journeys "Marketing Waste" — that term is reserved for `CONFIRMED MARKETING LEAKAGE` (definitively lost journeys); active-but-stalled journeys are always "Spend At Risk."

## Skills / process references (condensed — do not re-fetch full contents per task)
- Superpowers (github.com/obra/superpowers): TDD, systematic debugging, worktree isolation, subagent-driven development, code review discipline. Not installed as a Claude Code plugin in this environment (no marketplace/skill entry available) — its *process* is followed manually: failing-test-first, isolated worktree per feature, one-hypothesis-at-a-time debugging, independent verification before claiming done.
- Ponytail (github.com/DietrichGebert/ponytail): minimal-code/YAGNI discipline — already reflected in "no shared package until ≥2 consumers" above.
- Emil Kowalski skills, Taste skill, Anthropic frontend-design, Vercel agent-skills: UI motion/taste/React reference — reflected in the Design system section below (functional-only transitions, restrained palette, no decorative charts).

## Process
TDD: failing test → minimal implementation → green → verify → commit. No production code without a failing test first (visual-only CSS/tokens use browser verification instead). Systematic debugging on unexpected failures — reproduce, read the full error, trace the diff, one hypothesis at a time; after 3 failed attempts, stop and reconsider the approach rather than keep patching. No completion claim without fresh evidence (tests, typecheck, lint, build, browser check all run just before claiming done).

## Security
Tenant isolation mandatory — never trust `tenant_id` from a request body, always derive from session. Server-side role/permission enforcement, not UI-only. No secrets committed (`.env` is gitignored; demo password comes from `DEMO_PASSWORD` env var, never hardcoded). Fictional demo data only, never real patient data.

## Local dev
- DB: local Postgres, `apps/api/.env` (copy from `.env.example`) sets `DATABASE_URL` + `DEMO_PASSWORD`.
- `pnpm db:migrate` then `pnpm db:seed` to populate demo data.
- `pnpm dev` runs both apps via Turborepo.
- Demo accounts (password = local `DEMO_PASSWORD` value): `admin@pulseos.local` (Hospital Admin), `doctor@pulseos.local` / `doctor2@pulseos.local` (Doctor), `frontdesk@pulseos.local`, `coordinator@pulseos.local`.
