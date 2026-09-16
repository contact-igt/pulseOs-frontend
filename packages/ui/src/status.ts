import type { AppointmentStatus, AttentionReason, ConnectorStatus, JourneyStage, TreatmentStatus } from "@pulseos/types";

// One display map per domain, shared across every table/badge/drawer that
// shows this status — never a raw backend enum in front of a user, and
// never a second near-identical copy of the same map in a different file.
export type Tone = "neutral" | "warning" | "danger" | "primary";

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  requested: "Requested",
  scheduled: "Confirmed",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  waiting: "Waiting",
  with_doctor: "With Doctor",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, Tone> = {
  requested: "neutral",
  scheduled: "neutral",
  confirmed: "neutral",
  checked_in: "warning",
  waiting: "warning",
  with_doctor: "primary",
  completed: "neutral",
  no_show: "danger",
  cancelled: "neutral",
};

export const TREATMENT_STATUS_LABEL: Record<TreatmentStatus, string> = {
  ADVISED: "Advised",
  DECISION_PENDING: "Decision Pending",
  ACCEPTED: "Accepted",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  LOST: "Lost",
};

export const TREATMENT_STATUS_TONE: Record<TreatmentStatus, Tone> = {
  ADVISED: "neutral",
  DECISION_PENDING: "warning",
  ACCEPTED: "primary",
  SCHEDULED: "primary",
  COMPLETED: "neutral",
  DECLINED: "danger",
  CANCELLED: "danger",
  LOST: "danger",
};

export const JOURNEY_STAGE_LABEL: Record<JourneyStage, string> = {
  enquiry: "Enquiry",
  contacted: "Contacted",
  booked: "Appointment Booked",
  attended: "Attended",
  consulted: "Consulted",
  treatment_advised: "Treatment Advised",
  scheduled: "Treatment Scheduled",
  completed: "Treatment Completed",
  lost: "Lost",
};

export const JOURNEY_STAGE_TONE: Partial<Record<JourneyStage, Tone>> = {
  enquiry: "neutral",
  contacted: "neutral",
  booked: "primary",
  attended: "primary",
  consulted: "primary",
  treatment_advised: "warning",
  scheduled: "warning",
  completed: "primary",
  lost: "danger",
};

export const ATTENTION_REASON_LABEL: Record<AttentionReason, string> = {
  overdue_callback: "Overdue callback",
  missed_follow_up: "Missed follow-up",
  no_show: "No-show",
  high_intent_uncontacted: "High-intent, uncontacted",
  treatment_decision_pending: "Treatment decision pending",
};

export const CONNECTOR_STATUS_LABEL: Record<ConnectorStatus, string> = {
  NOT_CONFIGURED: "Not configured",
  CONNECTING: "Connecting",
  CONNECTED: "Connected",
  DEGRADED: "Degraded",
  ERROR: "Error",
  DISABLED: "Disabled",
};

export const CONNECTOR_STATUS_TONE: Record<ConnectorStatus, Tone> = {
  NOT_CONFIGURED: "neutral",
  CONNECTING: "warning",
  CONNECTED: "primary",
  DEGRADED: "warning",
  ERROR: "danger",
  DISABLED: "neutral",
};

export const CONNECTOR_EVENT_STATUS_LABEL: Record<string, string> = {
  processed: "Processed",
  failed: "Failed",
  duplicate: "Duplicate",
  pending: "Pending",
};

export const CONNECTOR_EVENT_STATUS_TONE: Record<string, Tone> = {
  processed: "neutral",
  failed: "danger",
  duplicate: "warning",
  pending: "neutral",
};
