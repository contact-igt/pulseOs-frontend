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
  | "MANAGE_TASKS"
  | "VIEW_INTEGRATIONS"
  | "MANAGE_INTEGRATIONS"
  | "MANAGE_LEADS"
  | "MANAGE_SPECIALTIES";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "VIEW_ADMIN_COMMAND_CENTRE", "VIEW_PATIENTS", "EDIT_PATIENTS", "VIEW_JOURNEYS", "MANAGE_JOURNEYS",
    "VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS", "RECORD_CONSULTATION_OUTCOME", "VIEW_TREATMENT", "MANAGE_TREATMENT",
    "VIEW_REVENUE", "VIEW_MARKETING", "VIEW_INBOX", "MANAGE_INBOX", "MANAGE_TASKS",
    "VIEW_INTEGRATIONS", "MANAGE_INTEGRATIONS", "MANAGE_LEADS", "MANAGE_SPECIALTIES",
  ],
  HOSPITAL_ADMIN: [
    "VIEW_ADMIN_COMMAND_CENTRE", "VIEW_PATIENTS", "EDIT_PATIENTS", "VIEW_JOURNEYS", "MANAGE_JOURNEYS",
    "VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS", "VIEW_TREATMENT", "MANAGE_TREATMENT",
    "VIEW_REVENUE", "VIEW_MARKETING", "VIEW_INBOX", "MANAGE_INBOX", "MANAGE_TASKS",
    "VIEW_INTEGRATIONS", "MANAGE_INTEGRATIONS", "MANAGE_LEADS", "MANAGE_SPECIALTIES",
  ],
  FRONT_DESK: [
    "VIEW_PATIENTS", "EDIT_PATIENTS", "VIEW_JOURNEYS", "VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS",
    "VIEW_INBOX", "MANAGE_INBOX", "MANAGE_TASKS", "MANAGE_LEADS",
  ],
  PATIENT_COORDINATOR: [
    "VIEW_PATIENTS", "EDIT_PATIENTS", "VIEW_JOURNEYS", "MANAGE_JOURNEYS", "VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS",
    "VIEW_TREATMENT", "MANAGE_TREATMENT", "VIEW_REVENUE", "VIEW_INBOX", "MANAGE_INBOX", "MANAGE_TASKS", "MANAGE_LEADS",
  ],
  DOCTOR: [
    "VIEW_DOCTOR_COMMAND_CENTRE", "VIEW_PATIENTS", "VIEW_JOURNEYS", "VIEW_APPOINTMENTS",
    "RECORD_CONSULTATION_OUTCOME", "VIEW_TREATMENT",
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

export interface JourneyPerformancePoint {
  date: string;
  enquiries: number;
  appointments: number;
  consultations: number;
  treatments: number;
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
export type TaskView = "today" | "overdue" | "upcoming" | "completed";

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
  notes: string | null;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
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
