# PulseOS Marketing → Patient Journey North Star (Addendum)

- **Status**: Binding addendum to [2026-09-12-pulseos-greenfield-foundation-design.md](2026-09-12-pulseos-greenfield-foundation-design.md). Supersedes any prior dashboard/page decision that would make PulseOS read as a generic hospital CRM.
- **Date**: 2026-09-12
- **Scope**: product purpose, dashboard hierarchy, attribution definitions. Does not change the locked architecture decisions (greenfield `apps/web`/`apps/api`, dedicated `Journey` entity) from the base spec.

## Canonical tagline

> **"PulseOS is made for Indian hospitals to cut back your marketing expense."**

## Purpose

PulseOS exists to reduce wasted hospital marketing spend by connecting marketing expenditure to the complete patient journey — not to be patient management software in the abstract. CRM and operational workflows (Patients, Journeys, Timeline, Tasks) exist because they let PulseOS understand what happened *after* marketing generated the patient, closing the loop from spend to revenue.

PulseOS is **not** primarily "patient management software." It is a **marketing-to-patient-journey intelligence platform for Indian hospitals**. It is not a conventional sales CRM and not a full HIS/EMR.

## The four core questions

Every dashboard and flagship screen answers a subset of:

1. **Where did the patient come from?** (source/campaign attribution)
2. **What happened to the patient?** (journey stage, appointment, consultation, treatment progression)
3. **Where did we lose the patient?** (funnel drop-off, spend at risk)
4. **What should the hospital do next?** (action queue, next action)

## System relationship

```
Marketing Spend → Patient → Journey → Appointment → Consultation → Treatment → Revenue
```

## Role value (who contributes what to the same goal)

- **Hospital Admin**: Spend → acquisition → conversion → treatment → revenue → waste/leakage, at a glance.
- **Front Desk**: prevents acquisition spend from being wasted through slow first contact, missed calls/appointments, unrecovered no-shows.
- **Patient Coordinator / Counsellor**: recovers pending treatment decisions, callbacks, follow-ups, high-value opportunities, at-risk journeys.
- **Doctor**: does not see marketing data. Closes the attribution loop by recording operational consultation/treatment outcomes quickly — this is what turns "we spent money and got an enquiry" into "we spent money and got a completed treatment."

## Attribution MVP (explicit, transparent — not multi-touch ML)

Tracked: **first touch**, **last touch**, campaign/source association per Journey (`CampaignTouchpoint`).

Per campaign, computed from persisted data only:

- `Marketing Spend` = `MarketingCampaign.spend_amount`
- `Enquiries` = count of Journeys with a touchpoint on that campaign
- `Appointments` = count of those Journeys with ≥1 Appointment
- `Consultations` = count of those Journeys with a completed Appointment
- `Treatment Advised` = count of those Journeys with a `ConsultationOutcome` of `TREATMENT_ADVISED`
- `Treatment Completed` = count of those Journeys with a `TreatmentOpportunity.status = COMPLETED`
- `Attributed Revenue` = `SUM(RevenueEvent.amount)` for those Journeys

Derived (documented formulas, unit-tested, never estimated in the UI layer):

- `Cost per Enquiry` = `spend / enquiries`
- `Cost per Appointment` = `spend / appointments`
- `Cost per Consultation` = `spend / consultations`
- `Cost per Completed Treatment` = `spend / treatments_completed`
- `ROAS` (marketing efficiency) = `attributed_revenue / spend`

All divisions guard against a zero denominator (return `null`/"—", never `Infinity` or `NaN`, in both the service layer and the UI).

## Spend At Risk vs. Confirmed Marketing Leakage

Two distinct concepts — never conflated:

