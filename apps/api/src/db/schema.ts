import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "HOSPITAL_ADMIN", "FRONT_DESK", "PATIENT_COORDINATOR", "DOCTOR"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // ISO 3166-1 alpha-2 region used as the default country context when
  // normalizing a phone number to E.164 with no other signal available.
  defaultPhoneRegion: text("default_phone_region").notNull().default("IN"),
  // IANA timezone of the hospital. Every analytics day/week bucket ("which day
  // did this enquiry arrive on?") is grouped in this zone, not UTC or the
  // server clock, so a 23:30 IST enquiry lands on its own calendar day.
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
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

export const sourceEnum = pgEnum("source_channel", ["meta", "google", "website", "whatsapp", "phone", "walk_in", "referral", "organic", "other"]);
export type SourceChannelDb = (typeof sourceEnum.enumValues)[number];

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  branchId: uuid("branch_id").references(() => branches.id),
  name: text("name").notNull(),
  // Raw, as-entered/as-received value — always preserved, still the display value.
  phone: text("phone").notNull(),
  // Canonical E.164 form (null when normalization failed) — the only field
  // identity resolution ever matches on. Never fuzzy-matched.
  phoneE164: text("phone_e164"),
  phoneCountry: text("phone_country"),
  email: text("email"),
  preferredLanguage: text("preferred_language").notNull().default("English"),
  // Conversion-feedback eligibility gate — defaults to true (a patient who
  // messages/calls/submits a form has implicitly engaged), can be revoked.
  // See acquisition/conversion-feedback.service.ts.
  marketingConsent: boolean("marketing_consent").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("patients_tenant_idx").on(t.tenantId),
  phoneE164Idx: index("patients_phone_e164_idx").on(t.phoneE164),
}));

export const journeyStageEnum = pgEnum("journey_stage", [
  "enquiry", "contacted", "booked", "attended", "consulted", "treatment_advised", "scheduled", "completed", "lost",
]);

// Declared here (ahead of its original home just above `tasks`) so `journeys`
// below can reuse the same enum for lead priority instead of duplicating it.
export const taskPriorityEnum = pgEnum("task_priority", ["normal", "high"]);

export const journeys = pgTable("journeys", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyType: text("journey_type").notNull(),
  // Free-text key into specialty_templates.key, not a hard FK — a template
  // may be archived without invalidating historical journeys that used it.
  specialtyKey: text("specialty_key"),
  stage: journeyStageEnum("stage").notNull().default("enquiry"),
  source: sourceEnum("source").notNull(),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  priority: taskPriorityEnum("priority").notNull().default("normal"),
  notes: text("notes"),
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
  "overdue_callback", "missed_follow_up", "no_show", "high_intent_uncontacted", "treatment_decision_pending", "manual_task", "new_lead",
]);

export const taskTypeEnum = pgEnum("task_type", [
  "CALLBACK", "FOLLOW_UP", "APPOINTMENT_CONFIRMATION", "NO_SHOW_RECOVERY", "TREATMENT_DECISION", "POST_CARE", "RECALL", "OTHER",
]);

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
  // Which connector synced this campaign, and therefore which mode
  // (FIXTURE/SANDBOX/LIVE) its spend/status data actually reflects — null
  // for manually-created campaigns (e.g. seed data) that were never synced
  // from a provider. The Campaigns/Sources UI joins through this to show
  // mode clearly rather than ever implying real synced spend for a fixture
  // connector.
  connectorId: uuid("connector_id").references(() => connectors.id),
  source: sourceEnum("source").notNull(),
  name: text("name").notNull(),
  externalCampaignId: text("external_campaign_id"),
  // Ad-account-level id (Meta ad account, Google Ads customer id...) — the
  // level above campaign, needed once campaign spend sync is wired in.
  externalAccountId: text("external_account_id"),
  spendAmount: integer("spend_amount").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  status: campaignStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("marketing_campaigns_tenant_idx").on(t.tenantId),
  // NULLs never collide in a Postgres unique index, so manually-created
  // campaigns (no externalCampaignId) are unaffected — this only guards
  // against re-creating a duplicate campaign row for the same provider id.
  tenantExternalUnique: uniqueIndex("marketing_campaigns_tenant_external_unique").on(t.tenantId, t.externalCampaignId),
}));

