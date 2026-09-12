import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "HOSPITAL_ADMIN", "FRONT_DESK", "PATIENT_COORDINATOR", "DOCTOR"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  city: text("city").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("branches_tenant_idx").on(t.tenantId),
}));

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  branchId: uuid("branch_id").references(() => branches.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("users_tenant_idx").on(t.tenantId),
  emailTenantUnique: uniqueIndex("users_email_tenant_unique").on(t.tenantId, t.email),
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("sessions_user_idx").on(t.userId),
}));

export const sourceEnum = pgEnum("source_channel", ["meta", "google", "website", "whatsapp", "walk_in", "referral", "organic", "other"]);
export type SourceChannelDb = (typeof sourceEnum.enumValues)[number];

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  branchId: uuid("branch_id").references(() => branches.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  preferredLanguage: text("preferred_language").notNull().default("English"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("patients_tenant_idx").on(t.tenantId),
}));

export const journeyStageEnum = pgEnum("journey_stage", [
  "enquiry", "contacted", "booked", "attended", "consulted", "treatment_advised", "scheduled", "completed", "lost",
]);

export const journeys = pgTable("journeys", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyType: text("journey_type").notNull(),
  stage: journeyStageEnum("stage").notNull().default("enquiry"),
  source: sourceEnum("source").notNull(),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  contactedAt: timestamp("contacted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("journeys_tenant_idx").on(t.tenantId),
  patientIdx: index("journeys_patient_idx").on(t.patientId),
}));

export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "completed", "cancelled"]);
export const taskReasonEnum = pgEnum("task_reason", [
  "overdue_callback", "missed_follow_up", "no_show", "high_intent_uncontacted", "treatment_decision_pending", "manual_task",
]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyId: uuid("journey_id").references(() => journeys.id),
  assignedTo: uuid("assigned_to").references(() => users.id),
  reason: taskReasonEnum("reason").notNull().default("manual_task"),
  status: taskStatusEnum("status").notNull().default("pending"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("tasks_tenant_idx").on(t.tenantId),
}));

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled", "checked_in", "with_doctor", "completed", "no_show", "cancelled",
]);

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyId: uuid("journey_id").notNull().references(() => journeys.id),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  doctorUserId: uuid("doctor_user_id").notNull().references(() => users.id),
  status: appointmentStatusEnum("status").notNull().default("scheduled"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("appointments_tenant_idx").on(t.tenantId),
  doctorIdx: index("appointments_doctor_idx").on(t.doctorUserId),
}));

// ---------------------------------------------------------------------------
// Marketing → Patient Journey attribution domain
// ---------------------------------------------------------------------------

export const campaignStatusEnum = pgEnum("campaign_status", ["active", "paused", "ended"]);

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  source: sourceEnum("source").notNull(),
  name: text("name").notNull(),
  externalCampaignId: text("external_campaign_id"),
  spendAmount: integer("spend_amount").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  status: campaignStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("marketing_campaigns_tenant_idx").on(t.tenantId),
}));

// MVP attribution: one touchpoint per journey. `touchType` is modeled as
// first_touch | last_touch to leave room for genuine multi-touch capture
// later (see north-star addendum); today first and last touch coincide.
export const touchTypeEnum = pgEnum("touch_type", ["first_touch", "last_touch"]);

export const campaignTouchpoints = pgTable("campaign_touchpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyId: uuid("journey_id").notNull().references(() => journeys.id),
  campaignId: uuid("campaign_id").references(() => marketingCampaigns.id),
  source: sourceEnum("source").notNull(),
  touchType: touchTypeEnum("touch_type").notNull().default("first_touch"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata"),
}, (t) => ({
  tenantIdx: index("campaign_touchpoints_tenant_idx").on(t.tenantId),
  journeyIdx: index("campaign_touchpoints_journey_idx").on(t.journeyId),
  campaignIdx: index("campaign_touchpoints_campaign_idx").on(t.campaignId),
}));

export const consultationOutcomeEnum = pgEnum("consultation_outcome_type", [
  "CONSULTED", "TREATMENT_ADVISED", "NO_TREATMENT_REQUIRED", "DECISION_PENDING", "FOLLOW_UP_REQUIRED", "REFERRED", "OTHER",
]);

export const consultationOutcomes = pgTable("consultation_outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyId: uuid("journey_id").notNull().references(() => journeys.id),
  appointmentId: uuid("appointment_id").notNull().references(() => appointments.id),
  outcome: consultationOutcomeEnum("outcome").notNull(),
  recordedBy: uuid("recorded_by").notNull().references(() => users.id),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
}, (t) => ({
  tenantIdx: index("consultation_outcomes_tenant_idx").on(t.tenantId),
  appointmentUnique: uniqueIndex("consultation_outcomes_appointment_unique").on(t.appointmentId),
}));

export const treatmentStatusEnum = pgEnum("treatment_status", [
  "ADVISED", "DECISION_PENDING", "SCHEDULED", "COMPLETED", "DECLINED", "LOST",
]);

export const treatmentOpportunities = pgTable("treatment_opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyId: uuid("journey_id").notNull().references(() => journeys.id),
  consultationOutcomeId: uuid("consultation_outcome_id").references(() => consultationOutcomes.id),
  treatmentLabel: text("treatment_label").notNull(),
  status: treatmentStatusEnum("status").notNull().default("ADVISED"),
  estimatedValue: integer("estimated_value").notNull().default(0),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  decisionDate: timestamp("decision_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("treatment_opportunities_tenant_idx").on(t.tenantId),
  journeyIdx: index("treatment_opportunities_journey_idx").on(t.journeyId),
}));

export const revenueEventTypeEnum = pgEnum("revenue_event_type", ["consultation_fee", "treatment_payment", "other"]);

export const revenueEvents = pgTable("revenue_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyId: uuid("journey_id").notNull().references(() => journeys.id),
  treatmentOpportunityId: uuid("treatment_opportunity_id").references(() => treatmentOpportunities.id),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  type: revenueEventTypeEnum("type").notNull().default("treatment_payment"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  sourceSystem: text("source_system").notNull().default("manual"),
}, (t) => ({
  tenantIdx: index("revenue_events_tenant_idx").on(t.tenantId),
  journeyIdx: index("revenue_events_journey_idx").on(t.journeyId),
}));

export const actorTypeEnum = pgEnum("actor_type", ["system", "ai", "user"]);

export const timelineEvents = pgTable("timeline_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyId: uuid("journey_id").references(() => journeys.id),
  actorType: actorTypeEnum("actor_type").notNull().default("system"),
  actorId: uuid("actor_id"),
  eventType: text("event_type").notNull(),
  sourceChannel: text("source_channel"),
  title: text("title").notNull(),
  description: text("description"),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: uuid("related_entity_id"),
  metadata: jsonb("metadata"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("timeline_events_tenant_idx").on(t.tenantId),
  patientIdx: index("timeline_events_patient_idx").on(t.patientId),
  journeyIdx: index("timeline_events_journey_idx").on(t.journeyId),
  occurredIdx: index("timeline_events_occurred_idx").on(t.occurredAt),
}));
