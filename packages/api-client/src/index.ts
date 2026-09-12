import type {
  AttentionItem,
  Branch,
  BranchDoctorRow,
  ConversionStage,
  DoctorDashboard,
  JourneyHealth,
  JourneyPerformancePoint,
  MarketingSourceRow,
  PatientFlowCount,
  SessionUser,
  SpendAtRisk,
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

function qs(params: object) {
  const entries = (Object.entries(params) as [string, string | undefined][]).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries as [string, string][]).toString()}`;
}

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
  conversion: (f: DashboardQuery = {}) => request<ConversionStage[]>(`/dashboard/conversion${qs(f)}`),
  journeyHealth: (f: DashboardQuery = {}) => request<JourneyHealth>(`/dashboard/journey-health${qs(f)}`),
  journeyPerformance: (days: number, f: DashboardQuery = {}) =>
    request<JourneyPerformancePoint[]>(`/dashboard/journey-performance${qs({ ...f, days: String(days) })}`),
  patientFlow: (f: DashboardQuery = {}) => request<PatientFlowCount[]>(`/dashboard/patient-flow${qs(f)}`),
  attention: (f: DashboardQuery = {}) => request<AttentionItem[]>(`/dashboard/attention${qs(f)}`),
  spendAtRisk: (f: DashboardQuery = {}) => request<SpendAtRisk>(`/dashboard/spend-at-risk${qs(f)}`),
  marketing: () => request<MarketingSourceRow[]>("/dashboard/marketing"),
  team: (f: DashboardQuery = {}) => request<TeamWorkloadRow[]>(`/dashboard/team${qs(f)}`),
  branchDoctor: (f: DashboardQuery = {}) => request<BranchDoctorRow[]>(`/dashboard/branch-doctor${qs(f)}`),
  doctorDashboard: () => request<DoctorDashboard>("/dashboard/doctor"),
};

export { ApiError };
export type { SessionUser };
