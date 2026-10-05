# PulseOS public claims register

What the public site may say, verified against this branch (`integration/pulseos-converged-v1-v2` @ 986d10a) on 2026-10-05.
Sources: `apps/web/components/shell/nav.ts`, `docs/m7-capabilities-integrations.md`, `docs/namokar/NAMOKAR_INTEGRATION_STATUS.md`,
the Settings page sections, `PerformanceView.tsx`, and the API auth/activity-log code.

Classes: **BUILT** · **BUILT BUT REQUIRES PROVIDER** · **PILOT** · **NOT BUILT**.
The site may state BUILT as live, may state PROVIDER items only as "when your provider is connected", and must not state PILOT or NOT BUILT as available.

| Capability | Class | Evidence / allowed wording |
|---|---|---|
| Command Centre / Owner Performance (funnel Enquiry → Procedure, by source, by service, team) | BUILT | `/command-centre`, PerformanceView, JourneyFunnel, SourcePerformanceTable, TeamPanel |
| "Who is enquiring": age group + hospital's filterable fields | BUILT | `Demographics` panel in PerformanceView. Worded as patterns by what the hospital records. No clinical inference |
| Leads (list, stage board, filters, Add Lead) | BUILT | `/leads` |
| Journey as first-class entity with timeline, owner, next action | BUILT | `/journeys`, `/journeys/[id]`, Timeline |
| Log Call (outcome, feedback, next action, inline appointment) | BUILT | `LogCallSheet`, "Save call & confirm appointment" |
| Follow-up tasks with owner, date, time (My Work) | BUILT | `/my-work`, TaskBoard, TaskCalendar |
| Appointments + Front Desk queue (check in → waiting → send to doctor) | BUILT | `/front-desk`, `/appointments`, TodayFlow |
| Doctor planner (time, patient, service, status, waiting) | BUILT | `/doctor-home`, DoctorDaySchedule |
| Treatments (advised → scheduled → completed) | BUILT | `/treatments` |
| Analytics (operations, acquisition, journey) | BUILT | `/analytics` |
| Campaigns / Sources | BUILT (capability-gated per hospital) | `/campaigns`, capability `CAMPAIGNS` |
| Configurable CRM fields (name, required, filterable, used in, show on Add Lead) | BUILT | Settings → CRM fields |
| Services, Lead sources, Clinic hours, Follow-up types, Outcomes | BUILT | Settings sections |
| Appearance (hospital display style) | BUILT | Settings → Appearance |
| Role-based access, server-enforced | BUILT | `ROLE_PERMISSIONS`, nav + API |
| Hospital data separation, tenant derived from session | BUILT | project rule, API |
| Passwords hashed (Argon2id), httpOnly session cookie | BUILT | `auth.service.ts`, cookie tests |
| Activity log of sensitive changes; credentials never shown back | BUILT | `activity_log`, m7 doc |
| Appointment confirmation + 1-hour reminder via WhatsApp | BUILT BUT REQUIRES PROVIDER | Planned/deduplicated in-app; sent only when the hospital connects WhatsApp Business. Say "when your messaging provider is connected" |
| Runo calling: call records, missed-call → callback task, recordings | BUILT BUT REQUIRES PROVIDER | Manual Log Call always works; Runo needs hospital credentials |
| Website "I am interested" intake | BUILT BUT REQUIRES PROVIDER (hospital's website must post) | Protected endpoint |
| Meta / Google Ads reporting | BUILT BUT REQUIRES PROVIDER (read-only) | Provider conversions are never PulseOS outcomes |
| WhatsApp Inbox / conversations | PILOT / capability off by default | Do not advertise as available |
| Conversation Intelligence | PILOT, depends on Inbox | Do not advertise. The site must not say "AI" |
| Revenue / ROAS / ₹ figures | BUILT but off for some tenants | Do not promise ROI or revenue figures |
| CCS IVR | NOT BUILT (blocked on provider docs) | Never name as available |
| SMS notifications | NOT BUILT (no provider) | Never name as available |
| Team live status (on call / available) | NOT BUILT (deferred, no presence signal) | Never name |
| EMR / HMIS integration | NOT BUILT as a connector | Say only "works alongside", "integrate where supported" |
| ABDM, HIPAA, NABH, ISO certification | NOT BUILT / unverified | Never claim |
| Customer counts, conversion %, no-show reduction by PulseOS | NOT AVAILABLE | Never claim. Independent study only, cited |

## Naming rules for the site
- Do not name the pilot hospital. Fictional people, hospital and numbers only; "Illustrative / synthetic demo data" wherever numbers appear.
- Avoid the words: revolutionize, transform, seamless, leverage, cutting-edge, next-generation, AI-powered, empower.
- Integration states shown publicly: **Manual** (always works), **Integration-ready** (connect with your own provider), **Planned** (not built). Never "Connected".
