# Namokar V1/V2 workflow patch: what changed

Branch `claude/wonderful-carson-o7jbjk`, six commits on top of `f07addc` (28 files, +1,244 / −55). Local demo only; nothing deployed.
These commits are local: they are not pushed (see "Git" below).

## 1. Log Call can book the appointment in the same save

**API** ([call.service.ts](../../apps/api/src/domain/call/call.service.ts), [call.routes.ts](../../apps/api/src/domain/call/call.routes.ts), types in [packages/types](../../packages/types/src/index.ts))
- `POST /journeys/:id/calls` accepts an optional `appointment { scheduledAt, confirmed?, doctorId?, branchId?, reason? }`.
- One next action only: a callback **or** an appointment. Sending both is refused (400).
- One transaction: call, appointment and their timeline lines are saved together. If the booking is refused, neither is kept.
  - Refusals reuse the booking rules: `appointment_time_in_past`, `outside_clinic_hours` (422), `resource_unavailable` (409), `doctor_not_found` / `branch_not_found` (404).
- Doctor and branch default to the hospital's only one. If there is a choice and none is given: `doctor_required` / `branch_required`.
- `confirmed: true` confirms the visit after the transaction commits. The confirmation and the 1-hour reminder are then planned once. `confirmed: false` leaves it Booked and sends nothing.
- Booking from a call needs the `MANAGE_APPOINTMENTS` permission (403 otherwise).
- A booked visit satisfies an outcome that requires a follow-up, so no extra callback task is created.
- The same idempotency key returns the first call: no second call, visit or message set (tested with two simultaneous submits).
- The result now includes `appointmentId` and `appointmentStatus` (`scheduled` or `confirmed`).

**Web** ([LogCallSheet.tsx](../../apps/web/components/calls/LogCallSheet.tsx), [callForm.ts](../../apps/web/components/calls/callForm.ts))
- New **Next action** control: None / Callback / Book appointment.
- Book appointment reveals date and time, a doctor/branch picker only when there is more than one, the clinic-hours hint, and **Appointment confirmed with patient** (on by default).
- The save button reads "Save call", "Save call & book appointment" or "Save call & confirm appointment".
- Checked in the form before sending: missing date/time, closed day, outside hours, past time. An advisory warning appears if the doctor already has that slot.
- A failed save keeps everything typed and shows the error inline.
- After saving, journeys, leads, tasks, appointments, Front Desk and patients refresh with no page reload.
- An outcome that requires a follow-up pre-selects Callback and disables "None".

**Journey** ([NextActionCard.tsx](../../apps/web/components/followups/NextActionCard.tsx), [progressSteps.ts](../../apps/web/components/journey/progressSteps.ts))
- With no follow-up task but an upcoming visit, Next action reads "Patient visit · date/time" and the status, instead of "No follow-up scheduled".

## 2. CRM Fields: control over Add Lead

The field system already had placements, required, order, archive and conditional rules, and the server already filtered Add Lead by placement. What was added:
- A per-row **On Add Lead** switch in Settings → CRM Fields ([CrmFieldsSection.tsx](../../apps/web/components/settings/CrmFieldsSection.tsx)). It saves at once and Add Lead shows or hides the question on its next open. Hiding never deletes values.
- The list shows the full **Used in** list (no "+2") and a **Filterable** badge.
- The placement label "Follow-up outcome" is now "Call / follow-up".
- A new `TouchCheckbox` in [FormBits.tsx](../../apps/web/components/settings/FormBits.tsx): 44px tap target on a phone, compact on desktop. `CheckRow` uses it too.
- **Namokar V1 and V2 seeds** ([namokar.ts](../../apps/api/src/seed/demo/namokar.ts)): the ophthalmology template's clinical questions are no longer on Add Lead. They stay on the journey and patient record. A hospital can switch any of them back on.

Still not built: a separate placement for Call in Log Call (the existing "Call / follow-up" placement applies to the Log outcome sheet only), and call-specific custom field entry inside Log Call.

## 3. Clinic hours and the Doctor Planner

- **Settings → Clinic Hours** (new tab, [ClinicHoursSection.tsx](../../apps/web/components/settings/ClinicHoursSection.tsx), [clinicHoursForm.ts](../../apps/web/components/settings/clinicHoursForm.ts)): open/closed and times for each weekday. At least one day must be open. It uses the existing `PUT /clinic-hours` (admin only) and refreshes lookups, appointments, Front Desk and slot checks.
- **Doctor Planner** ([DoctorScheduleView.tsx](../../apps/web/components/appointments/DoctorScheduleView.tsx)): added **Choose date**, a "Clinic hours 09:00–16:00" / "Clinic closed this day" line from the tenant's own hours, and the service shown on each row. Previous/Next/Today already existed.
- New helper `clinicHoursOn(hours, date)` in [packages/ui](../../packages/ui/src/clinicHours.ts).
- One source of truth: booking, slot pre-check, the Log Call form and the planner all read the tenant's hours. No hours are hardcoded in the UI.

## 4. V1 / V2 isolation

Configuration is per hospital. Tested: changing V2's Saturday hours or an Add Lead placement does not change V1, and the reverse. Only an administrator may change hours.

## 5. Tests added or changed

| Area | Test |
|---|---|
| API | [call-appointment.integration.test.ts](../../apps/api/src/__tests__/call-appointment.integration.test.ts), 12 tests: callback task; booked vs confirmed; confirmation and 1-hour reminder planned once; no provider means blocked, never sent; timeline events; double submit; refused bookings keep nothing; callback+visit refused; permission; cross-tenant doctor; sole-doctor default |
| API | [tenant-config-propagation.integration.test.ts](../../apps/api/src/__tests__/tenant-config-propagation.integration.test.ts), 3 tests: hours reach lookups, slot-check and booking at once; per-hospital isolation; Add Lead placement on/off |
| Web unit | `callForm` (appointment cases), `clinicHoursForm`, `placementSummary`, and `clinicHoursOn` in ui |
| E2E | [namokar-workflow-closure.spec.ts](../../apps/web/e2e/namokar-workflow-closure.spec.ts): Add Lead switch on/off with V1 unaffected; one-save call + appointment through Journey, Front Desk and Planner; clinic-hours change reaching booking, Log Call and Planner. Cleans up after itself |
| E2E | [namokar-workflow-responsive.spec.ts](../../apps/web/e2e/namokar-workflow-responsive.spec.ts): 1440 / 768 / 390, no sideways scroll, phone tap targets |
| Updated | `calls-m4.spec.ts` follows the new Next action wording |

## 6. Verification

- Lint and typecheck: clean.
- API: 1,438 passed. Web unit: 268. UI unit: 142.
- Full Playwright run on the final code: **403 passed, 2 skipped, 0 failed**.
- An earlier full run found two problems caused by this patch (20px checkboxes failing the 44px phone target rule; a spec expecting the old "Callback needed" text). Both were fixed and the run was repeated.
- Demo data was reseeded afterwards: V1 has its fictional data, V2 has zero rows.

## 7. Git

- Six commits are local on `claude/wonderful-carson-o7jbjk` (`db2d4f8` … `0ff4e45`).
- **Not pushed.** GitHub has two newer commits from another session (`dfd7894`, `0402ba0`: shared UI styling and appearance controls). Merging them needs a fresh check before pushing; no force-push, never `main`.
- This file is also uncommitted.
