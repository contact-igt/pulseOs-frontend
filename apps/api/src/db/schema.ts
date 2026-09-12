import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";

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

export const sourceEnum = pgEnum("source_channel", ["meta", "google", "website", "whatsapp", "walk_in", "referral"]);

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
  outcomeRecorded: boolean("outcome_recorded").notNull().default(false),
  treatmentRecommended: boolean("treatment_recommended").notNull().default(false),
  revenueAmount: integer("revenue_amount").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("appointments_tenant_idx").on(t.tenantId),
  doctorIdx: index("appointments_doctor_idx").on(t.doctorUserId),
}));

export const sourceSpend = pgTable("source_spend", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  source: sourceEnum("source").notNull(),
  spendAmount: integer("spend_amount").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("source_spend_tenant_idx").on(t.tenantId),
  tenantSourceUnique: uniqueIndex("source_spend_tenant_source_unique").on(t.tenantId, t.source),
}));
