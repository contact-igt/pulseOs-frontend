import type {
  AppointmentAction,
  AppointmentRow,
  AppointmentStatus,
  AttentionItem,
  Branch,
  BranchDoctorRow,
  CampaignFilters,
  CampaignPerformanceRow,
  FrontDeskDashboard,
  CommunicationEndpointVm,
  ConnectorDetail,
  ConnectorRow,
  ConsultationOutcomeValue,
  ConversationAutomationMode,
  ConversationAutomationPreference,
  ConversationChannel,
  ConversationDetail,
  ConversationRow,
  ConversionStage,
  CreateAppointmentInput,
  CreateCommunicationEndpointInput,
  CreateCustomFieldInput,
  CreateLeadInput,
  CreateLeadResult,
  CreatePatientInput,
  CreatePatientResult,
  CreateTaskInput,
  CustomFieldDefinitionVm,
  DoctorDashboard,
  ExecutiveStrip,
  JourneyHealth,
  JourneyListRow,
  JourneysSummary,
  LeadPhoneLookupResult,
  LeadRow,
  LeadStatus,
  LeadsSummary,
  Lookups,
  MarketingEfficiencySummary,
  MarketingSourceRow,
  OwnershipState,
  Patient360,
  TimelineEventVm,
  PatientFlowCount,
  PatientListRow,
  PatientSearchRow,
  Role,
  SessionUser,
  SourcePerformanceRow,
  SpecialtyDetailVm,
  SpecialtyTemplateVm,
  SpendAtRisk,
  SpendAtRiskSummary,
  TaskCounts,
  TaskReason,
  TaskRow,
  TaskView,
  TeamWorkloadRow,
  TodayStrip,
  TreatmentRow,
  TreatmentStatus,
  UpdateCommunicationEndpointInput,
  UpdateCustomFieldInput,
  UpdateSpecialtyInput,
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

export type { TimelineEventVm };

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
  /** 404s (thrown as ApiError) whenever Dev Login isn't enabled — the route
   * doesn't exist at all outside local development, see
   * apps/api/src/domain/auth/auth.routes.ts::devLoginEnabled. Callers treat
   * that 404 as "feature unavailable here", not an error to surface. */
  devLoginRoles: () => request<{ role: Role; label: string }[]>("/auth/dev-login/roles"),
  devLogin: (role: Role) => request<{ user: SessionUser }>("/auth/dev-login", { method: "POST", body: JSON.stringify({ role }) }),
  branches: () => request<Branch[]>("/branches"),
  journeyTypes: () => request<string[]>("/journey-types"),
  today: (f: DashboardQuery = {}) => request<TodayStrip>(`/dashboard/today${qs(f)}`),
  executive: () => request<ExecutiveStrip>("/dashboard/executive"),
  conversion: (f: DashboardQuery = {}) => request<ConversionStage[]>(`/dashboard/conversion${qs(f)}`),
  journeyHealth: (f: DashboardQuery = {}) => request<JourneyHealth>(`/dashboard/journey-health${qs(f)}`),
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
  searchPatients: (q: string) => request<PatientSearchRow[]>(`/patients/search${toQuery({ q })}`),
  createPatient: (input: CreatePatientInput) => request<CreatePatientResult>("/patients", { method: "POST", body: JSON.stringify(input) }),
  patient360: (id: string) => request<Patient360>(`/patients/${id}/360`),
  patientTimeline: (id: string, journeyId?: string) => request<TimelineEventVm[]>(`/patients/${id}/timeline${toQuery({ journeyId })}`),
  journeys: (filters: JourneyFilters = {}) => request<JourneyListRow[]>(`/journeys${toQuery({ ...filters })}`),
  journeysSummary: () => request<JourneysSummary>("/journeys/summary"),
  recordOutcome: (appointmentId: string, input: { outcome: ConsultationOutcomeValue; notes?: string; treatmentLabel?: string; estimatedValue?: number }) =>
    request<{ ok: true }>(`/appointments/${appointmentId}/outcome`, { method: "POST", body: JSON.stringify(input) }),
  lookups: () => request<Lookups>("/lookups"),
  tasks: (filters: { view?: TaskView; assignedTo?: string; patientId?: string; reason?: TaskReason } = {}) =>
    request<TaskRow[]>(`/tasks${toQuery({ ...filters })}`),
  taskCounts: () => request<TaskCounts>("/tasks/counts"),
  createTask: (input: CreateTaskInput) => request<TaskRow>("/tasks", { method: "POST", body: JSON.stringify(input) }),
  addTaskNote: (id: string, notes: string) => request<TaskRow>(`/tasks/${id}/note`, { method: "PATCH", body: JSON.stringify({ notes }) }),
  rescheduleTask: (id: string, dueAt: string) => request<TaskRow>(`/tasks/${id}/reschedule`, { method: "PATCH", body: JSON.stringify({ dueAt }) }),
  reassignTask: (id: string, assignedTo: string) => request<TaskRow>(`/tasks/${id}/reassign`, { method: "PATCH", body: JSON.stringify({ assignedTo }) }),
  completeTask: (id: string) => request<TaskRow>(`/tasks/${id}/complete`, { method: "PATCH", body: JSON.stringify({}) }),
  appointments: (filters: { branchId?: string; doctorId?: string; status?: AppointmentStatus; date?: string; search?: string } = {}) =>
    request<AppointmentRow[]>(`/appointments${toQuery({ ...filters })}`),
  frontDesk: (branchId?: string) => request<FrontDeskDashboard>(`/front-desk${toQuery({ branchId })}`),
  appointmentAction: (id: string, action: AppointmentAction) =>
    request<{ ok: true; status: AppointmentStatus }>(`/appointments/${id}/action`, { method: "PATCH", body: JSON.stringify({ action }) }),
  completeAppointment: (id: string) => request<{ ok: true }>(`/appointments/${id}/complete`, { method: "PATCH", body: JSON.stringify({}) }),
  rescheduleAppointment: (id: string, scheduledAt: string) =>
    request<{ ok: true }>(`/appointments/${id}/reschedule`, { method: "PATCH", body: JSON.stringify({ scheduledAt }) }),
  treatments: (filters: { status?: TreatmentStatus; ownerId?: string } = {}) => request<TreatmentRow[]>(`/treatments${toQuery({ ...filters })}`),
  updateTreatmentStatus: (id: string, status: TreatmentStatus, plannedDate?: string) =>
    request<{ ok: true }>(`/treatments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, plannedDate }) }),
  conversations: (filters: { channel?: ConversationChannel; ownershipState?: OwnershipState; search?: string; communicationEndpointId?: string } = {}) =>
    request<ConversationRow[]>(`/conversations${toQuery({ ...filters })}`),
  conversation: (id: string) => request<ConversationDetail>(`/conversations/${id}`),
  sendConversationMessage: (id: string, body: string) =>
    request<{ ok: true }>(`/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
  claimConversation: (id: string) => request<{ ok: true }>(`/conversations/${id}/claim`, { method: "PATCH", body: JSON.stringify({}) }),
  assignConversation: (id: string, assignedTo: string) =>
    request<{ ok: true }>(`/conversations/${id}/assign`, { method: "PATCH", body: JSON.stringify({ assignedTo }) }),
  returnConversationToAi: (id: string) => request<{ ok: true }>(`/conversations/${id}/return-to-ai`, { method: "PATCH", body: JSON.stringify({}) }),
  closeConversation: (id: string) => request<{ ok: true }>(`/conversations/${id}/close`, { method: "PATCH", body: JSON.stringify({}) }),
  conversationAutomation: (id: string) => request<ConversationAutomationPreference>(`/conversations/${id}/automation`),
  setConversationAutomation: (id: string, input: { mode: ConversationAutomationMode; scheduledStart?: string; scheduledEnd?: string; timezone?: string }) =>
    request<ConversationAutomationPreference>(`/conversations/${id}/automation`, { method: "PATCH", body: JSON.stringify(input) }),
  connectors: () => request<ConnectorRow[]>("/connectors"),
  connector: (id: string) => request<ConnectorDetail>(`/connectors/${id}`),
  updateConnector: (id: string, input: { displayName?: string; configuration?: Record<string, unknown>; secrets?: Record<string, unknown> }) =>
    request<{ ok: true }>(`/connectors/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  syncConnectorCampaigns: (id: string) =>
    request<{ ok: true; syncedCount: number } | { ok: false; reason: string; message?: string }>(`/connectors/${id}/sync-campaigns`, { method: "POST", body: JSON.stringify({}) }),
  syncConnectorPerformance: (id: string) =>
    request<{ ok: true; syncedCount: number } | { ok: false; reason: string; message?: string }>(`/connectors/${id}/sync-performance`, { method: "POST", body: JSON.stringify({}) }),
  createAppointment: (input: CreateAppointmentInput) => request<AppointmentRow>("/appointments", { method: "POST", body: JSON.stringify(input) }),

  // Communication endpoints (multi-hospital-number layer over a Connector)
  communicationEndpoints: (connectorId?: string) =>
    request<CommunicationEndpointVm[]>(connectorId ? `/connectors/${connectorId}/endpoints` : "/communication-endpoints"),
  createCommunicationEndpoint: (connectorId: string, input: CreateCommunicationEndpointInput) =>
    request<CommunicationEndpointVm>(`/connectors/${connectorId}/endpoints`, { method: "POST", body: JSON.stringify(input) }),
  updateCommunicationEndpoint: (connectorId: string, endpointId: string, input: UpdateCommunicationEndpointInput) =>
    request<CommunicationEndpointVm>(`/connectors/${connectorId}/endpoints/${endpointId}`, { method: "PATCH", body: JSON.stringify(input) }),

  // Leads (CRM-2/3/4)
  leads: (filters: { status?: LeadStatus; specialtyKey?: string; source?: string } = {}) => request<LeadRow[]>(`/leads${toQuery({ ...filters })}`),
  leadsSummary: () => request<LeadsSummary>("/leads/summary"),
  leadPhoneLookup: (phone: string) => request<LeadPhoneLookupResult>("/leads/lookup", { method: "POST", body: JSON.stringify({ phone }) }),
  createLead: (input: CreateLeadInput) => request<CreateLeadResult>("/leads", { method: "POST", body: JSON.stringify(input) }),

  // Specialties & custom fields (CRM-7/8)
  specialties: (includeDisabled = false) => request<SpecialtyTemplateVm[]>(`/specialties${toQuery({ includeDisabled: includeDisabled ? "true" : undefined })}`),
  specialtyFields: (key: string) => request<CustomFieldDefinitionVm[]>(`/specialties/${key}/fields`),
  specialtyDetail: (key: string) => request<SpecialtyDetailVm>(`/specialties/${key}`),
  updateSpecialty: (key: string, input: UpdateSpecialtyInput) => request<SpecialtyDetailVm>(`/specialties/${key}`, { method: "PATCH", body: JSON.stringify(input) }),
  createCustomField: (key: string, input: CreateCustomFieldInput) => request<CustomFieldDefinitionVm>(`/specialties/${key}/fields`, { method: "POST", body: JSON.stringify(input) }),
  updateCustomField: (fieldId: string, input: UpdateCustomFieldInput) => request<{ ok: true }>(`/specialties/fields/${fieldId}`, { method: "PATCH", body: JSON.stringify(input) }),

  // Campaigns / marketing efficiency (CRM-9/10)
  campaignPerformance: (filters: CampaignFilters = {}) => request<CampaignPerformanceRow[]>(`/campaigns/performance${toQuery({ ...filters })}`),
  marketingEfficiency: (filters: CampaignFilters = {}) => request<MarketingEfficiencySummary>(`/campaigns/marketing-efficiency${toQuery({ ...filters })}`),
  campaignSpendAtRisk: () => request<SpendAtRisk>("/campaigns/spend-at-risk"),
};

export { ApiError };
export type { SessionUser };