// `touchType` marks structural role, not a fixed count: the row created by a
// journey's very first attribution event stays "first_touch" forever (never
// overwritten); every touchpoint recorded after that is "last_touch" — the
// one among those with the latest occurredAt is the current last touch, and
// all "last_touch" rows together are the full touchpoint history between
// first and now. See acquisition/attribution.service.ts.
export const touchTypeEnum = pgEnum("touch_type", ["first_touch", "last_touch"]);

export const campaignTouchpoints = pgTable("campaign_touchpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  journeyId: uuid("journey_id").notNull().references(() => journeys.id),
  campaignId: uuid("campaign_id").references(() => marketingCampaigns.id),
  source: sourceEnum("source").notNull(),
  touchType: touchTypeEnum("touch_type").notNull().default("first_touch"),
  // UTM-style context, kept as raw strings alongside the resolved campaignId
  // so a touchpoint is still meaningful even when no MarketingCampaign could
  // be resolved (e.g. an unrecognized utm_campaign value on a website form).
  medium: text("medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  // Provider hierarchy ids, preserved verbatim for drill-down even though
  // only externalCampaignId currently resolves to a MarketingCampaign.
  externalAccountId: text("external_account_id"),
  externalCampaignId: text("external_campaign_id"),
  externalAdGroupId: text("external_ad_group_id"),
  externalAdId: text("external_ad_id"),
  externalFormId: text("external_form_id"),
  externalLeadId: text("external_lead_id"),
  // Click identifiers — gclid/gbraid/wbraid for Google traffic, fbclid for
  // Meta traffic. Preserved for downstream conversion feedback, never used
  // for identity matching.
  gclid: text("gclid"),
  gbraid: text("gbraid"),
  wbraid: text("wbraid"),
  fbclid: text("fbclid"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata"),
}, (t) => ({
  tenantIdx: index("campaign_touchpoints_tenant_idx").on(t.tenantId),
  journeyIdx: index("campaign_touchpoints_journey_idx").on(t.journeyId),
  campaignIdx: index("campaign_touchpoints_campaign_idx").on(t.campaignId),
}));

export const conversionFeedbackEventTypeEnum = pgEnum("conversion_feedback_event_type", [
  "QUALIFIED_ENQUIRY", "APPOINTMENT_BOOKED", "APPOINTMENT_ATTENDED", "CONSULTATION_COMPLETED",
  "TREATMENT_ADVISED", "TREATMENT_COMPLETED", "REVENUE_RECORDED",
]);

// A candidate outbound conversion-feedback event, built only when the
// patient is consent-eligible (marketingConsent) — see
// acquisition/conversion-feedback.service.ts. Deliberately never sent to any
// provider by this checkpoint; this table is the payload-building/audit
// layer only. click ids and externalCampaignId are copied from the
// journey's current attribution (attribution.service.getAttributionSummary)
// at the moment the milestone is recorded, not looked up live later.
export const conversionFeedbackEvents = pgTable("conversion_feedback_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  journeyId: uuid("journey_id").notNull().references(() => journeys.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  eventType: conversionFeedbackEventTypeEnum("event_type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  value: integer("value"),
  currency: text("currency").notNull().default("INR"),
  source: sourceEnum("source"),
  externalCampaignId: text("external_campaign_id"),
  gclid: text("gclid"),
  gbraid: text("gbraid"),
  wbraid: text("wbraid"),
  fbclid: text("fbclid"),
  // "{journeyId}:{eventType}" — a journey reports each milestone at most
  // once, even if the triggering domain event somehow fires twice.
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("conversion_feedback_events_tenant_idx").on(t.tenantId),
  idempotencyUnique: uniqueIndex("conversion_feedback_events_idempotency_unique").on(t.idempotencyKey),
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
  // Optional link to the tenant's treatment catalog (treatment_definitions). The label above stays the
  // display text (and is all that free-text/legacy rows have); the FK is what groups/filters by procedure.
  treatmentDefinitionId: uuid("treatment_definition_id").references(() => treatmentDefinitions.id),
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
  definitionIdx: index("treatment_opportunities_definition_idx").on(t.treatmentDefinitionId),
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
  // A treatment produces at most one completion-revenue-event. treatmentOpportunityId
  // is nullable (a revenue event need not always be tied to a treatment), and a plain
  // unique index treats NULLs as distinct — so this only constrains the non-null case,
  // exactly the invariant we need. Defense-in-depth alongside the application-level
  // conditional-update guard in treatment.service.ts's updateTreatmentStatus.
  treatmentOpportunityUnique: uniqueIndex("revenue_events_treatment_opportunity_unique").on(t.treatmentOpportunityId),
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
  // Which hospital WhatsApp number this thread is on. Nullable — existing
  // rows and any tenant with only one number never populate this; it only
  // matters once a tenant configures more than one WhatsApp endpoint.
  communicationEndpointId: uuid("communication_endpoint_id").references(() => communicationEndpoints.id),
}, (t) => ({
  tenantIdx: index("conversations_tenant_idx").on(t.tenantId),
  patientIdx: index("conversations_patient_idx").on(t.patientId),
  // Widened from (connectorId, externalThreadId): under one WABA, the same
  // patient (externalThreadId = their wa_id) can legitimately message two
  // different hospital numbers — without the endpoint in the key, those two
  // genuinely separate conversations would collide into one.
  //
  // Endpoint resolution is now live (whatsapp-webhook.service.ts resolves
  // and stamps communicationEndpointId from the real metadata.phone_number_id,
  // and findOrCreateConversation's SELECT matches on it too, so the app-level
  // guard and this index agree). REMAINING, still-live risk: Postgres treats
  // every NULL as distinct for uniqueness, so for any still-endpoint-less
  // conversation (no CommunicationEndpoint configured for that line yet) the
  // DB-level race backstop is weaker than for a resolved one — two
  // concurrent inbound webhooks for the same (connectorId, externalThreadId,
  // endpoint=NULL) could both pass this index. The app-level find-or-create
  // SELECT-then-INSERT in whatsapp-webhook.service.ts (now NULL-aware via
  // isNull()) remains the real duplicate guard for that case, same as before
  // this column existed.
  externalThreadUnique: uniqueIndex("conversations_connector_endpoint_external_thread_unique").on(t.connectorId, t.communicationEndpointId, t.externalThreadId),
}));

