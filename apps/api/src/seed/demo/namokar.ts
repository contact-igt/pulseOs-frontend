import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { followUpTypes, timelineEvents } from "../../db/schema.js";
import { installDepartmentTemplate } from "../../domain/specialty/department.service.js";
import { OPHTHALMOLOGY_TREATMENTS } from "../../domain/specialty/ophthalmology.templates.js";
import { ensureFollowUpTypes } from "../../domain/task/followup-type.service.js";
import { createFollowUp, createTask } from "../../domain/task/task.service.js";
import { assertJourneyConfigsConsistent } from "./consistency.js";
import {
  createDemoBranches,
  createDemoConnectors,
  createDemoPatients,
  createDemoTenant,
  createDemoUsers,
  daysFromNow,
  fixtureIdentifiers,
  journeyIdForPatient,
  seedJourneys,
  type DemoContext,
  type DemoInteraction,
  type DemoJourneyConfig,
} from "./shared.js";

// NAMOKAR EYE & OCULOPLASTY CENTRE - a fictional telecalling / front-desk demo.
//
// Everything is invented: names, numbers and stories. Today's data is RELATIVE to the day the seed runs (journeys
// opened today, a clinic queue with every state, calls from this morning), so the Command Centre, Leads, My Work, Front
// Desk and Appointments all have something real to show at any time. Edition V1 (core CRM + core analytics); Runo and
// WhatsApp notifications run as FIXTURES.

export const NAMOKAR_TENANT_NAME = "Namokar Telecalling Demo";

export const NAMOKAR_PATIENT_NAMES = [
  "Suresh Kulkarni", "Rajan Pillai", "Anjali Deshmukh", "Tanvi Rao", "Mahesh Reddy", "Kamala Bai Jadhav", "Sunita Patil", "Neelam Gupta",
  "Pradeep Joshi", "Farida Shaikh", "Rohit Agarwal", "Lata Pawar", "Deepak Mehta", "Imran Qureshi", "Pooja Naik", "Gauri Kulkarni",
  "Vivek Sharma", "Nikhil Bhosale", "Shilpa Joshi", "Zainab Khan", "Harish Menon", "Rekha Dixit", "Sanjay Rathod", "Madhuri Apte",
  "Prakash Jadhav", "Seema Thakur",
];

const call = (c: Omit<Extract<DemoInteraction, { kind: "call" }>, "kind" | "endpoint">): DemoInteraction => ({ kind: "call", endpoint: "main", ...c });

