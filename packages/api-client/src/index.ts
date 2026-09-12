import type {
  AttentionItem,
  Branch,
  BranchDoctorRow,
  ConsultationOutcomeValue,
  ConversionStage,
  CreateTaskInput,
  DoctorDashboard,
  ExecutiveStrip,
  JourneyHealth,
  JourneyListRow,
  JourneyPerformancePoint,
  JourneysSummary,
  Lookups,
  MarketingSourceRow,
  Patient360,
  PatientFlowCount,
  PatientListRow,
  SessionUser,
  SourcePerformanceRow,
  SpendAtRisk,
  SpendAtRiskSummary,
  TaskRow,
  TaskView,
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

function toQuery(params: object): string {
  const entries = (Object.entries(params) as [string, string | undefined | null][]).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries as [string, string][]).toString();
}

/** Same as toQuery, kept under the flagship checkpoint's original name for its own call sites below. */
const qs = toQuery;

export interface DashboardQuery {
  branchId?: string;
  journeyType?: string;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  session: () => request<{ user: SessionUser }>("/auth/session"),
  branches: () => request<Branch[]>("/branches"),
  journeyTypes: () => request<string[]>("/journey-types"),
  today: (f: DashboardQuery = {}) => request<TodayStrip>(`/dashboard/today${qs(f)}`),
  executive: () => request<ExecutiveStrip>("/dashboard/executive"),
  conversion: (f: DashboardQuery = {}) => request<ConversionStage[]>(`/dashboard/conversion${qs(f)}`),
  journeyHealth: (f: DashboardQuery = {}) => request<JourneyHealth>(`/dashboard/journey-health${qs(f)}`),
  journeyPerformance: (days: number, f: DashboardQuery = {}) =>
    request<JourneyPerformancePoint[]>(`/dashboard/journey-performance${qs({ ...f, days: String(days) })}`),
  patientFlow: (f: DashboardQuery = {}) => request<PatientFlowCount[]>(`/dashboard/patient-flow${qs(f)}`),
  attention: (f: DashboardQuery = {}) => request<AttentionItem[]>(`/dashboard/attention${qs(f)}`),
  spendAtRisk: () => request<SpendAtRiskSummary>("/dashboard/spend-at-risk"),
  spendAtRiskByReason: () => request<SpendAtRisk>("/dashboard/spend-at-risk-by-reason"),
  sourcePerformance: () => request<SourcePerformanceRow[]>("/dashboard/source-performance"),
  marketing: () => request<MarketingSourceRow[]>("/dashboard/marketing"),
  team: (f: DashboardQuery = {}) => request<TeamWorkloadRow[]>(`/dashboard/team${qs(f)}`),
  branchDoctor: (f: DashboardQuery = {}) => request<BranchDoctorRow[]>(`/dashboard/branch-doctor${qs(f)}`),
  doctorDashboard: () => request<DoctorDashboard>("/dashboard/doctor"),
  patients: (filters: PatientListFilters = {}) => request<PatientListRow[]>(`/patients${toQuery({ ...filters })}`),
  patient360: (id: string) => request<Patient360>(`/patients/${id}/360`),
  patientTimeline: (id: string, journeyId?: string) => request<TimelineEventVm[]>(`/patients/${id}/timeline${toQuery({ journeyId })}`),
  journeys: (filters: JourneyFilters = {}) => request<JourneyListRow[]>(`/journeys${toQuery({ ...filters })}`),
  journeysSummary: () => request<JourneysSummary>("/journeys/summary"),
  recordOutcome: (appointmentId: string, input: { outcome: ConsultationOutcomeValue; notes?: string; treatmentLabel?: string; estimatedValue?: number }) =>
    request<{ ok: true }>(`/appointments/${appointmentId}/outcome`, { method: "POST", body: JSON.stringify(input) }),
  lookups: () => request<Lookups>("/lookups"),
  tasks: (filters: { view?: TaskView; assignedTo?: string; patientId?: string } = {}) =>
    request<TaskRow[]>(`/tasks${toQuery({ ...filters })}`),
  createTask: (input: CreateTaskInput) => request<TaskRow>("/tasks", { method: "POST", body: JSON.stringify(input) }),
  addTaskNote: (id: string, notes: string) => request<TaskRow>(`/tasks/${id}/note`, { method: "PATCH", body: JSON.stringify({ notes }) }),
  rescheduleTask: (id: string, dueAt: string) => request<TaskRow>(`/tasks/${id}/reschedule`, { method: "PATCH", body: JSON.stringify({ dueAt }) }),
  reassignTask: (id: string, assignedTo: string) => request<TaskRow>(`/tasks/${id}/reassign`, { method: "PATCH", body: JSON.stringify({ assignedTo }) }),
  completeTask: (id: string) => request<TaskRow>(`/tasks/${id}/complete`, { method: "PATCH", body: JSON.stringify({}) }),
};

export { ApiError };
export type { SessionUser };