// Configuration/scheduling preference only — there is no agent runtime yet
// to actually act on "ai_scheduled". One row per conversation (upserted),
// honestly representing what a human has asked for, not what is executing.
export const conversationAutomationModeEnum = pgEnum("conversation_automation_mode", ["manual", "ai_when_available", "ai_scheduled"]);

export const conversationAutomationPreferences = pgTable("conversation_automation_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  mode: conversationAutomationModeEnum("mode").notNull().default("manual"),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
  timezone: text("timezone"),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("conversation_automation_preferences_tenant_idx").on(t.tenantId),
  conversationUnique: uniqueIndex("conversation_automation_preferences_conversation_unique").on(t.conversationId),
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

export const connectorTypeEnum = pgEnum("connector_type", ["MESSAGING", "TELEPHONY", "ADS", "EMAIL", "STORAGE", "HIS", "ACQUISITION"]);
export const connectorStatusEnum = pgEnum("connector_status", ["NOT_CONFIGURED", "CONNECTING", "CONNECTED", "DEGRADED", "ERROR", "DISABLED"]);
// FIXTURE/SANDBOX/LIVE — never inferred, always the connector's actual
// provenance, so the UI can never visually imply a live production
// connection for a connector that is actually fixture- or sandbox-backed.
export const connectorModeEnum = pgEnum("connector_mode", ["FIXTURE", "SANDBOX", "LIVE"]);
export const connectorCapabilityEnum = pgEnum("connector_capability", [
  "SEND_MESSAGE", "RECEIVE_MESSAGE", "RECEIVE_STATUS",
  "INITIATE_CALL", "RECEIVE_CALL_EVENT", "FETCH_RECORDING", "RECEIVE_RECORDING", "RECEIVE_TRANSCRIPT",
  "RECEIVE_LEAD", "SYNC_CAMPAIGNS", "SYNC_AD_GROUPS", "SYNC_ADS", "SYNC_SPEND", "SYNC_PERFORMANCE",
  "RECEIVE_FORM", "EXPORT_CONVERSION",
]);

export const connectors = pgTable("connectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  type: connectorTypeEnum("type").notNull(),
  // Adapter-registry key (e.g. "whatsapp_meta_cloud", "runo") — never branched on
  // in domain logic, only used to look up the adapter implementation.
  provider: text("provider").notNull(),
  status: connectorStatusEnum("status").notNull().default("NOT_CONFIGURED"),
  mode: connectorModeEnum("mode").notNull().default("FIXTURE"),
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

// ---------------------------------------------------------------------------
// Communication endpoints — the N-hospital-numbers-per-1-connector layer.
// A Connector stays 1-per-tenant-per-provider (it owns the single credential/
// webhook a provider actually gives you — one WABA webhook URL, one Runo API
// key — confirmed against both providers' real architecture, not assumed).
// A hospital can still have several phone/WhatsApp lines under that one
// connector (Main Line, Fertility Line, a WhatsApp number) — this table is
// that N side. Deliberately NOT unique per (tenantId) — many endpoints per
// tenant is the whole point.
// ---------------------------------------------------------------------------

export const communicationEndpointTypeEnum = pgEnum("communication_endpoint_type", ["PHONE", "WHATSAPP"]);

export const communicationEndpoints = pgTable("communication_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  connectorId: uuid("connector_id").notNull().references(() => connectors.id),
  // Optional — not every number maps 1:1 to a branch (e.g. a specialty line
  // shared across branches).
  branchId: uuid("branch_id").references(() => branches.id),
  type: communicationEndpointTypeEnum("type").notNull(),
  // Denormalized from connectors.provider — cheap, avoids a join for the
  // common "which provider is this number on" read.
  provider: text("provider").notNull(),
  publicNumber: text("public_number").notNull(),
  // The provider's own identifier for this specific number: WhatsApp's real
  // `phone_number_id` (confirmed present on every inbound webhook payload),
  // or — for Runo, which never exposes which SIM/line a call used (confirmed
  // against their live API) — a manual/config label an admin assigns, never
  // silently treated as provider-verified.
  providerRef: text("provider_ref").notNull(),
  displayLabel: text("display_label").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("communication_endpoints_tenant_idx").on(t.tenantId),
  connectorProviderRefUnique: uniqueIndex("communication_endpoints_connector_provider_ref_unique").on(t.connectorId, t.providerRef),
}));