// Even patient index -> Patient Coordinator (Priya Nambiar); odd -> Front Desk (Rohan Desai). The doctor is named per
// story: "meera" (cataract / laser / general) or "anand" (oculoplasty).
export const NAMOKAR_JOURNEYS: DemoJourneyConfig[] = [
  // A - Cataract. Incoming call -> interested -> booked -> attended -> consultation completed (surgery advised).
  {
    patientIdx: 0, journeyType: "Cataract", specialtyKey: "CATARACT", source: "phone", campaignKey: null, stage: "treatment_advised",
    contactedOffsetDays: 0, createdOffsetDays: 0, createdHour: 8,
    appt: { status: "completed", offsetDays: 0, doctor: "meera", reason: "Cataract consultation" },
    outcome: { value: "TREATMENT_ADVISED", notes: "Cataract surgery advised for the right eye; the patient will discuss it with family." },
    treatment: { definitionKey: "CATARACT_SURGERY", label: "Cataract Surgery — Right Eye", status: "ADVISED", estimatedValue: 42_000 },
    interactions: [call({ direction: "inbound", status: "completed", durationSeconds: 238, daysAgo: 0, hour: 8, minute: 0, agent: "Rohan Desai", summary: "Caller asked about cataract surgery and whether a consultation is needed first.", outcome: "Consultation booked for today." })],
  },
  // Cataract - consultation done earlier, surgery now scheduled.
  {
    patientIdx: 1, journeyType: "Cataract", specialtyKey: "CATARACT", source: "google", campaignKey: null, stage: "scheduled",
    contactedOffsetDays: -6, createdOffsetDays: -6,
    appt: { status: "completed", offsetDays: -3, hour: 11, doctor: "meera", reason: "Cataract consultation" },
    outcome: { value: "TREATMENT_ADVISED", notes: "Surgery advised for the left eye; patient agreed." },
    treatment: { definitionKey: "CATARACT_SURGERY", label: "Cataract Surgery — Left Eye", status: "SCHEDULED", estimatedValue: 42_000, decisionOffsetDays: -2, plannedOffsetDays: 5 },
  },
  // B - LASIK. Instagram enquiry -> outgoing follow-up -> booked -> currently Waiting.
  {
    patientIdx: 2, journeyType: "Laser Vision Correction", specialtyKey: "LASER_VISION_CORRECTION", source: "meta", campaignKey: null, stage: "attended",
    contactedOffsetDays: 0, createdOffsetDays: 0, createdHour: 8,
    appt: { status: "waiting", offsetDays: 0, doctor: "meera", reason: "LASIK screening" },
    interactions: [call({ direction: "outbound", status: "completed", durationSeconds: 192, daysAgo: 0, hour: 8, minute: 20, agent: "Priya Nambiar", summary: "Followed up on the Instagram enquiry; the patient wants to know whether LASIK suits a -5 power.", outcome: "Screening booked for today." })],
  },
  {
    patientIdx: 3, journeyType: "Laser Vision Correction", specialtyKey: "LASER_VISION_CORRECTION", source: "meta", campaignKey: null, stage: "contacted",
    contactedOffsetDays: 0, createdOffsetDays: 0, createdHour: 9,
    interactions: [call({ direction: "inbound", status: "completed", durationSeconds: 156, daysAgo: 0, hour: 9, minute: 40, agent: "Rohan Desai", summary: "Asked about LASIK vs SMILE cost and who is eligible.", outcome: "Screening booking pending." })],
  },
  // E - General eye consultation, walk-in, Checked In.
  {
    patientIdx: 4, journeyType: "General Eye Consultation", specialtyKey: "GENERAL_EYE_CONSULTATION", source: "walk_in", campaignKey: null, stage: "attended",
    contactedOffsetDays: 0, createdOffsetDays: 0, createdHour: 9,
    appt: { status: "checked_in", offsetDays: 0, doctor: "meera", reason: "General eye check-up" },
  },
  // F - Cataract. The patient asked for a callback tomorrow (a Callback task is created below).
  {
    patientIdx: 5, journeyType: "Cataract", specialtyKey: "CATARACT", source: "phone", campaignKey: null, stage: "contacted",
    contactedOffsetDays: 0, createdOffsetDays: 0, createdHour: 9,
    interactions: [call({ direction: "inbound", status: "completed", durationSeconds: 301, daysAgo: 0, hour: 9, minute: 20, agent: "Rohan Desai", summary: "An elderly caller wants a cataract check but asked us to ring tomorrow morning, when her son is home.", outcome: "Callback requested for tomorrow 11:00." })],
  },
  // D - Ptosis (oculoplasty). Booked yesterday, did not show up today (an Appointment Risk follow-up is created below).
  {
    patientIdx: 6, journeyType: "Oculoplasty", specialtyKey: "OCULOPLASTY", source: "meta", campaignKey: null, stage: "booked",
    contactedOffsetDays: -1, createdOffsetDays: -1,
    appt: { status: "no_show", offsetDays: 0, doctor: "anand", reason: "Ptosis consultation" },
    interactions: [call({ direction: "outbound", status: "completed", durationSeconds: 168, daysAgo: 1, hour: 12, minute: 10, agent: "Priya Nambiar", summary: "Drooping upper eyelid enquiry; booked a consultation for this morning.", outcome: "Consultation booked." })],
  },
  // H - Oculoplasty. Consultation completed today, ptosis correction accepted; a Surgery Follow-up is created below.
  {
    patientIdx: 7, journeyType: "Oculoplasty", specialtyKey: "OCULOPLASTY", source: "google", campaignKey: null, stage: "treatment_advised",
    contactedOffsetDays: -3, createdOffsetDays: -3,
    appt: { status: "completed", offsetDays: 0, doctor: "anand", reason: "Oculoplasty consultation" },
    outcome: { value: "TREATMENT_ADVISED", notes: "Ptosis correction advised for the left eyelid; the patient agreed to proceed." },
    treatment: { definitionKey: "PTOSIS_CORRECTION", label: "Ptosis Correction — Left Eyelid", status: "ACCEPTED", estimatedValue: 55_000, decisionOffsetDays: 0 },
    interactions: [call({ direction: "inbound", status: "completed", durationSeconds: 214, daysAgo: 3, hour: 11, minute: 30, agent: "Rohan Desai", summary: "Asked about eyelid surgery for a drooping lid.", outcome: "Consultation booked." })],
  },
  // C - Oculoplasty. Missed IVR call this morning; the callback is due today and nobody has contacted the patient yet.
  {
    patientIdx: 8, journeyType: "Oculoplasty", specialtyKey: "OCULOPLASTY", source: "phone", campaignKey: null, stage: "enquiry",
    contactedOffsetDays: null, createdOffsetDays: 0, createdHour: 10,
    task: { reason: "overdue_callback", dueOffsetDays: 0, type: "CALLBACK", notes: "Missed IVR call at 10:05 about a drooping eyelid - call the patient back and offer a consultation" },
    interactions: [call({ direction: "inbound", status: "missed", durationSeconds: 0, daysAgo: 0, hour: 10, minute: 5, summary: "Missed call to the telecalling line.", outcome: "No answer - callback needed." })],
  },
  // With the doctor right now.
  {
    patientIdx: 9, journeyType: "Cataract", specialtyKey: "CATARACT", source: "google", campaignKey: null, stage: "attended",
    contactedOffsetDays: -2, createdOffsetDays: -2,
    appt: { status: "with_doctor", offsetDays: 0, doctor: "meera", reason: "Cataract consultation" },
  },
  // G - LASIK. Several call attempts, no answer.
  {
    patientIdx: 10, journeyType: "Laser Vision Correction", specialtyKey: "LASER_VISION_CORRECTION", source: "google", campaignKey: null, stage: "enquiry",
    contactedOffsetDays: null, createdOffsetDays: -1, createdHour: 16,
    task: { reason: "missed_follow_up", dueOffsetDays: 0, type: "FOLLOW_UP", notes: "Three attempts, no answer - try WhatsApp or a different time of day" },
    interactions: [
      call({ direction: "outbound", status: "no_answer", durationSeconds: 0, daysAgo: 1, hour: 17, minute: 10, agent: "Priya Nambiar", summary: "No answer.", outcome: "Will retry." }),
      call({ direction: "outbound", status: "no_answer", durationSeconds: 0, daysAgo: 0, hour: 9, minute: 30, agent: "Priya Nambiar", summary: "No answer.", outcome: "Will retry." }),
      call({ direction: "outbound", status: "no_answer", durationSeconds: 0, daysAgo: 0, hour: 11, minute: 15, agent: "Priya Nambiar", summary: "Rang out again.", outcome: "Try WhatsApp." }),
    ],
  },
  // Booked for today, not yet arrived (Confirmed).
  {
    patientIdx: 11, journeyType: "Oculoplasty", specialtyKey: "OCULOPLASTY", source: "google", campaignKey: null, stage: "booked",
    contactedOffsetDays: -1, createdOffsetDays: -1,
    appt: { status: "confirmed", offsetDays: 0, doctor: "anand", reason: "Oculoplasty consultation" },
  },
  {
    patientIdx: 12, journeyType: "Cataract", specialtyKey: "CATARACT", source: "whatsapp", campaignKey: null, stage: "contacted",
    contactedOffsetDays: 0, createdOffsetDays: 0, createdHour: 10,
    interactions: [call({ direction: "outbound", status: "completed", durationSeconds: 205, daysAgo: 0, hour: 10, minute: 40, agent: "Priya Nambiar", summary: "Replied to the WhatsApp enquiry by phone; wants to bring a family member.", outcome: "Will confirm a slot." })],
  },
  {
    patientIdx: 13, journeyType: "Laser Vision Correction", specialtyKey: "LASER_VISION_CORRECTION", source: "google", campaignKey: null, stage: "booked",
    contactedOffsetDays: -2, createdOffsetDays: -2,
    appt: { status: "confirmed", offsetDays: 0, doctor: "meera", reason: "LASIK screening" },
  },
  // A new enquiry nobody has contacted yet.
  {
    patientIdx: 14, journeyType: "Oculoplasty", specialtyKey: "OCULOPLASTY", source: "meta", campaignKey: null, stage: "enquiry",
    contactedOffsetDays: null, createdOffsetDays: 0, createdHour: 10,
  },
  // Treatment decision pending: counselling call due today.
  {
    patientIdx: 15, journeyType: "Laser Vision Correction", specialtyKey: "LASER_VISION_CORRECTION", source: "google", campaignKey: null, stage: "treatment_advised",
    contactedOffsetDays: -9, createdOffsetDays: -9,
    appt: { status: "completed", offsetDays: -5, hour: 12, doctor: "meera", reason: "LASIK screening" },
    outcome: { value: "TREATMENT_ADVISED", notes: "LASIK advised; the patient is comparing it with SMILE." },
    treatment: { definitionKey: "LASIK", status: "DECISION_PENDING", estimatedValue: 90_000, decisionOffsetDays: 2 },
    task: { reason: "treatment_decision_pending", dueOffsetDays: 0, notes: "Call to help compare LASIK and SMILE (cost and recovery) and note the patient's preference" },
  },
  {
    patientIdx: 16, journeyType: "General Eye Consultation", specialtyKey: "GENERAL_EYE_CONSULTATION", source: "referral", campaignKey: null, stage: "contacted",
    contactedOffsetDays: 0, createdOffsetDays: 0, createdHour: 9,
    interactions: [call({ direction: "outbound", status: "completed", durationSeconds: 140, daysAgo: 0, hour: 9, minute: 45, agent: "Priya Nambiar", summary: "Referred by a family friend; asked about check-up timings.", outcome: "Will visit this week." })],
  },
  // Converted: surgery done and paid.
  {
    patientIdx: 17, journeyType: "Cataract", specialtyKey: "CATARACT", source: "google", campaignKey: null, stage: "completed",
    contactedOffsetDays: -16, createdOffsetDays: -16,
    appt: { status: "completed", offsetDays: -14, hour: 10, doctor: "meera", reason: "Cataract consultation" },
    outcome: { value: "TREATMENT_ADVISED", notes: "Cataract surgery advised for the right eye." },
    treatment: { definitionKey: "CATARACT_SURGERY", label: "Cataract Surgery — Right Eye", status: "COMPLETED", estimatedValue: 42_000, decisionOffsetDays: -12, plannedOffsetDays: -9 },
    revenueAmount: 41_000, revenueOffsetDays: -9,
  },
  // A new enquiry, uncontacted.
  {
    patientIdx: 18, journeyType: "Cataract", specialtyKey: "CATARACT", source: "google", campaignKey: null, stage: "enquiry",
    contactedOffsetDays: null, createdOffsetDays: 0, createdHour: 11,
  },
  // Lost: not interested.
  {
    patientIdx: 19, journeyType: "Oculoplasty", specialtyKey: "OCULOPLASTY", source: "referral", campaignKey: null, stage: "lost",
    contactedOffsetDays: -6, createdOffsetDays: -8,
    interactions: [call({ direction: "outbound", status: "completed", durationSeconds: 96, daysAgo: 6, hour: 12, minute: 0, agent: "Priya Nambiar", summary: "The patient decided not to go ahead for now (cost).", outcome: "Not interested." })],
  },
  // Booked for the next two days.
  {
    patientIdx: 20, journeyType: "Cataract", specialtyKey: "CATARACT", source: "google", campaignKey: null, stage: "booked",
    contactedOffsetDays: -1, createdOffsetDays: -1,
    appt: { status: "confirmed", offsetDays: 1, hour: 11, doctor: "meera", reason: "Cataract consultation" },
  },
  {
    patientIdx: 21, journeyType: "Laser Vision Correction", specialtyKey: "LASER_VISION_CORRECTION", source: "phone", campaignKey: null, stage: "booked",
    contactedOffsetDays: -2, createdOffsetDays: -3,
    appt: { status: "confirmed", offsetDays: 2, hour: 12, doctor: "meera", reason: "LASIK screening" },
  },
  // Seen yesterday; no treatment needed.
  {
    patientIdx: 22, journeyType: "General Eye Consultation", specialtyKey: "GENERAL_EYE_CONSULTATION", source: "walk_in", campaignKey: null, stage: "consulted",
    contactedOffsetDays: -1, createdOffsetDays: -1,
    appt: { status: "completed", offsetDays: -1, hour: 15, doctor: "meera", reason: "General eye check-up" },
    outcome: { value: "NO_TREATMENT_REQUIRED", notes: "Routine check-up; new reading glasses prescribed." },
  },
  // No response / overdue callbacks.
  {
    patientIdx: 23, journeyType: "Cataract", specialtyKey: "CATARACT", source: "phone", campaignKey: null, stage: "contacted",
    contactedOffsetDays: -4, createdOffsetDays: -5,
    task: { reason: "overdue_callback", dueOffsetDays: -2, type: "CALLBACK", notes: "Said she would decide in a few days - check in" },
  },
  {
    patientIdx: 24, journeyType: "Oculoplasty", specialtyKey: "OCULOPLASTY", source: "google", campaignKey: null, stage: "contacted",
    contactedOffsetDays: -3, createdOffsetDays: -3,
    task: { reason: "missed_follow_up", dueOffsetDays: -1, type: "FOLLOW_UP", notes: "Follow-up after the first call went unanswered" },
  },
  {
    patientIdx: 25, journeyType: "Laser Vision Correction", specialtyKey: "LASER_VISION_CORRECTION", source: "meta", campaignKey: null, stage: "contacted",
    contactedOffsetDays: -1, createdOffsetDays: -1,
  },
];

