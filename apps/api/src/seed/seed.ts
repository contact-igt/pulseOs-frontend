import "dotenv/config";
import { db, queryClient } from "../db/client.js";
import {
  appointments,
  branches,
  calls,
  campaignTouchpoints,
  connectorEvents,
  connectors,
  connectorSecrets,
  consultationOutcomes,
  conversations,
  journeys,
  marketingCampaigns,
  messages,
  patients,
  revenueEvents,
  sessions,
  tasks,
  tenants,
  timelineEvents,
  treatmentOpportunities,
  users,
  type SourceChannelDb,
} from "../db/schema.js";
import { hashPassword } from "../domain/auth/auth.service.js";
import { encryptSecret } from "../domain/security/encryption.js";

function requireDemoPassword(): string {
  const value = process.env.DEMO_PASSWORD;
  if (!value) {
    throw new Error("DEMO_PASSWORD env var is required to seed demo accounts");
  }
  return value;
}

const DEMO_PASSWORD: string = requireDemoPassword();

function daysFromNow(days: number, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function minutesAgo(mins: number) {
  return new Date(Date.now() - mins * 60_000);
}

type ConversationChannelValue = "WHATSAPP" | "CALL" | "SMS" | "EMAIL" | "INTERNAL";
type OwnershipStateValue = "AI_ACTIVE" | "HUMAN_REQUIRED" | "HUMAN_ASSIGNED" | "HUMAN_ACTIVE" | "AI_RESUME_PENDING" | "CLOSED";

interface ConversationConfig {
  patientIdx: number;
  channel: ConversationChannelValue;
  ownershipState: OwnershipStateValue;
  assignedTo: "coordinator" | "frontDesk" | null;
  messages: { sender: "patient" | "staff" | "ai" | "system"; body: string; minutesAgoSent: number; unread?: boolean }[];
}

// Inbox demo data: covers every channel and every ownership state at least
// once, with two HUMAN_REQUIRED conversations so the triage queue reads as
// a real backlog rather than a single example.
const CONVERSATION_CONFIGS: ConversationConfig[] = [
  {
    patientIdx: 0, channel: "WHATSAPP", ownershipState: "HUMAN_REQUIRED", assignedTo: null,
    messages: [
      { sender: "ai", body: "Hi Priya! Just checking in — have you and your partner decided on IVF Cycle 1 timing yet?", minutesAgoSent: 90 },
      { sender: "patient", body: "We're still deciding, but I have a question about the payment plan the AI couldn't answer.", minutesAgoSent: 20, unread: true },
    ],
  },
  {
    patientIdx: 12, channel: "WHATSAPP", ownershipState: "HUMAN_REQUIRED", assignedTo: null,
    messages: [
      { sender: "ai", body: "Hope your recovery from IVF Cycle 1 is going well. Any discomfort to report?", minutesAgoSent: 200 },
      { sender: "patient", body: "I've had some bleeding since yesterday — is that normal? I'd like to speak to someone.", minutesAgoSent: 15, unread: true },
    ],
  },
  {
    patientIdx: 1, channel: "WHATSAPP", ownershipState: "AI_ACTIVE", assignedTo: null,
    messages: [
      { sender: "patient", body: "What documents do I need to bring for my consultation?", minutesAgoSent: 60 },
      { sender: "ai", body: "Please bring a valid photo ID and any previous test reports you have.", minutesAgoSent: 58 },
    ],
  },
  {
    patientIdx: 6, channel: "CALL", ownershipState: "HUMAN_ASSIGNED", assignedTo: "coordinator",
    messages: [{ sender: "system", body: "Missed call from patient — flagged for follow-up.", minutesAgoSent: 300 }],
  },
  {
    patientIdx: 8, channel: "SMS", ownershipState: "HUMAN_ACTIVE", assignedTo: "coordinator",
    messages: [
      { sender: "patient", body: "Can we move the IVF review call to Friday?", minutesAgoSent: 45 },
      { sender: "staff", body: "Yes, I've noted Friday — I'll confirm the exact time shortly.", minutesAgoSent: 30 },
    ],
  },
  {
    patientIdx: 7, channel: "EMAIL", ownershipState: "AI_RESUME_PENDING", assignedTo: "frontDesk",
    messages: [
      { sender: "patient", body: "Thank you for clarifying the billing breakdown for my IUI cycle.", minutesAgoSent: 500 },
      { sender: "staff", body: "You're welcome! Handing you back to our assistant for anything else.", minutesAgoSent: 480 },
    ],
  },
  {
    patientIdx: 10, channel: "INTERNAL", ownershipState: "CLOSED", assignedTo: "coordinator",
    messages: [{ sender: "staff", body: "Payment for IVF Cycle 1 confirmed and reconciled — closing this thread.", minutesAgoSent: 1440 }],
  },
];

type ConsultationOutcomeValue =
  | "CONSULTED"
  | "TREATMENT_ADVISED"
  | "NO_TREATMENT_REQUIRED"
  | "DECISION_PENDING"
  | "FOLLOW_UP_REQUIRED"
  | "REFERRED"
  | "OTHER";

type TreatmentStatusValue = "ADVISED" | "DECISION_PENDING" | "SCHEDULED" | "COMPLETED" | "DECLINED" | "LOST";
type TaskReasonValue = "overdue_callback" | "missed_follow_up" | "no_show" | "high_intent_uncontacted" | "treatment_decision_pending" | "manual_task";
type TaskTypeValue = "CALLBACK" | "FOLLOW_UP" | "APPOINTMENT_CONFIRMATION" | "NO_SHOW_RECOVERY" | "TREATMENT_DECISION" | "POST_CARE" | "RECALL" | "OTHER";

const TASK_TYPE_BY_REASON: Record<TaskReasonValue, TaskTypeValue> = {
  overdue_callback: "CALLBACK",
  missed_follow_up: "FOLLOW_UP",
  no_show: "NO_SHOW_RECOVERY",
  high_intent_uncontacted: "CALLBACK",
  treatment_decision_pending: "TREATMENT_DECISION",
  manual_task: "OTHER",
};

const TASK_PRIORITY_BY_REASON: Record<TaskReasonValue, "normal" | "high"> = {
  overdue_callback: "normal",
  missed_follow_up: "normal",
  no_show: "high",
  high_intent_uncontacted: "high",
  treatment_decision_pending: "high",
  manual_task: "normal",
};
type JourneyStageValue = "enquiry" | "contacted" | "booked" | "attended" | "consulted" | "treatment_advised" | "scheduled" | "completed" | "lost";
type AppointmentStatusValue = "scheduled" | "checked_in" | "with_doctor" | "completed" | "no_show" | "cancelled";

interface JourneyConfig {
  patientIdx: number;
  journeyType: string;
  source: SourceChannelDb;
  campaignKey: "meta" | "google" | "website" | null;
  stage: JourneyStageValue;
  contactedOffsetDays: number | null; // null = never contacted
  createdOffsetDays: number;
  appt?: { status: AppointmentStatusValue; offsetDays: number; doctor: "meera" | "arjun" };
  outcome?: { value: ConsultationOutcomeValue; notes?: string };
  treatment?: { label: string; status: TreatmentStatusValue; estimatedValue: number; decisionOffsetDays?: number };
  revenueAmount?: number; // written as a revenue event when treatment status is COMPLETED
  revenueOffsetDays?: number;
  task?: { reason: TaskReasonValue; dueOffsetDays: number };
}

// The deliberate marketing story this seed tells:
//   - "Meta – Fertility Awareness": cheap enquiries, poor treatment conversion (1/8)
//   - "Google – IVF Search": pricier enquiries, high treatment conversion (3/5) and revenue
//   - "Website – Landing Page": strong appointment rate, but no-show leakage (2/5)
//   - Referral / walk-in: no campaign spend, nothing to protect (contrast for Spend At Risk)
const JOURNEY_CONFIGS: JourneyConfig[] = [
  // --- Meta group (8 journeys, poor conversion) ---
  {
    patientIdx: 0, journeyType: "Fertility", source: "meta", campaignKey: "meta", stage: "consulted",
    contactedOffsetDays: -5, createdOffsetDays: -6,
    appt: { status: "completed", offsetDays: -2, doctor: "meera" },
    outcome: { value: "DECISION_PENDING", notes: "Discussing IVF cycle timing with partner" },
    treatment: { label: "IVF Cycle 1", status: "DECISION_PENDING", estimatedValue: 300_00 },
    task: { reason: "treatment_decision_pending", dueOffsetDays: -1 },
  },
  {
    patientIdx: 1, journeyType: "Fertility", source: "meta", campaignKey: "meta", stage: "enquiry",
    contactedOffsetDays: null, createdOffsetDays: -1,
    task: { reason: "high_intent_uncontacted", dueOffsetDays: -1 },
  },
  {
    patientIdx: 2, journeyType: "Fertility", source: "meta", campaignKey: "meta", stage: "contacted",
    contactedOffsetDays: -1, createdOffsetDays: -2,
    task: { reason: "overdue_callback", dueOffsetDays: -1 },
  },
  {
    patientIdx: 3, journeyType: "Fertility", source: "meta", campaignKey: "meta", stage: "booked",
    contactedOffsetDays: -2, createdOffsetDays: -3,
    appt: { status: "scheduled", offsetDays: 1, doctor: "arjun" },
  },
  {
    patientIdx: 4, journeyType: "Fertility", source: "meta", campaignKey: "meta", stage: "consulted",
    contactedOffsetDays: -4, createdOffsetDays: -5,
    appt: { status: "completed", offsetDays: -1, doctor: "meera" },
    outcome: { value: "NO_TREATMENT_REQUIRED" },
  },
  {
    patientIdx: 5, journeyType: "Fertility", source: "meta", campaignKey: "meta", stage: "consulted",
    contactedOffsetDays: -3, createdOffsetDays: -4,
    appt: { status: "completed", offsetDays: -3, doctor: "arjun" },
    outcome: { value: "FOLLOW_UP_REQUIRED" },
    task: { reason: "missed_follow_up", dueOffsetDays: -2 },
  },
  {
    patientIdx: 6, journeyType: "Fertility", source: "meta", campaignKey: "meta", stage: "treatment_advised",
    contactedOffsetDays: -6, createdOffsetDays: -7,
    appt: { status: "completed", offsetDays: -3, doctor: "meera" },
    outcome: { value: "TREATMENT_ADVISED" },
    treatment: { label: "IUI Cycle", status: "ADVISED", estimatedValue: 25_000 },
  },
  {
    patientIdx: 7, journeyType: "Fertility", source: "meta", campaignKey: "meta", stage: "completed",
    contactedOffsetDays: -8, createdOffsetDays: -9,
    appt: { status: "completed", offsetDays: -6, doctor: "arjun" },
    outcome: { value: "TREATMENT_ADVISED" },
    treatment: { label: "IUI Cycle", status: "COMPLETED", estimatedValue: 22_000 },
    revenueAmount: 22_000, revenueOffsetDays: -1,
  },

  // --- Google group (5 journeys, expensive but high conversion) ---
  {
    patientIdx: 8, journeyType: "Fertility", source: "google", campaignKey: "google", stage: "consulted",
    contactedOffsetDays: -2, createdOffsetDays: -3,
    appt: { status: "completed", offsetDays: -2, doctor: "meera" },
    outcome: { value: "TREATMENT_ADVISED" },
    treatment: { label: "IVF Cycle 1", status: "DECISION_PENDING", estimatedValue: 60_000 },
    task: { reason: "treatment_decision_pending", dueOffsetDays: -3 },
  },
  {
    patientIdx: 9, journeyType: "Fertility", source: "google", campaignKey: "google", stage: "treatment_advised",
    contactedOffsetDays: -4, createdOffsetDays: -5,
    appt: { status: "completed", offsetDays: -3, doctor: "arjun" },
    outcome: { value: "TREATMENT_ADVISED" },
    treatment: { label: "IVF Cycle 1", status: "SCHEDULED", estimatedValue: 70_000, decisionOffsetDays: -1 },
  },
  {
    patientIdx: 10, journeyType: "Fertility", source: "google", campaignKey: "google", stage: "completed",
    contactedOffsetDays: -11, createdOffsetDays: -12,
    appt: { status: "completed", offsetDays: -10, doctor: "meera" },
    outcome: { value: "TREATMENT_ADVISED" },
    treatment: { label: "IVF Cycle 1", status: "COMPLETED", estimatedValue: 95_000 },
    revenueAmount: 95_000, revenueOffsetDays: -5,
  },
  {
    patientIdx: 11, journeyType: "Fertility", source: "google", campaignKey: "google", stage: "completed",
    contactedOffsetDays: -13, createdOffsetDays: -14,
    appt: { status: "completed", offsetDays: -12, doctor: "arjun" },
    outcome: { value: "TREATMENT_ADVISED" },
    treatment: { label: "IVF Cycle 2", status: "COMPLETED", estimatedValue: 110_000 },
    revenueAmount: 110_000, revenueOffsetDays: -6,
  },
  {
    patientIdx: 12, journeyType: "Fertility", source: "google", campaignKey: "google", stage: "completed",
    contactedOffsetDays: -9, createdOffsetDays: -10,
    appt: { status: "completed", offsetDays: -8, doctor: "meera" },
    outcome: { value: "TREATMENT_ADVISED" },
    treatment: { label: "IVF Cycle 1", status: "COMPLETED", estimatedValue: 88_000 },
    revenueAmount: 88_000, revenueOffsetDays: -4,
  },

  // --- Website group (5 journeys, strong appointment rate, no-show leakage) ---
  {
    patientIdx: 13, journeyType: "Paediatrics", source: "website", campaignKey: "website", stage: "booked",
    contactedOffsetDays: -2, createdOffsetDays: -3,
    appt: { status: "no_show", offsetDays: -1, doctor: "meera" },
    task: { reason: "no_show", dueOffsetDays: -1 },
  },
  {
    patientIdx: 14, journeyType: "Paediatrics", source: "website", campaignKey: "website", stage: "booked",
    contactedOffsetDays: -3, createdOffsetDays: -4,
    appt: { status: "no_show", offsetDays: -2, doctor: "arjun" },
    task: { reason: "no_show", dueOffsetDays: -2 },
  },
  {
    patientIdx: 15, journeyType: "Paediatrics", source: "website", campaignKey: "website", stage: "consulted",
    contactedOffsetDays: -3, createdOffsetDays: -4,
    appt: { status: "completed", offsetDays: -2, doctor: "meera" },
    outcome: { value: "CONSULTED" },
  },
  {
    patientIdx: 16, journeyType: "Paediatrics", source: "website", campaignKey: "website", stage: "consulted",
    contactedOffsetDays: -5, createdOffsetDays: -6,
    appt: { status: "completed", offsetDays: -4, doctor: "arjun" },
    outcome: { value: "FOLLOW_UP_REQUIRED" },
    task: { reason: "missed_follow_up", dueOffsetDays: -3 },
  },
  {
    patientIdx: 17, journeyType: "Paediatrics", source: "website", campaignKey: "website", stage: "attended",
    contactedOffsetDays: -2, createdOffsetDays: -3,
    appt: { status: "completed", offsetDays: -1, doctor: "meera" },
    outcome: { value: "NO_TREATMENT_REQUIRED" },
  },

  // --- No campaign (referral / walk-in): nothing to protect ---
  {
    patientIdx: 18, journeyType: "General OPD", source: "referral", campaignKey: null, stage: "lost",
    contactedOffsetDays: -10, createdOffsetDays: -14,
  },
  {
    patientIdx: 19, journeyType: "General OPD", source: "walk_in", campaignKey: null, stage: "enquiry",
    contactedOffsetDays: null, createdOffsetDays: -1,
    task: { reason: "high_intent_uncontacted", dueOffsetDays: -1 },
  },

  // Priya Sharma's second, concurrent journey — proves Patient != Journey.
  {
    patientIdx: 0, journeyType: "Pregnancy", source: "referral", campaignKey: null, stage: "consulted",
    contactedOffsetDays: -3, createdOffsetDays: -10,
    appt: { status: "completed", offsetDays: -3, doctor: "arjun" },
    outcome: { value: "CONSULTED" },
  },

  // A second, concurrent journey for Vikram Kumar with today's consultation already
  // completed but no outcome recorded yet — lets the doctor outcome workflow be
  // exercised live in the browser against today's date, not just historical data.
  {
    patientIdx: 1, journeyType: "General OPD", source: "walk_in", campaignKey: null, stage: "attended",
    contactedOffsetDays: 0, createdOffsetDays: 0,
    appt: { status: "completed", offsetDays: 0, doctor: "meera" },
  },
];

async function main() {
  console.log("Clearing existing demo data...");
  await db.delete(sessions);
  await db.delete(calls);
  await db.delete(connectorEvents);
  await db.delete(messages);
  await db.delete(conversations);
  await db.delete(timelineEvents);
  await db.delete(revenueEvents);
  await db.delete(treatmentOpportunities);
  await db.delete(consultationOutcomes);
  await db.delete(tasks);
  await db.delete(campaignTouchpoints);
  await db.delete(appointments);
  await db.delete(journeys);
  await db.delete(marketingCampaigns);
  await db.delete(patients);
  await db.delete(users);
  await db.delete(branches);
  await db.delete(connectorSecrets);
  await db.delete(connectors);
  await db.delete(tenants);

  const [tenant] = await db.insert(tenants).values({ name: "PulseOS Demo Hospital" }).returning();

  const [branchA, branchB] = await db
    .insert(branches)
    .values([
      { tenantId: tenant.id, name: "Koramangala Centre", city: "Bengaluru" },
      { tenantId: tenant.id, name: "Whitefield Centre", city: "Bengaluru" },
    ])
    .returning();

  // Connectors: WhatsApp and Runo are seeded CONNECTED against this local
  // system's own fixture webhook harness (Group T/V) — genuinely configured
  // and genuinely usable end-to-end locally, but never claimed as a live
  // connection to Meta/Runo's real infrastructure. Superfone/Exotel are
  // listed for visibility only, honestly NOT_CONFIGURED (no fake status).
  const [whatsappConnector] = await db
    .insert(connectors)
    .values({
      tenantId: tenant.id,
      type: "MESSAGING",
      provider: "whatsapp_meta_cloud",
      status: "CONNECTED",
      displayName: "WhatsApp (Meta Cloud API)",
      capabilities: ["SEND_MESSAGE", "RECEIVE_MESSAGE", "RECEIVE_STATUS"],
      configuration: { mode: "fixture", phoneNumberId: "FIXTURE_PHONE_NUMBER_ID", businessAccountId: "FIXTURE_WABA_ID" },
    })
    .returning();
  await db.insert(connectorSecrets).values({
    connectorId: whatsappConnector.id,
    encryptedPayload: encryptSecret({
      accessToken: "FIXTURE_TEST_ACCESS_TOKEN",
      appSecret: "FIXTURE_TEST_APP_SECRET",
      webhookVerifyToken: "pulseos-fixture-verify-token",
    }),
  });

  const [runoConnector] = await db
    .insert(connectors)
    .values({
      tenantId: tenant.id,
      type: "TELEPHONY",
      provider: "runo",
      status: "CONNECTED",
      displayName: "Runo",
      capabilities: ["RECEIVE_CALL_EVENT", "RECEIVE_RECORDING"],
      configuration: { mode: "fixture" },
    })
    .returning();
  await db.insert(connectorSecrets).values({
    connectorId: runoConnector.id,
    encryptedPayload: encryptSecret({ webhookSharedSecret: "pulseos-fixture-runo-secret" }),
  });

  await db.insert(connectors).values([
    {
      tenantId: tenant.id, type: "TELEPHONY", provider: "superfone", status: "NOT_CONFIGURED",
      displayName: "Superfone", capabilities: ["INITIATE_CALL", "RECEIVE_CALL_EVENT"], configuration: null,
    },
    {
      tenantId: tenant.id, type: "TELEPHONY", provider: "exotel", status: "NOT_CONFIGURED",
      displayName: "Exotel", capabilities: ["INITIATE_CALL", "RECEIVE_CALL_EVENT", "RECEIVE_RECORDING"], configuration: null,
    },
  ]);

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const [admin, doctorMeera, doctorArjun, frontDesk, coordinator] = await db
    .insert(users)
    .values([
      { tenantId: tenant.id, branchId: branchA.id, name: "Ananya Rao", email: "admin@pulseos.local", passwordHash, role: "HOSPITAL_ADMIN" },
      { tenantId: tenant.id, branchId: branchA.id, name: "Dr. Meera Iyer", email: "doctor@pulseos.local", passwordHash, role: "DOCTOR" },
      { tenantId: tenant.id, branchId: branchB.id, name: "Dr. Arjun Nair", email: "doctor2@pulseos.local", passwordHash, role: "DOCTOR" },
      { tenantId: tenant.id, branchId: branchA.id, name: "Kavya Menon", email: "frontdesk@pulseos.local", passwordHash, role: "FRONT_DESK" },
      { tenantId: tenant.id, branchId: branchA.id, name: "Rohan Das", email: "coordinator@pulseos.local", passwordHash, role: "PATIENT_COORDINATOR" },
    ])
    .returning();

  const [metaCampaign, googleCampaign, websiteCampaign] = await db
    .insert(marketingCampaigns)
    .values([
      { tenantId: tenant.id, source: "meta", name: "Meta – Fertility Awareness", spendAmount: 48_000, startDate: daysFromNow(-30), status: "active" },
      { tenantId: tenant.id, source: "google", name: "Google – IVF Search", spendAmount: 75_000, startDate: daysFromNow(-30), status: "active" },
      { tenantId: tenant.id, source: "website", name: "Website – Landing Page", spendAmount: 15_000, startDate: daysFromNow(-30), status: "active" },
    ])
    .returning();

  const campaignByKey = { meta: metaCampaign, google: googleCampaign, website: websiteCampaign };

  const patientNames = [
    "Priya Sharma", "Vikram Kumar", "Sneha Reddy", "Aditya Verma", "Lakshmi Nair",
    "Rahul Gupta", "Ishita Singh", "Karthik Pillai", "Divya Menon", "Arjun Patel",
    "Neha Joshi", "Suresh Iyer", "Pooja Agarwal", "Manoj Krishnan", "Ananya Desai",
    "Ravi Shankar", "Meenakshi Rao", "Siddharth Bose", "Tara Chawla", "Vishal Malhotra",
  ];

  const patientRows = await db
    .insert(patients)
    .values(
      patientNames.map((name, i) => ({
        tenantId: tenant.id,
        branchId: i % 2 === 0 ? branchA.id : branchB.id,
        name,
        phone: `9${(800000000 + i * 137).toString().slice(0, 9)}`,
        preferredLanguage: i % 3 === 0 ? "Kannada" : i % 3 === 1 ? "Hindi" : "English",
      })),
    )
    .returning();

  const doctorByKey = { meera: doctorMeera, arjun: doctorArjun };

  const timelineRows: (typeof timelineEvents.$inferInsert)[] = [];

  for (const config of JOURNEY_CONFIGS) {
    const patient = patientRows[config.patientIdx];
    const owner = config.patientIdx % 2 === 0 ? coordinator : frontDesk;

    const [journey] = await db
      .insert(journeys)
      .values({
        tenantId: tenant.id,
        patientId: patient.id,
        journeyType: config.journeyType,
        stage: config.stage,
        source: config.source,
        ownerUserId: owner.id,
        contactedAt: config.contactedOffsetDays === null ? null : daysFromNow(config.contactedOffsetDays),
        createdAt: daysFromNow(config.createdOffsetDays),
      })
      .returning();

    timelineRows.push({
      tenantId: tenant.id, patientId: patient.id, journeyId: journey.id,
      actorType: "system", eventType: "journey_created", title: `${config.journeyType} journey opened`,
      sourceChannel: config.source, occurredAt: daysFromNow(config.createdOffsetDays),
    });

    if (config.campaignKey) {
      const campaign = campaignByKey[config.campaignKey];
      await db.insert(campaignTouchpoints).values({
        tenantId: tenant.id, patientId: patient.id, journeyId: journey.id,
        campaignId: campaign.id, source: config.source, touchType: "first_touch",
        occurredAt: daysFromNow(config.createdOffsetDays),
      });
      timelineRows.push({
        tenantId: tenant.id, patientId: patient.id, journeyId: journey.id,
        actorType: "system", eventType: "source_captured", title: `Acquired via ${campaign.name}`,
        sourceChannel: config.source, occurredAt: daysFromNow(config.createdOffsetDays),
      });
    }

    let appointmentId: string | null = null;
    if (config.appt) {
      const doctor = doctorByKey[config.appt.doctor];
      const branch = config.patientIdx % 2 === 0 ? branchA : branchB;
      const [appt] = await db
        .insert(appointments)
        .values({
          tenantId: tenant.id, patientId: patient.id, journeyId: journey.id, branchId: branch.id,
          doctorUserId: doctor.id, status: config.appt.status,
          scheduledAt: daysFromNow(config.appt.offsetDays, 9 + (config.patientIdx % 8)),
          reason: "Consultation",
        })
        .returning();
      appointmentId = appt.id;
      timelineRows.push({
        tenantId: tenant.id, patientId: patient.id, journeyId: journey.id,
        actorType: "system", eventType: config.appt.status === "no_show" ? "appointment_no_show" : "appointment_" + config.appt.status,
        title: config.appt.status === "no_show" ? "Patient did not show up" : `Appointment ${config.appt.status.replace("_", " ")}`,
        occurredAt: daysFromNow(config.appt.offsetDays, 9 + (config.patientIdx % 8)),
        relatedEntityType: "appointment", relatedEntityId: appt.id,
      });
    }

    let outcomeId: string | null = null;
    if (config.outcome && appointmentId) {
      const doctor = doctorByKey[config.appt!.doctor];
      const [outcome] = await db
        .insert(consultationOutcomes)
        .values({
          tenantId: tenant.id, patientId: patient.id, journeyId: journey.id, appointmentId,
          outcome: config.outcome.value, recordedBy: doctor.id,
          recordedAt: daysFromNow(config.appt!.offsetDays, 11),
          notes: config.outcome.notes,
        })
        .returning();
      outcomeId = outcome.id;
      timelineRows.push({
        tenantId: tenant.id, patientId: patient.id, journeyId: journey.id, actorType: "user", actorId: doctor.id,
        eventType: "consultation_outcome_recorded", title: `Consultation outcome: ${config.outcome.value.replace(/_/g, " ").toLowerCase()}`,
        occurredAt: daysFromNow(config.appt!.offsetDays, 11), relatedEntityType: "consultation_outcome", relatedEntityId: outcome.id,
      });
    }

    let treatmentId: string | null = null;
    if (config.treatment) {
      const [treatment] = await db
        .insert(treatmentOpportunities)
        .values({
          tenantId: tenant.id, patientId: patient.id, journeyId: journey.id,
          consultationOutcomeId: outcomeId,
          treatmentLabel: config.treatment.label, status: config.treatment.status,
          estimatedValue: config.treatment.estimatedValue, ownerUserId: owner.id,
          decisionDate: config.treatment.decisionOffsetDays !== undefined ? daysFromNow(config.treatment.decisionOffsetDays) : null,
        })
        .returning();
      treatmentId = treatment.id;
      timelineRows.push({
        tenantId: tenant.id, patientId: patient.id, journeyId: journey.id,
        actorType: "system", eventType: "treatment_status_changed",
        title: `Treatment "${config.treatment.label}" — ${config.treatment.status.replace(/_/g, " ").toLowerCase()}`,
        occurredAt: daysFromNow(config.appt?.offsetDays ?? config.createdOffsetDays, 12),
        relatedEntityType: "treatment_opportunity", relatedEntityId: treatment.id,
      });
    }

    if (config.revenueAmount && treatmentId) {
      await db.insert(revenueEvents).values({
        tenantId: tenant.id, patientId: patient.id, journeyId: journey.id, treatmentOpportunityId: treatmentId,
        amount: config.revenueAmount, type: "treatment_payment",
        occurredAt: daysFromNow(config.revenueOffsetDays ?? 0),
      });
      timelineRows.push({
        tenantId: tenant.id, patientId: patient.id, journeyId: journey.id,
        actorType: "system", eventType: "revenue_recorded", title: `Payment received — ₹${config.revenueAmount.toLocaleString("en-IN")}`,
        occurredAt: daysFromNow(config.revenueOffsetDays ?? 0), relatedEntityType: "revenue_event",
      });
    }

    if (config.task) {
      await db.insert(tasks).values({
        tenantId: tenant.id, patientId: patient.id, journeyId: journey.id, assignedTo: owner.id,
        reason: config.task.reason, status: "pending", dueAt: daysFromNow(config.task.dueOffsetDays, 9),
        type: TASK_TYPE_BY_REASON[config.task.reason], priority: TASK_PRIORITY_BY_REASON[config.task.reason],
        createdBy: admin.id,
      });
    }
  }

  // A few standalone tasks spanning today/upcoming/completed so every My Work view has real rows.
  await db.insert(tasks).values([
    {
      tenantId: tenant.id, patientId: patientRows[2].id,
      assignedTo: coordinator.id, reason: "manual_task", type: "APPOINTMENT_CONFIRMATION", priority: "normal",
      notes: "Confirm tomorrow's 11am slot with patient", status: "pending", dueAt: daysFromNow(0, 15), createdBy: admin.id,
    },
    {
      tenantId: tenant.id, patientId: patientRows[3].id,
      assignedTo: frontDesk.id, reason: "manual_task", type: "RECALL", priority: "normal",
      status: "pending", dueAt: daysFromNow(4, 10), createdBy: admin.id,
    },
    {
      tenantId: tenant.id, patientId: patientRows[4].id,
      assignedTo: coordinator.id, reason: "manual_task", type: "POST_CARE", priority: "normal",
      notes: "Post-op check-in call", status: "completed", dueAt: daysFromNow(-2, 10),
      completedAt: daysFromNow(-2, 14), completedBy: coordinator.id, createdBy: admin.id,
    },
  ]);

  for (const config of CONVERSATION_CONFIGS) {
    const patient = patientRows[config.patientIdx];
    const assignedTo = config.assignedTo === "coordinator" ? coordinator.id : config.assignedTo === "frontDesk" ? frontDesk.id : null;
    const lastMessageAt = minutesAgo(Math.min(...config.messages.map((m) => m.minutesAgoSent)));

    const [conversation] = await db
      .insert(conversations)
      .values({ tenantId: tenant.id, patientId: patient.id, channel: config.channel, ownershipState: config.ownershipState, assignedTo, lastMessageAt })
      .returning();

    await db.insert(messages).values(
      config.messages.map((m) => ({
        tenantId: tenant.id,
        conversationId: conversation.id,
        senderType: m.sender,
        senderUserId: m.sender === "staff" ? assignedTo : null,
        body: m.body,
        sentAt: minutesAgo(m.minutesAgoSent),
        readAt: m.sender === "patient" && m.unread ? null : minutesAgo(m.minutesAgoSent),
      })),
    );
  }

  if (timelineRows.length > 0) {
    await db.insert(timelineEvents).values(timelineRows);
  }

  console.log("Seed complete.");
  console.log(`Conversations: ${CONVERSATION_CONFIGS.length}`);
  console.log("Connectors: WhatsApp (fixture, connected), Runo (fixture, connected), Superfone/Exotel (not configured)");
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Campaigns: Meta ₹48,000 · Google ₹75,000 · Website ₹15,000`);
  console.log(`Journeys: ${JOURNEY_CONFIGS.length}, Patients: ${patientRows.length}`);
  console.log(`Admin login: admin@pulseos.local (${admin.role})`);
  console.log(`Doctor login: doctor@pulseos.local`);
  console.log(`Password: value of DEMO_PASSWORD env var`);
}

main()
  .then(() => queryClient.end())
  .catch(async (err) => {
    console.error(err);
    await queryClient.end();
    process.exit(1);
  });
