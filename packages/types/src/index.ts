export type Role = "SUPER_ADMIN" | "HOSPITAL_ADMIN" | "FRONT_DESK" | "PATIENT_COORDINATOR" | "DOCTOR";

export interface SessionUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null;
  branchName: string | null;
  /** Hospital IANA timezone (tenants.timezone) — every "today" and day boundary uses it. */
  timezone: string;
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
  /** The task id — not a patient id. Link through patientId/journeyId. */
  id: string;
  patientId: string;
  journeyId: string | null;
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

/** One service line (journey type) — journeys, pipeline and revenue together. */
export interface ServiceMixRow {
  service: string;
  journeys: number;
  /** Not yet completed or lost. */
  activeJourneys: number;
  /** Advised, decision pending, accepted or scheduled. */
  treatmentsInPipeline: number;
  treatmentsCompleted: number;
  revenue: number;
}

export interface DoctorNextPatient {
  appointmentId: string;
  patientName: string;
  journeyType: string;
  appointmentTime: string;
  reason: string | null;
  /** For Patient 360 / Journey links. Always set by GET /dashboard/doctor. */
  patientId?: string;
  journeyId?: string;
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
  /** Always set by GET /dashboard/doctor; optional so hand-built fixtures stay valid. */
  patientId?: string;
  journeyId?: string;
  /** Service line of the appointment's journey (e.g. "Laser Vision Correction"). */
  journeyType?: string;
  /** Journey specialty key — matches TreatmentDefinitionVm.specialtyKey, so a row can be offered only its own service's catalog procedures. */
  specialtyKey?: string | null;
}

export interface DoctorRecentPatient {
  appointmentId: string;
  patientName: string;
  /** For Patient 360 links. Always set by GET /dashboard/doctor. */
  patientId?: string;
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
  /** Free-text fallback; ignored (replaced by the catalog label) when treatmentDefinitionId is sent. */
  treatmentLabel?: string;
  /** Catalog procedure (must be an active entry of the caller's tenant, else 422 invalid_treatment_definition). */
  treatmentDefinitionId?: string;
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

// --- P2 view additions ---
// Patient 360 "Upcoming": a read-only projection of EXISTING records for one
// patient (no new data concept). Items span every journey the patient has.
export type PatientUpcomingKind = "appointment" | "task" | "treatment";

export interface PatientUpcomingItem {
  kind: PatientUpcomingKind;
  /** The source record's id (appointment / task / treatment opportunity). */
  id: string;
  /** ISO instant: appointment scheduledAt, task dueAt, treatment plannedDate. */
  at: string;
  /** appointment: its reason (may be null); task: its TaskType; treatment: its label. */
  label: string | null;
  /** AppointmentStatus / TaskStatus / TreatmentStatus of the source record. */
  status: string;
  /** Only an open task can be overdue (its due time has passed). */
  overdue: boolean;
  journeyId: string | null;
  journeyType: string | null;
  /** appointment: doctor; task: assignee; treatment: owner. */
  personName: string | null;
}

export interface PatientUpcoming {
  /** Hospital (tenant) IANA timezone the UI must group days in. */
  timezone: string;
  items: PatientUpcomingItem[];
}
// --- end P2 view additions ---

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

export interface RevenueEventVm {
  id: string;
  amount: number;
  currency: string;
  type: "consultation_fee" | "treatment_payment" | "other";
  occurredAt: string;
  treatmentOpportunityId: string | null;
}

/**
 * Journey Detail read-model (GET /journeys/:id). Journey-scoped: one Journey
 * of a Patient, never the Patient's whole record (Patient != Journey).
 *
 * Visibility rules (all enforced server-side, see journey.routes.ts):
 *  - `tasks` for a caller WITHOUT MANAGE_TASKS contains only tasks assigned to
 *    that caller (task notes are PHI-adjacent).
 *  - `treatments` is `null` without VIEW_TREATMENT; `revenue` is `null`
 *    without VIEW_REVENUE. `null` means "not permitted", an empty result means
 *    "none exist".
 */
export interface JourneyDetailVm {
  patient: { id: string; name: string; phone: string; branchName: string | null };
  journey: {
    id: string;
    journeyType: string;
    stage: JourneyStage;
    source: SourceChannel;
    campaign: { id: string; name: string } | null;
    owner: { id: string; name: string } | null;
    doctorName: string | null;
    createdAt: string;
    lastInteractionAt: string;
    /** Nearest-due open task on this journey (any assignee); type label + due date only, never notes. */
    nextAction: { dueAt: string; label: string } | null;
  };
  customFields: JourneyCustomFieldVm[];
  timeline: TimelineEventVm[];
  tasks: TaskRow[];
  appointments: AppointmentRow[];
  treatments: TreatmentRow[] | null;
  revenue: { total: number; events: RevenueEventVm[] } | null;
}

/** PATCH /journeys/:id/owner — null unassigns. */
export interface AssignJourneyOwnerInput {
  ownerUserId: string | null;
}

/** POST /journeys/owner — 1..100 journeys, all-or-nothing. */
export interface BulkAssignJourneyOwnerInput {
  journeyIds: string[];
  ownerUserId: string | null;
}

export interface BulkAssignJourneyOwnerResult {
  updatedCount: number;
  journeyIds: string[];
  owner: { id: string; name: string } | null;
}

/** `owner` list filter: the session user's own, unowned, or a specific user id. */
export type OwnerFilterValue = "mine" | "unassigned" | (string & {});

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
  /** Acquisition source of the owning Journey (null for a task with no Journey). */
  source?: SourceChannel | null;
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
  /** Real check-in time (from the Timeline) — only populated for Front Desk waiting-queue rows. */
  arrivedAt?: string | null;
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

// --- P1 view additions ---
/** GET /appointments/calendar-context: the hospital's IANA zone and its current local day (YYYY-MM-DD). */
export interface AppointmentCalendarContext {
  timezone: string;
  today: string;
}

/** GET /appointments filters incl. the inclusive local-day range (tenant timezone) the calendar views use. */
export interface AppointmentRangeFilters {
  branchId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  date?: string;
  from?: string;
  to?: string;
}
// --- end P1 view additions ---

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
  /** Service line of the treatment's journey (journey type, e.g. "Laser Vision Correction"). Always set by GET /treatments. */
  service?: string | null;
  /** Catalog procedure this treatment is an instance of; null for free-text/legacy rows. Always set by GET /treatments. */
  treatmentDefinitionId?: string | null;
  estimatedValue: number;
  status: TreatmentStatus;
  ownerName: string | null;
  nextActionDueAt: string | null;
  lastContactAt: string | null;
  plannedDate: string | null;
}

