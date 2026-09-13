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

// `reason` is the operational-failure bucket used only for Spend-At-Risk
// categorization (dashboard.service.ts SPEND_AT_RISK_CATEGORIES) — it answers
// "what acquisition spend is this task protecting," not "what kind of work is
// this." `type` (below) is the hospital-operational work category shown on
// Tasks/My Work and answers "what does the assignee actually need to do."
// The two taxonomies serve different screens and are kept independent.
export const taskReasonEnum = pgEnum("task_reason", [
  "overdue_callback", "missed_follow_up", "no_show", "high_intent_uncontacted", "treatment_decision_pending", "manual_task",
]);

export const taskTypeEnum = pgEnum("task_type", [
  "CALLBACK", "FOLLOW_UP", "APPOINTMENT_CONFIRMATION", "NO_SHOW_RECOVERY", "TREATMENT_DECISION", "POST_CARE", "RECALL", "OTHER",
]);

export const taskPriorityEnum = pgEnum("task_priority", ["normal", "high"]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyId: uuid("journey_id").references(() => journeys.id),
  assignedTo: uuid("assigned_to").references(() => users.id),
  reason: taskReasonEnum("reason").notNull().default("manual_task"),
  type: taskTypeEnum("type").notNull().default("OTHER"),
  priority: taskPriorityEnum("priority").notNull().default("normal"),
  status: taskStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  completedBy: uuid("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("tasks_tenant_idx").on(t.tenantId),
  assignedIdx: index("tasks_assigned_idx").on(t.assignedTo),
}));

// "scheduled" is the DB-level synonym for the operational state BOOKED
// (kept as the original enum value to avoid a risky ALTER TYPE RENAME VALUE
// migration on live data — display layers show it as "Booked").
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "requested", "scheduled", "confirmed", "checked_in", "waiting", "with_doctor", "completed", "no_show", "cancelled",
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
  "ADVISED", "DECISION_PENDING", "ACCEPTED", "SCHEDULED", "COMPLETED", "DECLINED", "CANCELLED", "LOST",
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
  plannedDate: timestamp("planned_date", { withTimezone: true }),
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

// ---------------------------------------------------------------------------
// Inbox — PulseOS-native conversation shell (Group P). Demo/persisted data
// only in this checkpoint; no live channel provider is wired yet.
// ---------------------------------------------------------------------------

export const conversationChannelEnum = pgEnum("conversation_channel", ["WHATSAPP", "CALL", "SMS", "EMAIL", "INTERNAL"]);
export const ownershipStateEnum = pgEnum("ownership_state", [
  "AI_ACTIVE", "HUMAN_REQUIRED", "HUMAN_ASSIGNED", "HUMAN_ACTIVE", "AI_RESUME_PENDING", "CLOSED",
]);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyId: uuid("journey_id").references(() => journeys.id),
  channel: conversationChannelEnum("channel").notNull().default("WHATSAPP"),
  ownershipState: ownershipStateEnum("ownership_state").notNull().default("AI_ACTIVE"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Which live connector this thread belongs to (Group T). Null for demo-seed
  // conversations that never touched a real provider.
  connectorId: uuid("connector_id").references(() => connectors.id),
  // The provider's own thread/account identity (e.g. WhatsApp wa_id), used to
  // resolve an inbound webhook back to this conversation without re-deriving
  // it from the patient's phone number every time.
  externalThreadId: text("external_thread_id"),
}, (t) => ({
  tenantIdx: index("conversations_tenant_idx").on(t.tenantId),
  patientIdx: index("conversations_patient_idx").on(t.patientId),
  externalThreadUnique: uniqueIndex("conversations_connector_external_thread_unique").on(t.connectorId, t.externalThreadId),
}));

export const messageSenderEnum = pgEnum("message_sender", ["patient", "staff", "ai", "system"]);
export const messageDeliveryStatusEnum = pgEnum("message_delivery_status", ["queued", "sent", "delivered", "read", "failed"]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  senderType: messageSenderEnum("sender_type").notNull(),
  senderUserId: uuid("sender_user_id").references(() => users.id),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
  // Live-transport metadata (Group T). Null for staff-composed/system/demo-seed
  // messages that never touched a real provider.
  connectorId: uuid("connector_id").references(() => connectors.id),
  providerMessageId: text("provider_message_id"),
  deliveryStatus: messageDeliveryStatusEnum("delivery_status"),
}, (t) => ({
  conversationIdx: index("messages_conversation_idx").on(t.conversationId),
  providerMessageUnique: uniqueIndex("messages_connector_provider_message_unique").on(t.connectorId, t.providerMessageId),
}));