// Google Business Profile aggregate listing performance — a dedicated table
// because this data is location-shaped, not campaign-shaped, and does not
// belong in marketing_campaigns. Deliberately has NO patientId/journeyId/
// touchpoint link of any kind: these are aggregate metrics for a Google
// Business listing, never a trackable event for an individual person, so
// nothing here can ever create or touch a Patient.
export const gbpPerformanceMetrics = pgTable("gbp_performance_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  connectorId: uuid("connector_id").notNull().references(() => connectors.id),
  metricDate: timestamp("metric_date", { withTimezone: true }).notNull(),
  impressions: integer("impressions"),
  clicks: integer("clicks"),
  searchImpressions: integer("search_impressions"),
  websiteClicks: integer("website_clicks"),
  callClicks: integer("call_clicks"),
  directionRequests: integer("direction_requests"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("gbp_performance_metrics_tenant_idx").on(t.tenantId),
  connectorDateUnique: uniqueIndex("gbp_performance_metrics_connector_date_unique").on(t.connectorId, t.metricDate),
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
// Disposition -> Next Action mappings. Tenant-scoped, connector-scoped,
// admin-editable. `action` is a fixed whitelist — arbitrary provider
// disposition text can never invoke an arbitrary backend action, only ever
// the exact whitelisted ones below with validated config.
// ---------------------------------------------------------------------------

export const dispositionActionEnum = pgEnum("disposition_action", ["CREATE_CALLBACK_TASK", "ADVANCE_JOURNEY_STAGE"]);

export const connectorDispositionMappings = pgTable("connector_disposition_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  connectorId: uuid("connector_id").notNull().references(() => connectors.id),
  providerDisposition: text("provider_disposition").notNull(),
  action: dispositionActionEnum("action").notNull(),
  actionConfig: jsonb("action_config").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  connectorIdx: index("disposition_mappings_connector_idx").on(t.connectorId),
  uniquePerConnector: uniqueIndex("disposition_mappings_connector_disposition_unique").on(t.connectorId, t.providerDisposition),
}));