- **Spend At Risk**: acquisition spend allocated to a **currently recoverable** journey with an operational failure requiring action today (never contacted, overdue first contact, missed follow-up, no-show awaiting recovery, treatment decision awaiting overdue follow-up). This is the prototype's primary focus.
- **Confirmed Marketing Leakage**: acquisition spend linked to a journey **definitively lost** to operational drop-off (e.g., `stage = lost`). Tracked as a concept in the schema/formulas but not a separate dashboard panel in this checkpoint.

**Allocation approximation** (documented, not formal accounting): a Journey's allocated acquisition cost = `campaign.spend_amount / campaign.enquiry_count` (the campaign's average cost-per-enquiry) for the campaign it's attributed to via first-touch `CampaignTouchpoint`. Journeys with no campaign touchpoint (organic/walk-in/referral) are not counted toward spend-at-risk, since there is no spend to protect.

`Total Spend At Risk` = `SUM(allocated acquisition cost)` over Journeys currently in an at-risk category (see admin dashboard panel below). Never call an active, recoverable journey "wasted" or "marketing waste" in copy — the reserved term for that is "Spend At Risk"; "waste" language is reserved for `Confirmed Marketing Leakage` only, and is not surfaced as a labeled panel in this checkpoint.

## Dashboard hierarchy (Admin Command Centre)

In priority order, top to bottom:

1. **Top executive strip**: Marketing Spend, Enquiries/Acquired Journeys, Consultations, Completed Treatments, Attributed Revenue, ROAS, Spend At Risk — compact, not seven giant cards.
2. **Journey funnel** (flagship): Enquiry → Contacted → Appointment Booked → Attended → Consulted → Treatment Advised → Treatment Scheduled → Treatment Completed, with count/conversion/drop-off and, where meaningful, cost-per-stage-outcome. Biggest drop-off highlighted. Stage click drills into filtered Journeys.
3. **Spend At Risk** (signature panel): categories (Uncontacted, Overdue follow-up, No-show recovery, Treatment decision pending, Post-consultation follow-up overdue) each showing journey count + allocated spend + severity/age, plus a total. Category click drills into filtered Journeys.
4. **Source/Campaign performance**: table of Spend, Enquiries, Appointments, Consultations, Treatments, Revenue, ROAS per source/campaign, sortable — deliberately exposes cases like "cheap enquiries but poor treatment conversion" without implying low CPL alone is good.
5. **Action queue**: uncontacted high-intent, overdue callbacks, no-shows needing recovery, treatment decisions pending, overdue post-care — same operational data as before, now framed as what protects the spend above it.
6. **Secondary context** (Team, Branch, Doctor, Patient Flow): still useful, kept below the fold relative to items 1–5.

## Doctor Command Centre (unchanged purpose, reaffirmed)

No marketing spend/ROAS ever shown to a doctor. The doctor's contribution is completing patient-journey outcome data: today's appointments, waiting/checked-in, next patient, consultations awaiting outcome, low-friction outcome actions (Consultation Completed / Treatment Advised / Decision Pending / Follow-up Required / No Treatment Required). Each action writes `ConsultationOutcome` (+ `TreatmentOpportunity`/`Task`/`TimelineEvent` as applicable) — this is the mechanism by which marketing attribution becomes treatment attribution.

## Patient 360 — marketing context

Header carries a compact **Acquisition / Value** context (source, campaign, first touch, attributed acquisition cost, estimated treatment value, attributed revenue when available) alongside the existing clinical-operational context (journey, stage, owner, next action, appointment, doctor, treatment status). Financial context is compact and never dominates the care workflow visually.

## Journeys page — analytics context

Beyond the record table, top context surfaces Active Journeys, Appointments pending, Consultations pending, Treatment decisions pending, Revenue opportunity, and Spend at risk for the currently filtered set — so the page reads as "the operational surface behind the dashboard's numbers," not a disconnected generic table. Filters (source, campaign, branch, doctor, journey type, stage, owner, next-action state, date range) are the same vocabulary the dashboard's drill-down links use, so a dashboard click and a manual filter selection land on the same shape of page.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
