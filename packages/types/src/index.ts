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
}

export type PatientFlowBucket = "confirmed" | "checked_in" | "with_doctor" | "completed";

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

export type SourceChannel = "meta" | "google" | "website" | "whatsapp" | "walk_in" | "referral";

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

export interface DoctorTodayItem {
  appointmentId: string;
  patientName: string;
  time: string;
  status: "scheduled" | "checked_in" | "with_doctor" | "completed" | "no_show" | "cancelled";
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
