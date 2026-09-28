export type Role = "SUPER_ADMIN" | "HOSPITAL_ADMIN" | "FRONT_DESK" | "PATIENT_COORDINATOR" | "DOCTOR";

export interface SessionUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null;
  branchName: string | null;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
}

// ---------------------------------------------------------------------------
// Permissions — the single source of truth for what each role may do.
// Enforced server-side (Fastify preHandler); the UI uses the same map only to
// avoid showing dead navigation, never as the actual authorization boundary.
// ---------------------------------------------------------------------------

export type Permission =
  | "VIEW_ADMIN_COMMAND_CENTRE"
  | "VIEW_DOCTOR_COMMAND_CENTRE"
  | "VIEW_PATIENTS"
  | "EDIT_PATIENTS"
  | "VIEW_JOURNEYS"
  | "MANAGE_JOURNEYS"
  | "VIEW_APPOINTMENTS"
  | "MANAGE_APPOINTMENTS"
  | "RECORD_CONSULTATION_OUTCOME"
  | "VIEW_TREATMENT"
  | "MANAGE_TREATMENT"
  | "VIEW_REVENUE"
  | "VIEW_MARKETING"
  | "VIEW_INBOX"
  | "MANAGE_INBOX"
  | "VIEW_TASKS"
  | "MANAGE_TASKS"
  | "VIEW_INTEGRATIONS"
  | "MANAGE_INTEGRATIONS"
  | "VIEW_COMMUNICATION_ENDPOINTS"
  | "MANAGE_LEADS"
  | "MANAGE_SPECIALTIES";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "VIEW_ADMIN_COMMAND_CENTRE", "VIEW_PATIENTS", "EDIT_PATIENTS", "VIEW_JOURNEYS", "MANAGE_JOURNEYS",
    "VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS", "RECORD_CONSULTATION_OUTCOME", "VIEW_TREATMENT", "MANAGE_TREATMENT",
    "VIEW_REVENUE", "VIEW_MARKETING", "VIEW_INBOX", "MANAGE_INBOX", "VIEW_TASKS", "MANAGE_TASKS",
    "VIEW_INTEGRATIONS", "MANAGE_INTEGRATIONS", "VIEW_COMMUNICATION_ENDPOINTS", "MANAGE_LEADS", "MANAGE_SPECIALTIES",
  ],
  HOSPITAL_ADMIN: [
    "VIEW_ADMIN_COMMAND_CENTRE", "VIEW_PATIENTS", "EDIT_PATIENTS", "VIEW_JOURNEYS", "MANAGE_JOURNEYS",
    "VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS", "VIEW_TREATMENT", "MANAGE_TREATMENT",
    "VIEW_REVENUE", "VIEW_MARKETING", "VIEW_INBOX", "MANAGE_INBOX", "VIEW_TASKS", "MANAGE_TASKS",
    "VIEW_INTEGRATIONS", "MANAGE_INTEGRATIONS", "VIEW_COMMUNICATION_ENDPOINTS", "MANAGE_LEADS", "MANAGE_SPECIALTIES",
  ],
  FRONT_DESK: [
    "VIEW_PATIENTS", "EDIT_PATIENTS", "VIEW_JOURNEYS", "VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS",
    "VIEW_INBOX", "MANAGE_INBOX", "VIEW_TASKS", "MANAGE_TASKS", "VIEW_COMMUNICATION_ENDPOINTS", "MANAGE_LEADS",
  ],
  PATIENT_COORDINATOR: [
    "VIEW_PATIENTS", "EDIT_PATIENTS", "VIEW_JOURNEYS", "MANAGE_JOURNEYS", "VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS",
    "VIEW_TREATMENT", "MANAGE_TREATMENT", "VIEW_REVENUE", "VIEW_INBOX", "MANAGE_INBOX", "VIEW_TASKS", "MANAGE_TASKS", "VIEW_COMMUNICATION_ENDPOINTS", "MANAGE_LEADS",
  ],
  DOCTOR: [
    "VIEW_DOCTOR_COMMAND_CENTRE", "VIEW_PATIENTS", "VIEW_JOURNEYS", "VIEW_APPOINTMENTS",
    "RECORD_CONSULTATION_OUTCOME", "VIEW_TREATMENT", "VIEW_TASKS",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export interface TodayStrip {
  newEnquiries: number;
  appointmentsToday: number;
  waitingNow: number;
  consultationsCompleted: number;
  treatmentDecisionsPending: number;
  attributedRevenue: number;
}

export type JourneyHealthKey = "contacted" | "booked" | "attended" | "consulted" | "treatment_advised";

export interface JourneyHealthSegment {
  key: JourneyHealthKey;
  label: string;
  count: number;
  pct: number;
}

export interface JourneyHealth {
  segments: JourneyHealthSegment[];
  totalJourneys: number;
  overallPct: number;
}

export type ConversionStageKey =
  | "enquiry"
  | "contacted"
  | "booked"
  | "attended"
  | "consulted"
  | "treatment_advised"
  | "scheduled"
  | "completed";

export interface ConversionStage {
  key: ConversionStageKey;
  label: string;
  count: number;
  /** total attributed campaign spend / count, only computed for stages where it's meaningful; null elsewhere or on zero count */
  costPerOutcome: number | null;
}

export type PatientFlowBucket = "confirmed" | "checked_in" | "waiting" | "with_doctor" | "completed";

export interface PatientFlowCount {
  bucket: PatientFlowBucket;
  count: number;
}

export type AttentionReason =
  | "overdue_callback"
  | "missed_follow_up"
  | "no_show"
  | "high_intent_uncontacted"
  | "treatment_decision_pending";

export interface AttentionItem {
  id: string;
  patientName: string;
  journeyType: string;
  reason: AttentionReason;
  dueAt: string;
  ownerName: string | null;
}

export type SourceChannel = "meta" | "google" | "website" | "whatsapp" | "phone" | "walk_in" | "referral" | "organic" | "other";

export interface SourcePerformanceRow {
  campaignId: string | null;
  campaignName: string;
  source: SourceChannel;
  spend: number;
  enquiries: number;
  appointments: number;
  consultations: number;
  treatments: number;
  revenue: number;
  roas: number | null;
  // A synced campaign's spend/performance numbers are only as real as the
  // connector that produced them — null for a manually-created campaign
  // that was never synced from a provider (the question doesn't apply).
  connectorMode: ConnectorMode | null;
}

export interface ExecutiveStrip {
  marketingSpend: number;
  enquiries: number;
  consultations: number;
  treatmentsCompleted: number;
  attributedRevenue: number;
  roas: number | null;
  spendAtRisk: number;
}

export type SpendAtRiskCategoryKey =
  | "uncontacted"
  | "overdue_follow_up"
  | "no_show_recovery"
  | "treatment_decision_pending"
  | "post_consultation_follow_up_overdue";

export interface SpendAtRiskCategory {
  key: SpendAtRiskCategoryKey;
  label: string;
  journeyCount: number;
  allocatedSpend: number;
  oldestAgeDays: number;
}

export interface SpendAtRiskSummary {
  total: number;
  categories: SpendAtRiskCategory[];
}

// MarketingSourceRow is the flatter, non-campaign-scoped sibling of
// SourcePerformanceRow used by the Command Centre's Source Performance
// table; SpendAtRisk/SpendAtRiskReasonRow is the reason-bucketed sibling
// of SpendAtRiskSummary/SpendAtRiskCategory used by that same dashboard.
// Both pairs are kept — Group Q reconciles which one each surface uses.
export interface MarketingSourceRow {
  source: SourceChannel;
  volume: number;
  appointments: number;
  consultations: number;
  treatmentConversion: number;
  revenue: number;
  spend: number;
  roas: number | null;
}

export interface SpendAtRiskReasonRow {
  reason: AttentionReason;
  count: number;
  estimatedValue: number;
}

export interface SpendAtRisk {
  totalAtRisk: number;
  byReason: SpendAtRiskReasonRow[];
}

export interface TeamWorkloadRow {
  userId: string;
  name: string;
  role: Role;
  openTasks: number;
  overdueTasks: number;
}

export interface BranchDoctorRow {
  id: string;
  name: string;
  kind: "branch" | "doctor";
  appointments: number;
  waitingLoad: number;
  consultations: number;
}

export interface DoctorNextPatient {
  appointmentId: string;
  patientName: string;
  journeyType: string;
  appointmentTime: string;
  reason: string | null;
}

export type AppointmentStatus =
  | "requested"
  | "scheduled" // DB-level synonym for BOOKED
  | "confirmed"
  | "checked_in"
  | "waiting"
  | "with_doctor"
  | "completed"
  | "no_show"
  | "cancelled";

export interface DoctorTodayItem {
  appointmentId: string;
  patientName: string;
  time: string;
  status: AppointmentStatus;
}

export interface DoctorRecentPatient {
  appointmentId: string;
  patientName: string;
  journeyType: string;
  time: string;
}

export interface DoctorDashboard {
  todayCount: number;
  checkedInCount: number;
  waitingNow: number;
  withMeCount: number;
  completionPct: number;
  nextPatient: DoctorNextPatient | null;
  today: DoctorTodayItem[];
  awaitingOutcome: DoctorTodayItem[];
  treatmentFollowUps: DoctorTodayItem[];
  postCare: DoctorTodayItem[];
  recentPatients: DoctorRecentPatient[];
}

export type ConsultationOutcomeValue =
  | "CONSULTED"
  | "TREATMENT_ADVISED"
  | "NO_TREATMENT_REQUIRED"
  | "DECISION_PENDING"
  | "FOLLOW_UP_REQUIRED"
  | "REFERRED"
  | "OTHER";

export interface RecordOutcomeInput {
  appointmentId: string;
  outcome: ConsultationOutcomeValue;
  notes?: string;
  treatmentLabel?: string;
  estimatedValue?: number;
}

export type JourneyStage = ConversionStageKey | "lost";

export interface PatientListRow {
  id: string;
  name: string;
  phone: string;
  branchName: string | null;
  activeJourneyCount: number;
  currentJourneyType: string | null;
  currentStage: JourneyStage | null;
  source: SourceChannel | null;
  lastInteractionAt: string | null;
  nextActionDueAt: string | null;
  ownerName: string | null;
  appointmentStatus: string | null;
}

// Deliberately minimal — the global-search typeahead's own lightweight query,
// not a reuse of PatientListRow (which joins journeys/tasks/timeline tenant-wide
// for the Patients table and would be a full-directory fetch on every keystroke).
export interface PatientSearchRow {
  id: string;
  name: string;
  phone: string;
  currentJourneyType: string | null;
  currentStage: JourneyStage | null;
}

export interface JourneyCustomFieldVm {
  label: string;
  value: string;
}

export interface JourneyCardVm {
  id: string;
  journeyType: string;
  stage: JourneyStage;
  source: SourceChannel;
  ownerName: string | null;
  nextActionDueAt: string | null;
  appointmentTime: string | null;
  appointmentStatus: string | null;
  doctorName: string | null;
  treatmentStatus: string | null;
  treatmentLabel: string | null;
  lastInteractionAt: string | null;
  /** Specialty custom field values captured for this journey (e.g. "Eye
   * Concern: Cataract" for Ophthalmology) — includes values whose field
   * definition has since been archived, so a historical record is never
   * lost from view just because Settings later retired that field. */
  customFields: JourneyCustomFieldVm[];
}

export type CallDirection = "inbound" | "outbound";
export type CallStatus = "completed" | "missed" | "no_answer" | "busy" | "failed";

// A telephony connector (Runo today) has been writing real call records
// since its webhook was built, but until now nothing ever read them back —
// no API route existed at all. Deliberately a flat read-model, not the
// `calls` table's raw shape: no tenantId/connectorId (irrelevant once
// scoped to a patient), no raw provider metadata (that stays server-side).
export interface CallVm {
  id: string;
  journeyId: string | null;
  provider: string;
  connectorMode: ConnectorMode;
  direction: CallDirection;
  phone: string;
  status: CallStatus;
  durationSeconds: number | null;
  recordingUrl: string | null;
  disposition: string | null;
  agentName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  // Best-effort only: Runo's real API never tells you which hospital line a
  // call used (confirmed against their live OpenAPI spec) — this resolves
  // only when the connector has exactly one configured CommunicationEndpoint
  // (an unambiguous default), never guessed among several. Null otherwise.
  endpointLabel: string | null;
}

// Previously defined three times (apps/api/src/domain/timeline/timeline.service.ts,
// packages/api-client, packages/ui/src/Timeline.tsx) — genuinely identical
// copies that had already drifted once (relatedEntityType/relatedEntityId
// existed on the DB row and were set by treatment/call event writers, but
// none of the three copies exposed them, so a Timeline event could point at
// its own source row and nothing could ever follow that pointer).
export interface TimelineEventVm {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  sourceChannel: string | null;
  occurredAt: string;
  category: "communication" | "appointments" | "clinical" | "tasks" | "other";
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  // Which hospital phone/WhatsApp line this communication event happened on
  // — resolved from the same communicationEndpointId already stamped on the
  // related `calls`/`conversations` row (see CallVm.endpointLabel), never a
  // fresh guess. Null whenever that row has no resolved endpoint, or the
  // event isn't a call/conversation at all.
  endpointLabel: string | null;
}

export interface Patient360 {
  patient: {
    id: string;
    name: string;
    phone: string;
    preferredLanguage: string;
    branchName: string | null;
  };
  journeys: JourneyCardVm[];
  calls: CallVm[];
  acquisition: {
    source: SourceChannel | null;
    campaignName: string | null;
    firstTouchAt: string | null;
    allocatedAcquisitionCost: number | null;
    estimatedTreatmentValue: number;
    attributedRevenue: number;
    // Full multi-touch context — lastTouch is null when the journey has
    // only ever had the one (first) touch.
    touchpointCount: number;
    lastTouch: { source: SourceChannel | null; campaignName: string | null; occurredAt: string } | null;
  };
}

export interface JourneyListRow {
  id: string;
  patientId: string;
  patientName: string;
  journeyType: string;
  source: SourceChannel;
  campaignName: string | null;
  stage: JourneyStage;
  branchName: string | null;
  doctorName: string | null;
  ownerName: string | null;
  lastActivityAt: string;
  nextActionDueAt: string | null;
  acquisitionCost: number | null;
  treatmentValue: number;
}

export interface JourneysSummary {
  activeJourneys: number;
  appointmentsPending: number;
  consultationsPending: number;
  treatmentDecisionsPending: number;
  revenueOpportunity: number;
  spendAtRisk: number;
}

// ---------------------------------------------------------------------------
// Tasks / Follow-ups / My Work (Group L)
// ---------------------------------------------------------------------------

export type TaskType = "CALLBACK" | "FOLLOW_UP" | "APPOINTMENT_CONFIRMATION" | "NO_SHOW_RECOVERY" | "TREATMENT_DECISION" | "POST_CARE" | "RECALL" | "OTHER";
export type TaskPriority = "normal" | "high";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
// "unassigned" is the team-attention surface for system-generated tasks that
// had no journey owner at creation time (assignedTo null) — visible only to
// MANAGE_TASKS roles (task.routes.ts forces a VIEW_TASKS-only caller's
// assignedTo to themselves regardless of view, which combined with this
// view's "assignedTo IS NULL" condition always yields an empty result for
// them, never a tenant-wide unassigned queue).
export type TaskView = "today" | "overdue" | "upcoming" | "completed" | "unassigned";
// Why a task exists — distinct from `type` (what action it is). Written by
// the specific service that creates each kind of task; "manual_task" is the
// DB default for anything created without an explicit reason.
export type TaskReason = "overdue_callback" | "missed_follow_up" | "no_show" | "high_intent_uncontacted" | "treatment_decision_pending" | "manual_task" | "new_lead";

export interface TaskRow {
  id: string;
  patientId: string;
  patientName: string;
  journeyId: string | null;
  journeyType: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  reason: TaskReason;
  notes: string | null;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface TaskCounts {
  mine: number;
  overdue: number;
  today: number;
  upcoming: number;
  completed: number;
  // Tenant-wide unassigned actionable tasks — only computed for callers with
  // MANAGE_TASKS (see task.routes.ts); omitted (undefined) for everyone else.
  unassigned?: number;
}

export interface CreateTaskInput {
  patientId: string;
  journeyId?: string;
  assignedTo?: string;
  type: TaskType;
  priority?: TaskPriority;
  notes?: string;
  dueAt: string;
}

// ---------------------------------------------------------------------------
// Appointments / Front Desk (Group M)
// ---------------------------------------------------------------------------

export interface AppointmentRow {
  id: string;
  patientId: string;
  patientName: string;
  journeyId: string;
  branchName: string | null;
  doctorId: string;
  doctorName: string | null;
  status: AppointmentStatus;
  scheduledAt: string;
  reason: string | null;
}

export type AppointmentAction = "confirm" | "check_in" | "mark_waiting" | "send_to_doctor" | "mark_no_show" | "cancel";

export interface CreatePatientInput {
  name: string;
  phone: string;
  email?: string;
  preferredLanguage?: string;
  branchId: string;
}

export interface CreatePatientResult {
  patientId: string;
  isNewPatient: boolean;
}

export interface CreateAppointmentInput {
  patientId: string;
  journeyId: string;
  branchId: string;
  doctorId: string;
  scheduledAt: string;
  reason?: string;
}

export interface FrontDeskDashboard {
  today: AppointmentRow[];
  arrivals: AppointmentRow[];
  waitingQueue: AppointmentRow[];
  noShows: AppointmentRow[];
  pendingConfirmations: AppointmentRow[];
}

// ---------------------------------------------------------------------------
// Treatment (Group N)
// ---------------------------------------------------------------------------

export type TreatmentStatus = "ADVISED" | "DECISION_PENDING" | "ACCEPTED" | "SCHEDULED" | "COMPLETED" | "DECLINED" | "CANCELLED" | "LOST";

export interface TreatmentRow {
  id: string;
  patientId: string;
  patientName: string;
  journeyId: string;
  doctorName: string | null;
  treatmentLabel: string;
  estimatedValue: number;
  status: TreatmentStatus;
  ownerName: string | null;
  nextActionDueAt: string | null;
  lastContactAt: string | null;
  plannedDate: string | null;
}

// ---------------------------------------------------------------------------
// Inbox (Group P)
// ---------------------------------------------------------------------------

export type ConversationChannel = "WHATSAPP" | "CALL" | "SMS" | "EMAIL" | "INTERNAL";
export type OwnershipState = "AI_ACTIVE" | "HUMAN_REQUIRED" | "HUMAN_ASSIGNED" | "HUMAN_ACTIVE" | "AI_RESUME_PENDING" | "CLOSED";

// Configuration/scheduling preference only — PulseOS has no agent runtime yet
// to act on "ai_when_available" or "ai_scheduled". This records what a human
// has asked for, honestly labeled as config, never as something executing.
export type ConversationAutomationMode = "manual" | "ai_when_available" | "ai_scheduled";

export interface ConversationAutomationPreference {
  mode: ConversationAutomationMode;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  timezone: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface ConversationRow {
  id: string;
  patientId: string;
  patientName: string;
  channel: ConversationChannel;
  lastMessage: string | null;
  lastMessageAt: string;
  unreadCount: number;
  ownerName: string | null;
  ownershipState: OwnershipState;
  // Which hospital WhatsApp number this thread came in on — resolved from the
  // real per-message `metadata.phone_number_id` Meta sends (see
  // CommunicationEndpointVm) — null when unresolved (no matching endpoint
  // configured yet) or for non-WhatsApp channels.
  endpointLabel: string | null;
}

export interface MessageRow {
  id: string;
  senderType: "patient" | "staff" | "ai" | "system";
  senderName: string | null;
  body: string;
  sentAt: string;
}

export interface ConversationDetail {
  conversation: ConversationRow;
  messages: MessageRow[];
  patientContext: {
    patientId: string;
    journeyType: string | null;
    stage: JourneyStage | null;
    ownerName: string | null;
    appointmentTime: string | null;
    lastInteractionAt: string | null;
    nextActionDueAt: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Lookups (filter dropdown data)
// ---------------------------------------------------------------------------

export interface LookupOption {
  id: string;
  name: string;
}

export interface CampaignOption {
  id: string;
  name: string;
  source: SourceChannel;
}

export interface Lookups {
  branches: LookupOption[];
  doctors: LookupOption[];
  owners: LookupOption[];
  campaigns: CampaignOption[];
}

// ---------------------------------------------------------------------------
// Coordinator "My Work" dashboard
// ---------------------------------------------------------------------------

export interface CoordinatorDashboard {
  treatmentDecisionsPending: TreatmentRow[];
  overdueTasks: TaskRow[];
  todayTasks: TaskRow[];
  postCareDue: TaskRow[];
}

// ---------------------------------------------------------------------------
// Connectors (Group R) — provider-neutral integration configuration.
// ---------------------------------------------------------------------------

export type ConnectorType = "MESSAGING" | "TELEPHONY" | "ADS" | "EMAIL" | "STORAGE" | "HIS" | "ACQUISITION";
export type ConnectorStatus = "NOT_CONFIGURED" | "CONNECTING" | "CONNECTED" | "DEGRADED" | "ERROR" | "DISABLED";
// FIXTURE/SANDBOX/LIVE — never inferred, always the connector's actual
// provenance, so the UI can never visually imply a live production
// connection for a connector that is actually fixture- or sandbox-backed.
export type ConnectorMode = "FIXTURE" | "SANDBOX" | "LIVE";
export type ConnectorCapability =
  | "SEND_MESSAGE"
  | "RECEIVE_MESSAGE"
  | "RECEIVE_STATUS"
  | "INITIATE_CALL"
  | "RECEIVE_CALL_EVENT"
  | "FETCH_RECORDING"
  | "RECEIVE_RECORDING"
  | "RECEIVE_TRANSCRIPT"
  | "RECEIVE_LEAD"
  | "SYNC_CAMPAIGNS"
  | "SYNC_AD_GROUPS"
  | "SYNC_ADS"
  | "SYNC_SPEND"
  | "SYNC_PERFORMANCE"
  | "RECEIVE_FORM"
  | "EXPORT_CONVERSION";

export interface ConnectorRow {
  id: string;
  type: ConnectorType;
  provider: string;
  displayName: string;
  status: ConnectorStatus;
  mode: ConnectorMode;
  capabilities: ConnectorCapability[];
  hasSecrets: boolean;
  lastSyncAt: string | null;
  lastEventAt: string | null;
  lastError: string | null;
}

export interface ConnectorEventRow {
  id: string;
  externalEventId: string;
  direction: "inbound" | "outbound";
  status: "received" | "processed" | "failed" | "duplicate";
  error: string | null;
  receivedAt: string;
}

export interface ConnectorDetail {
  connector: ConnectorRow;
  configuration: Record<string, unknown> | null;
  recentEvents: ConnectorEventRow[];
}

export type CommunicationEndpointType = "PHONE" | "WHATSAPP";

// The N-hospital-numbers-per-1-connector layer (a WABA can hold many
// phone_number_ids; a Runo integration can cover several SIM lines) — see
// docs/superpowers/specs/2026-09-22-pulseos-omnichannel-implementation-contract.md
// for the full design. `providerRef` is provider-verified for WhatsApp
// (Meta's own phone_number_id, present on every webhook) but only a
// manual/admin-assigned label for Runo, which never exposes which line a
// call used — never silently treated as provider-confirmed for Runo.
export interface CommunicationEndpointVm {
  id: string;
  connectorId: string;
  connectorProvider: string;
  branchId: string | null;
  branchName: string | null;
  type: CommunicationEndpointType;
  provider: string;
  publicNumber: string;
  providerRef: string;
  displayLabel: string;
  isActive: boolean;
}

export interface CreateCommunicationEndpointInput {
  connectorId: string;
  branchId?: string | null;
  type: CommunicationEndpointType;
  publicNumber: string;
  providerRef: string;
  displayLabel: string;
}

export interface UpdateCommunicationEndpointInput {
  branchId?: string | null;
  displayLabel?: string;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Specialty templates + custom fields (CRM-7/8) — per-tenant configuration
// of specialty enquiry fields, rendered in the Add Lead drawer.
// ---------------------------------------------------------------------------

export type CustomFieldType = "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT" | "MULTI_SELECT" | "PHONE";

export interface CustomFieldDefinitionVm {
  id: string;
  specialtyKey: string;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options: string[] | null;
  required: boolean;
  sortOrder: number;
  archived: boolean;
}

export interface SpecialtyTemplateVm {
  key: string;
  displayName: string;
  defaultJourneyType: string;
  enabled: boolean;
  sortOrder: number;
  fieldCount: number;
}

export interface SpecialtyDetailVm extends SpecialtyTemplateVm {
  fields: CustomFieldDefinitionVm[];
}

export interface UpdateSpecialtyInput {
  displayName?: string;
  defaultJourneyType?: string;
  enabled?: boolean;
}

export interface CreateCustomFieldInput {
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options?: string[];
  required?: boolean;
}

export interface UpdateCustomFieldInput {
  label?: string;
  required?: boolean;
  archived?: boolean;
  sortOrder?: number;
  options?: string[];
}

// ---------------------------------------------------------------------------
// Leads (CRM-2/3/4) — Lead is a VIEW over Patient + Journey, not a separate
// identity model. Creating a Lead resolves-or-creates a Patient, then always
// creates a new Journey representing the enquiry.
// ---------------------------------------------------------------------------

export type LeadStatus = "new" | "uncontacted" | "follow_up_due" | "appointment_booked" | "no_response" | "converted" | "lost";

export interface LeadRow {
  id: string; // journey id
  patientId: string;
  patientName: string;
  phone: string;
  specialtyKey: string | null;
  specialtyLabel: string | null;
  source: SourceChannel;
  campaignName: string | null;
  stage: JourneyStage;
  leadStatus: LeadStatus;
  ownerName: string | null;
  priority: TaskPriority;
  lastInteractionAt: string | null;
  nextActionDueAt: string | null;
  createdAt: string;
}

export interface LeadsSummary {
  newToday: number;
  uncontacted: number;
  followUpsDue: number;
  appointmentsBooked: number;
  noResponse: number;
  converted: number;
}

export interface LeadPhoneLookupResult {
  patient: { id: string; name: string; phone: string; activeJourneyCount: number } | null;
}

export interface CreateLeadFollowUp {
  type: TaskType;
  dueAt: string;
  assignedTo?: string;
}

export interface CreateLeadInput {
  patientId?: string;
  name: string;
  phone: string;
  email?: string;
  preferredLanguage?: string;
  specialtyKey: string;
  branchId: string;
  doctorId?: string;
  source: SourceChannel;
  campaignId?: string;
  journeyType: string;
  ownerId?: string;
  priority?: TaskPriority;
  notes?: string;
  customFieldValues?: Record<string, unknown>;
  followUp?: CreateLeadFollowUp | null;
}

export interface CreateLeadResult {
  patientId: string;
  journeyId: string;
  isNewPatient: boolean;
}

// ---------------------------------------------------------------------------
// Campaigns / Sources + Marketing Efficiency (CRM-9/10)
// ---------------------------------------------------------------------------

export interface CampaignPerformanceRow {
  campaignId: string | null;
  campaignName: string;
  source: SourceChannel;
  specialtyKey: string | null;
  specialtyLabel: string | null;
  spend: number;
  leads: number;
  appointments: number;
  consultations: number;
  treatmentAdvised: number;
  treatmentCompleted: number;
  revenue: number;
  cpl: number | null;
  costPerAppointment: number | null;
  costPerTreatment: number | null;
  roas: number | null;
  // A synced campaign's numbers are only as real as the connector that
  // produced them — null for a manually-created campaign that was never
  // synced from a provider (the question doesn't apply). See SourcePerformanceRow.
  connectorMode: ConnectorMode | null;
}

export interface MarketingEfficiencySummary {
  spend: number;
  leads: number;
  appointments: number;
  consultations: number;
  treatments: number;
  revenue: number;
  roas: number | null;
  cpl: number | null;
  costPerAppointment: number | null;
  costPerTreatment: number | null;
}

export interface CampaignFilters {
  branchId?: string;
  specialtyKey?: string;
  source?: SourceChannel;
  campaignId?: string;
  // Inclusive ISO date range (YYYY-MM-DD), applied to the touchpoint's
  // occurredAt — i.e. "leads attributed to this campaign in this window",
  // not campaign start/end date.
  dateFrom?: string;
  dateTo?: string;
}