// Every create/update/delete of a connector config value (disposition
// mappings today; extensible to other admin-editable connector config)
// is recorded here — who, what changed, before/after.
export const connectorAuditActionEnum = pgEnum("connector_audit_action", ["CREATE", "UPDATE", "DELETE"]);

export const connectorConfigAuditEvents = pgTable("connector_config_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  connectorId: uuid("connector_id").notNull().references(() => connectors.id),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: connectorAuditActionEnum("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  connectorIdx: index("connector_audit_connector_idx").on(t.connectorId),
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
  // Nullable: Runo never tells you which hospital line/SIM a call used
  // (confirmed against their real API) — most calls will have no resolvable
  // endpoint unless a tenant has configured a manual default for its Runo
  // connector. Never backfilled; existing rows stay null forever, correctly.
  communicationEndpointId: uuid("communication_endpoint_id").references(() => communicationEndpoints.id),
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

// ---------------------------------------------------------------------------
// Specialty templates + custom fields — lets a tenant configure per-specialty
// enquiry fields (e.g. Gynecology's EDD, Ophthalmology's Laterality) without
// forking the product or hard-coding columns onto `patients`/`journeys`.
// `specialtyTemplates` rows are never hard-deleted (only toggled `enabled` or
// a field `archived`) so historical journeys/values referencing a key by
// plain text (not a FK — see `journeys.specialtyKey` above) stay valid.
// ---------------------------------------------------------------------------

export const customFieldTypeEnum = pgEnum("custom_field_type", ["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT", "MULTI_SELECT", "PHONE"]);

export const specialtyTemplates = pgTable("specialty_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  key: text("key").notNull(),
  displayName: text("display_name").notNull(),
  defaultJourneyType: text("default_journey_type").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("specialty_templates_tenant_idx").on(t.tenantId),
  tenantKeyUnique: uniqueIndex("specialty_templates_tenant_key_unique").on(t.tenantId, t.key),
}));

export const customFieldDefinitions = pgTable("custom_field_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  specialtyKey: text("specialty_key").notNull(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  fieldType: customFieldTypeEnum("field_type").notNull(),
  options: jsonb("options"),
  required: boolean("required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("custom_field_definitions_tenant_idx").on(t.tenantId),
  specialtyIdx: index("custom_field_definitions_specialty_idx").on(t.tenantId, t.specialtyKey),
}));

// ---------------------------------------------------------------------------
// Treatment catalog — the procedures a tenant offers (e.g. LASIK, PRK, CXL),
// attached to a specialty by plain-text key exactly like custom_field_definitions.
// Rows are never hard-deleted (toggle is_active) so historical treatments keep
// their link. default_estimated_value is a demo/price-list hint, not billing.
// ---------------------------------------------------------------------------

export const treatmentDefinitions = pgTable("treatment_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  specialtyKey: text("specialty_key").notNull(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  defaultEstimatedValue: integer("default_estimated_value"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantSpecialtyIdx: index("treatment_definitions_tenant_specialty_idx").on(t.tenantId, t.specialtyKey),
  tenantKeyUnique: uniqueIndex("treatment_definitions_tenant_key_unique").on(t.tenantId, t.key),
}));

export const customFieldValues = pgTable("custom_field_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  journeyId: uuid("journey_id").notNull().references(() => journeys.id),
  fieldDefinitionId: uuid("field_definition_id").notNull().references(() => customFieldDefinitions.id),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  journeyIdx: index("custom_field_values_journey_idx").on(t.journeyId),
  journeyFieldUnique: uniqueIndex("custom_field_values_journey_field_unique").on(t.journeyId, t.fieldDefinitionId),
}));
