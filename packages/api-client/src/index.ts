import type {
  AttentionItem,
  BranchDoctorRow,
  ConsultationOutcomeValue,
  ConversionStage,
  DoctorDashboard,
  ExecutiveStrip,
  JourneyListRow,
  JourneysSummary,
  Patient360,
  PatientFlowCount,
  PatientListRow,
  SessionUser,
  SourcePerformanceRow,
  SpendAtRiskSummary,
  TeamWorkloadRow,
  TodayStrip,
} from "@pulseos/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface TimelineEventVm {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  sourceChannel: string | null;
  occurredAt: string;
  category: "communication" | "appointments" | "clinical" | "tasks" | "other";
}

export interface PatientListFilters {
  search?: string;
  branchId?: string;
  source?: string;
  stage?: string;
}

export interface JourneyFilters {
  source?: string;
  campaignId?: string;
  branchId?: string;
  stage?: string;
  ownerId?: string;
  doctorId?: string;
}

function toQuery(params: Record<string, string | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries as [string, string][]).toString();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  session: () => request<{ user: SessionUser }>("/auth/session"),
  today: () => request<TodayStrip>("/dashboard/today"),
  executive: () => request<ExecutiveStrip>("/dashboard/executive"),
  conversion: () => request<ConversionStage[]>("/dashboard/conversion"),
  patientFlow: () => request<PatientFlowCount[]>("/dashboard/patient-flow"),
  attention: () => request<AttentionItem[]>("/dashboard/attention"),
  spendAtRisk: () => request<SpendAtRiskSummary>("/dashboard/spend-at-risk"),
  sourcePerformance: () => request<SourcePerformanceRow[]>("/dashboard/source-performance"),
  team: () => request<TeamWorkloadRow[]>("/dashboard/team"),
  branchDoctor: () => request<BranchDoctorRow[]>("/dashboard/branch-doctor"),
  doctorDashboard: () => request<DoctorDashboard>("/dashboard/doctor"),
  patients: (filters: PatientListFilters = {}) => request<PatientListRow[]>(`/patients${toQuery({ ...filters })}`),
  patient360: (id: string) => request<Patient360>(`/patients/${id}/360`),
  patientTimeline: (id: string, journeyId?: string) => request<TimelineEventVm[]>(`/patients/${id}/timeline${toQuery({ journeyId })}`),
  journeys: (filters: JourneyFilters = {}) => request<JourneyListRow[]>(`/journeys${toQuery({ ...filters })}`),
  journeysSummary: () => request<JourneysSummary>("/journeys/summary"),
  recordOutcome: (appointmentId: string, input: { outcome: ConsultationOutcomeValue; notes?: string; treatmentLabel?: string; estimatedValue?: number }) =>
    request<{ ok: true }>(`/appointments/${appointmentId}/outcome`, { method: "POST", body: JSON.stringify(input) }),
};

export { ApiError };
export type { SessionUser };
