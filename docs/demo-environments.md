# Demo environments

`pnpm db:seed` wipes every tenant and re-creates two fully separate demo tenants:
**PulseOS Gynecology Demo** and **PulseOS Ophthalmology Demo**. Accounts:
`gyn.<role>@pulseos.local` and `eye.<role>@pulseos.local` (`admin`, `doctor`, `doctor2`,
`frontdesk`, `coordinator`), password = local `DEMO_PASSWORD`. With `ENABLE_DEV_LOGIN=true`
the login page's *Development* section picks an environment, then a role.

Layout: `apps/api/src/seed/demo/` — one data file per tenant, row builders in `shared.ts`.
Specialties are plain `SpecialtyTemplate` data (`domain/specialty/*.templates.ts`); no page or
service knows which specialty a tenant runs.

## Seed guarantees

- **Safe to run only on a local PulseOS database** (`seed/safety.ts`): refuses `NODE_ENV=production`,
  a non-local host, or a database not named `pulseos`, `pulseos_<suffix>` (no `prod`/`live`/`staging`).
- **Consistent journeys** (`seed/demo/consistency.ts`): stage must agree with appointment, outcome,
  treatment and contact date; revenue only on COMPLETED treatments. A contradiction aborts the seed.
- **Stable same-day queue** (`seed/demo/demo-clock.ts`): today's appointments are placed relative to a
  clinic-hours "demo now" (real time clamped to 11:00–17:30), so waiting / checked-in / with-doctor /
  completed / upcoming look right whether seeded at 7 am or 9 pm.
- Every missed-call Inbox conversation is backed by a real `calls` row.

## Communication endpoints (limitation)

The Ophthalmology demo has three active Runo phone lines (Main Reception, Cataract Enquiry Line,
Surgery / Procedure Line). Runo's real API does not say which hospital line took a call, so live
inbound webhooks only auto-tag a line when the connector has **exactly one** active endpoint;
with several they stay honestly unresolved (`endpointLabel: null`) — the product never guesses.
The *seeded* fixture calls name their line explicitly because they are hand-written demo data,
not provider events.