/** GET /treatments query. service = journey type; doctorId = doctor of the journey's latest appointment. */
export interface TreatmentFilters {
  status?: TreatmentStatus;
  ownerId?: string;
  doctorId?: string;
  service?: string;
  treatmentDefinitionId?: string;
}

/** One procedure in the tenant's treatment catalog (GET /treatment-catalog — active entries only). */
export interface TreatmentDefinitionVm {
  id: string;
  specialtyKey: string;
  key: string;
  label: string;
  /** Demo/price-list hint used when an outcome doesn't state a value; null = no default. */
  defaultEstimatedValue: number | null;
  sortOrder: number;
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
  ownerId: string | null;
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

// --- P3 view additions ---
export type CampaignRunStatus = "active" | "paused" | "ended";
/**
 * A /campaigns/performance row plus the campaign's run window, so the Campaigns
 * Table, Calendar and Timeline views all render ONE query. `endDate: null` means
 * the campaign is ongoing — an end date is never invented.
 */
export interface CampaignViewRow extends CampaignPerformanceRow {
  campaignId: string;
  /** ISO instant. */
  startDate: string;
  /** ISO instant, or null while the campaign is ongoing. */
  endDate: string | null;
  campaignStatus: CampaignRunStatus;
}
// --- end P3 view additions ---

// ---------------------------------------------------------------------------
// Analytics workspace (/analytics) — historical, comparative, filter-driven.
// One AnalyticsQuery scopes every endpoint so every panel agrees.
// ---------------------------------------------------------------------------

export type AnalyticsRangePreset = "7d" | "14d" | "30d" | "90d" | "custom";

export interface AnalyticsQuery {
  range?: AnalyticsRangePreset;
  /** Inclusive local (hospital-timezone) dates YYYY-MM-DD, used when range = "custom". */
  from?: string;
  to?: string;
  branchId?: string;
  /** Service line = journey type, e.g. "Cataract". */
  service?: string;
  source?: SourceChannel;
  campaignId?: string;
}

export type AnalyticsGranularity = "day" | "week";

export interface AnalyticsPeriod {
  preset: AnalyticsRangePreset;
  /** Inclusive first / last local day, YYYY-MM-DD, in `timezone`. */
  from: string;
  to: string;
  days: number;
  /** The immediately preceding period of the same length. */
  previousFrom: string;
  previousTo: string;
  /** IANA zone every bucket is grouped in (tenants.timezone). */
  timezone: string;
  /** The tenant-local day at request time. A bucket containing it is still in progress. */
  today: string;
}

/** One chart bucket: a local day, or a 7-day block anchored at the period start (last block may be partial). */
export interface AnalyticsBucket {
  /** First local day of the bucket, YYYY-MM-DD. */
  key: string;
  /** Last local day inside both the bucket and the period. */
  to: string;
  days: number;
  partial: boolean;
}

export interface LeadsBucket extends AnalyticsBucket {
  total: number;
  bySource: Partial<Record<SourceChannel, number>>;
  /** Leads in the same-offset bucket of the previous period; null when it has no counterpart. */
  previousTotal: number | null;
}

export interface LeadsBySourceResponse {
  period: AnalyticsPeriod;
  granularity: AnalyticsGranularity;
  /** Only sources that occur in the period, in canonical order. */
  sources: SourceChannel[];
  buckets: LeadsBucket[];
  total: number;
  previousTotal: number;
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  leads: number;
  previousLeads: number;
  /** Leads that reached at least the appointment-booked stage. */
  appointments: number;
  appointmentRate: number | null;
  revenue: number;
  previousRevenue: number;
  /** Campaign spend pro-rated across the period (spend is stored as a campaign total). */
  spend: number;
  /** Revenue from journeys attributed to a campaign. */
  attributedRevenue: number;
  roas: number | null;
  costPerLead: number | null;
  treatmentsCompleted: number;
}

export interface AnalyticsFunnelStage {
  key: ConversionStageKey;
  label: string;
  /** Journeys that reached this stage or beyond (each journey counted once, at its furthest stage). */
  count: number;
  /** count / leads at Enquiry. */
  pctOfLeads: number | null;
  /** count / previous stage's count. */
  conversionFromPrevious: number | null;
  /** previous stage count - this count. */
  dropOff: number;
}

export interface AnalyticsFunnel {
  period: AnalyticsPeriod;
  stages: AnalyticsFunnelStage[];
  /** Journeys currently lost; the stage they were lost from is not stored. */
  lost: number;
}

export interface AnalyticsRatio {
  numerator: number;
  denominator: number;
  rate: number | null;
}

export interface SourceConversionRow {
  source: SourceChannel;
  leads: number;
  toAppointment: AnalyticsRatio;
  toConsultation: AnalyticsRatio;
  toTreatment: AnalyticsRatio;
}

export interface SourceConversionResponse {
  period: AnalyticsPeriod;
  rows: SourceConversionRow[];
}

export interface AnalyticsRevenueBucket extends AnalyticsBucket {
  revenue: number;
  events: number;
}

export interface RevenueBySource {
  source: SourceChannel;
  spend: number;
  attributedRevenue: number;
  roas: number | null;
}

export interface RevenueByService {
  service: string;
  revenue: number;
}

export interface RevenueEventRow {
  id: string;
  journeyId: string;
  /** Local day, YYYY-MM-DD. */
  day: string;
  amount: number;
  type: "consultation_fee" | "treatment_payment" | "other";
  service: string;
  source: SourceChannel;
}

export interface AnalyticsRevenue {
  period: AnalyticsPeriod;
  granularity: AnalyticsGranularity;
  buckets: AnalyticsRevenueBucket[];
  total: number;
  events: number;
  previousTotal: number;
  spend: number;
  attributedRevenue: number;
  roas: number | null;
  bySource: RevenueBySource[];
  byService: RevenueByService[];
  recent: RevenueEventRow[];
}

export interface AnalyticsCampaignRow {
  campaignId: string;
  campaignName: string;
  source: SourceChannel;
  /** Pro-rated across the period. */
  spend: number;
  leads: number;
  appointments: number;
  /** Journeys whose treatment is completed. */
  treatments: number;
  revenue: number;
  roas: number | null;
  costPerLead: number | null;
}

export interface AnalyticsCampaigns {
  period: AnalyticsPeriod;
  rows: AnalyticsCampaignRow[];
  /** Leads / revenue with no campaign attribution (walk-in, referral, organic...). */
  unattributed: { leads: number; revenue: number };
}

export interface AnalyticsServiceRow {
  service: string;
  leads: number;
  appointments: number;
  consultations: number;
  treatmentsAdvised: number;
  treatmentsCompleted: number;
  revenue: number;
  /** Leads per bucket across the period (sparkline). */
  trend: number[];
}

export interface AnalyticsServices {
  period: AnalyticsPeriod;
  granularity: AnalyticsGranularity;
  rows: AnalyticsServiceRow[];
}

export type AnalyticsFlowKind = "source" | "service" | "outcome";

export interface AnalyticsFlowNode {
  id: string;
  label: string;
  kind: AnalyticsFlowKind;
}

export interface AnalyticsFlowLink {
  source: string;
  target: string;
  value: number;
}

export interface AnalyticsFlow {
  period: AnalyticsPeriod;
  nodes: AnalyticsFlowNode[];
  /** source -> service line and service line -> outcome edges; every journey appears once in each layer. */
  links: AnalyticsFlowLink[];
  /** source -> outcome edges (each journey once) — the staged view "where does each source end up?". */
  sourceOutcomes: AnalyticsFlowLink[];
  total: number;
}

export interface AnalyticsTeamRow {
  /** null = journeys with no owner. */
  userId: string | null;
  name: string;
  role: Role | null;
  assignedJourneys: number;
  appointmentsBooked: number;
  conversion: AnalyticsRatio;
  followUpsCompleted: number;
  /** Snapshot at request time, not period-bound. */
  openTasks: number;
  overdueTasks: number;
}

export interface AnalyticsTeam {
  period: AnalyticsPeriod;
  rows: AnalyticsTeamRow[];
}

export interface AnalyticsFilterOptions {
  services: string[];
  sources: SourceChannel[];
  campaigns: { id: string; name: string; source: SourceChannel }[];
}
