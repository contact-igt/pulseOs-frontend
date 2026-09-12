import type {
  AttentionItem,
  BranchDoctorRow,
  ConversionStage,
  DoctorDashboard,
  MarketingSourceRow,
  PatientFlowCount,
  SessionUser,
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

export const api = {
  login: (email: string, password: string) =>
    request<{ user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  session: () => request<{ user: SessionUser }>("/auth/session"),
  today: () => request<TodayStrip>("/dashboard/today"),
  conversion: () => request<ConversionStage[]>("/dashboard/conversion"),
  patientFlow: () => request<PatientFlowCount[]>("/dashboard/patient-flow"),
  attention: () => request<AttentionItem[]>("/dashboard/attention"),
  marketing: () => request<MarketingSourceRow[]>("/dashboard/marketing"),
  team: () => request<TeamWorkloadRow[]>("/dashboard/team"),
  branchDoctor: () => request<BranchDoctorRow[]>("/dashboard/branch-doctor"),
  doctorDashboard: () => request<DoctorDashboard>("/dashboard/doctor"),
};

export { ApiError };
export type { SessionUser };