// ---------------------------------------------------------------------------
// Connectors — provider-neutral adapter configuration (Group R). PulseOS core
// (Patient/Journey/Conversation/Timeline/Task) never depends on a specific
// provider; a Connector is the configured instance an adapter reads to talk to
// one. Secrets never live on this row — see connectorSecrets below.
// ---------------------------------------------------------------------------

export const connectorTypeEnum = pgEnum("connector_type", ["MESSAGING", "TELEPHONY", "ADS", "EMAIL", "STORAGE", "HIS"]);
export const connectorStatusEnum = pgEnum("connector_status", ["NOT_CONFIGURED", "CONNECTING", "CONNECTED", "DEGRADED", "ERROR", "DISABLED"]);
export const connectorCapabilityEnum = pgEnum("connector_capability", [
  "SEND_MESSAGE", "RECEIVE_MESSAGE", "RECEIVE_STATUS",
  "INITIATE_CALL", "RECEIVE_CALL_EVENT", "FETCH_RECORDING", "RECEIVE_RECORDING", "RECEIVE_TRANSCRIPT",
]);

export const connectors = pgTable("connectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  type: connectorTypeEnum("type").notNull(),
  // Adapter-registry key (e.g. "whatsapp_meta_cloud", "runo") — never branched on
  // in domain logic, only used to look up the adapter implementation.
  provider: text("provider").notNull(),
  status: connectorStatusEnum("status").notNull().default("NOT_CONFIGURED"),
  displayName: text("display_name").notNull(),
  capabilities: connectorCapabilityEnum("capabilities").array().notNull(),
  // Non-secret configuration only (phone_number_id, webhook path, account id...).
  configuration: jsonb("configuration"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("connectors_tenant_idx").on(t.tenantId),
  tenantProviderUnique: uniqueIndex("connectors_tenant_provider_unique").on(t.tenantId, t.provider),
}));

// One encrypted blob per connector holding every secret field the adapter
// needs (access token, app secret, webhook verify token...). Decrypted only in
// memory at the point of use — never logged, never returned to the client.
export const connectorSecrets = pgTable("connector_secrets", {
  connectorId: uuid("connector_id").primaryKey().references(() => connectors.id),
  encryptedPayload: text("encrypted_payload").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const connectorEventDirectionEnum = pgEnum("connector_event_direction", ["inbound", "outbound"]);
export const connectorEventStatusEnum = pgEnum("connector_event_status", ["received", "processed", "failed", "duplicate"]);

// Idempotency + dead-letter visibility for every webhook/event a connector
// ingests or sends. The unique (connectorId, externalEventId) index is the
// actual idempotency guard — a duplicate insert is caught and recorded as
// "duplicate" rather than reprocessed.
export const connectorEvents = pgTable("connector_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  connectorId: uuid("connector_id").notNull().references(() => connectors.id),
  externalEventId: text("external_event_id").notNull(),
  direction: connectorEventDirectionEnum("direction").notNull(),
  status: connectorEventStatusEnum("status").notNull().default("received"),
  error: text("error"),
  payload: jsonb("payload"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (t) => ({
  connectorIdx: index("connector_events_connector_idx").on(t.connectorId),
  idempotencyUnique: uniqueIndex("connector_events_connector_external_unique").on(t.connectorId, t.externalEventId),
}));

// ---------------------------------------------------------------------------
// Telephony — provider-neutral call/interaction record (Group V/W).
// ---------------------------------------------------------------------------

export const callDirectionEnum = pgEnum("call_direction", ["inbound", "outbound"]);
export const callStatusEnum = pgEnum("call_status", ["completed", "missed", "no_answer", "busy", "failed"]);

export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  connectorId: uuid("connector_id").notNull().references(() => connectors.id),
  patientId: uuid("patient_id").references(() => patients.id),
  journeyId: uuid("journey_id").references(() => journeys.id),
  externalCallId: text("external_call_id").notNull(),
  direction: callDirectionEnum("direction").notNull(),
  phone: text("phone").notNull(),
  status: callStatusEnum("status").notNull(),
  durationSeconds: integer("duration_seconds"),
  recordingUrl: text("recording_url"),
  disposition: text("disposition"),
  agentName: text("agent_name"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("calls_tenant_idx").on(t.tenantId),
  patientIdx: index("calls_patient_idx").on(t.patientId),
  idempotencyUnique: uniqueIndex("calls_connector_external_unique").on(t.connectorId, t.externalCallId),
}));