export async function seedNamokarTenant(passwordHash: string) {
  assertJourneyConfigsConsistent("namokar", NAMOKAR_JOURNEYS, NAMOKAR_PATIENT_NAMES, new Set(OPHTHALMOLOGY_TREATMENTS.map((t) => t.key)));
  const tenant = await createDemoTenant(NAMOKAR_TENANT_NAME, "BETA_V1_CORE");
  await installDepartmentTemplate(db, tenant.id, "ophthalmology");

  const branchByKey = await createDemoBranches(tenant.id, [
    { name: "Namokar Eye & Oculoplasty Centre", city: "Pune" },
    { name: "Namokar Eye Care — Satellite Clinic", city: "Pune" },
  ]);

  // Runo and WhatsApp are FIXTURES here: nothing real is contacted.
  const { whatsappConnector, runoConnector, endpoints } = await createDemoConnectors(tenant.id, branchByKey, {
    identifiers: fixtureIdentifiers("NAMOKAR"),
    phoneNumberId: "FIXTURE_NAMOKAR_PHONE_NUMBER_ID",
    whatsappNumber: "+91 98100 55200",
    whatsappLabel: "WhatsApp Line",
    formIds: ["namokar-enquiry-v1"],
    metaPageId: "FIXTURE_NAMOKAR_PAGE_ID",
    phoneLines: [
      { key: "main", number: "+91 20 4155 0200", providerRef: "NAMOKAR-TELECALLING", label: "Telecalling Desk", isActive: true, branch: "a" },
      { key: "reception", number: "+91 20 4155 0201", providerRef: "NAMOKAR-RECEPTION", label: "Reception", isActive: true, branch: "a" },
    ],
  });

  const staff = await createDemoUsers("namokar", tenant.id, passwordHash, branchByKey, [
    { slug: "admin", name: "Kavita Shah", role: "HOSPITAL_ADMIN", branch: "a" },
    { slug: "doctor", name: "Dr. Meera Shah", role: "DOCTOR", branch: "a" },
    { slug: "doctor2", name: "Dr. Anand Jain", role: "DOCTOR", branch: "a" },
    { slug: "frontdesk", name: "Rohan Desai", role: "FRONT_DESK", branch: "a" },
    { slug: "coordinator", name: "Priya Nambiar", role: "PATIENT_COORDINATOR", branch: "a" },
  ]);
  const { admin, coordinator, frontdesk: frontDesk } = staff;

  const patientRows = await createDemoPatients(tenant.id, branchByKey, NAMOKAR_PATIENT_NAMES, 720_000_000, ["Marathi", "Hindi", "English"]);
  const ctx: DemoContext = {
    tenantId: tenant.id, branches: branchByKey, admin, coordinator, frontDesk,
    doctors: { meera: staff.doctor, anand: staff.doctor2 }, campaigns: {}, patients: patientRows,
    runoConnectorId: runoConnector.id, whatsappConnectorId: whatsappConnector.id, endpoints,
  };

  const { journeyIds, timelineRows } = await seedJourneys(ctx, NAMOKAR_JOURNEYS);
  if (timelineRows.length > 0) await db.insert(timelineEvents).values(timelineRows);

  const journeyOf = (patientIdx: number) => journeyIdForPatient(NAMOKAR_JOURNEYS, journeyIds, patientIdx);
  const owner = (patientIdx: number) => (patientIdx % 2 === 0 ? coordinator : frontDesk);
  const TZ = "Asia/Kolkata";
  await ensureFollowUpTypes(db, tenant.id);
  const typeId = async (key: string) => (await db.select({ id: followUpTypes.id }).from(followUpTypes).where(and(eq(followUpTypes.tenantId, tenant.id), eq(followUpTypes.key, key))))[0]!.id;
  const must = (label: string, r: { ok: boolean; reason?: string }) => {
    if (!r.ok) throw new Error(`seed: ${label} failed (${String(r.reason)})`);
  };

  // F - the patient asked for a callback tomorrow at 11:00.
  must("callback tomorrow", await createTask(db, tenant.id, owner(5).id, { patientId: patientRows[5].id, journeyId: journeyOf(5), type: "CALLBACK", assignedTo: owner(5).id, dueAt: daysFromNow(1, 11).toISOString(), notes: "Caller asked to be rung tomorrow morning after her son is home" }, TZ));
  // Another upcoming callback: LASIK enquiry, day after tomorrow.
  must("callback in two days", await createTask(db, tenant.id, owner(25).id, { patientId: patientRows[25].id, journeyId: journeyOf(25), type: "CALLBACK", assignedTo: owner(25).id, dueAt: daysFromNow(2, 12).toISOString(), notes: "Patient is travelling - call after the weekend to book the LASIK screening" }, TZ));
  // D - the no-show: an Appointment Risk follow-up so the front desk rebooks it.
  must("appointment risk", await createFollowUp(db, tenant.id, { id: coordinator.id }, journeyOf(6), { followUpTypeId: await typeId("appointment_risk"), dueAt: daysFromNow(1, 9, 30).toISOString(), assignedTo: owner(6).id, note: "Did not arrive for the ptosis consultation - call to rebook" }, TZ));
  // H - an upcoming Surgery Follow-up after the accepted ptosis correction.
  must("surgery follow-up", await createFollowUp(db, tenant.id, { id: coordinator.id }, journeyOf(7), { followUpTypeId: await typeId("surgery_followup"), dueAt: daysFromNow(2, 10, 30).toISOString(), assignedTo: owner(7).id, note: "Confirm the ptosis correction date and pre-operative instructions" }, TZ));

  console.log(`Namokar tenant: ${tenant.name} (${tenant.id}) - ${NAMOKAR_JOURNEYS.length} journeys, ${patientRows.length} patients`);
  return { tenantId: tenant.id };
}
