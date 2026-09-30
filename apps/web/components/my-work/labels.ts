import type { TaskType } from "@pulseos/types";

export const TYPE_LABEL: Record<TaskType, string> = {
  CALLBACK: "Callback",
  FOLLOW_UP: "Follow-up",
  APPOINTMENT_CONFIRMATION: "Appointment confirmation",
  NO_SHOW_RECOVERY: "No-show recovery",
  TREATMENT_DECISION: "Treatment decision",
  POST_CARE: "Post-care",
  RECALL: "Recall",
  OTHER: "Other",
};

export const SOURCE_LABEL: Record<string, string> = {
  meta: "Meta", google: "Google", website: "Website", whatsapp: "WhatsApp", phone: "Phone", walk_in: "Walk-in", referral: "Referral", organic: "Organic", other: "Other",
};
