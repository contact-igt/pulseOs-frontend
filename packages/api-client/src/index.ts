import type {
  AnalyticsCampaigns,
  AnalyticsFilterOptions,
  AnalyticsFlow,
  AnalyticsFunnel,
  AnalyticsQuery,
  AnalyticsRevenue,
  AnalyticsServices,
  AnalyticsSummary,
  AnalyticsTeam,
  LeadsBySourceResponse,
  SourceConversionResponse,
  AppointmentAction,
  AppointmentRow,
  AppointmentStatus,
  AttentionItem,
  Branch,
  BranchDoctorRow,
  ServiceMixRow,
  CampaignFilters,
  CampaignPerformanceRow,
  FrontDeskDashboard,
  CommunicationEndpointVm,
  ConnectorDetail,
  ConnectorRow,
  RecordOutcomeInput,
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
  BulkAssignJourneyOwnerResult,
  JourneyDetailVm,
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
  TreatmentDefinitionVm,
  TreatmentFilters,
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
  const headers = new Headers(init?.headers);
  // JSON content-type only when there is a string (JSON) body: Fastify
  // rejects a bodyless request that claims application/json with 400
  // (FST_ERR_CTP_EMPTY_JSON_BODY). FormData gets no header so the browser can
  // add the multipart boundary; a caller-provided content-type is kept.
  if (typeof init?.body === "string" && !headers.has("content-type")) headers.set("content-type", "application/json");

  const res = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include", headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? res.statusText);
  }
  // 204, or a 200 with no body (e.g. a bare acknowledgement): nothing to parse.
  const text = res.status === 204 ? "" : await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export { request as apiRequest };

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
  /** Server-side owner filter: "mine" (session user), "unassigned", or a user id. */
  owner?: "mine" | "unassigned" | (string & {});
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
  devLoginEnvironments: () => request<{ key: string; label: string }[]>("/auth/dev-login/environments"),
  devLogin: (role: Role, environment?: string) =>
    request<{ user: SessionUser }>("/auth/dev-login", { method: "POST", body: JSON.stringify({ role, environment }) }),
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
  serviceMix: (f: DashboardQuery = {}) => request<ServiceMixRow[]>(`/dashboard/service-mix${qs(f)}`),
  doctorDashboard: () => request<DoctorDashboard>("/dashboard/doctor"),
  patients: (filters: PatientListFilters = {}) => request<PatientListRow[]>(`/patients${toQuery({ ...filters })}`),
  searchPatients: (q: string) => request<PatientSearchRow[]>(`/patients/search${toQuery({ q })}`),
  createPatient: (input: CreatePatientInput) => request<CreatePatientResult>("/patients", { method: "POST", body: JSON.stringify(input) }),
  patient360: (id: string) => request<Patient360>(`/patients/${id}/360`),
  patientTimeline: (id: string, journeyId?: string) => request<TimelineEventVm[]>(`/patients/${id}/timeline${toQuery({ journeyId })}`),
  journeys: (filters: JourneyFilters = {}) => request<JourneyListRow[]>(`/journeys${toQuery({ ...filters })}`),
  journeysSummary: () => request<JourneysSummary>("/journeys/summary"),
  journeyDetail: (id: string) => request<JourneyDetailVm>(`/journeys/${id}`),
  /** null unassigns. 403 without MANAGE_JOURNEYS; 404 unknown/other-tenant journey; 422 assignee not in this tenant. Returns the updated detail. */
  assignJourneyOwner: (id: string, ownerUserId: string | null) =>
    request<JourneyDetailVm>(`/journeys/${id}/owner`, { method: "PATCH", body: JSON.stringify({ ownerUserId }) }),
  /** 1..100 journeys, all-or-nothing (any out-of-tenant id rejects the whole request). */
  assignJourneyOwnerBulk: (journeyIds: string[], ownerUserId: string | null) =>
    request<BulkAssignJourneyOwnerResult>("/journeys/owner", { method: "POST", body: JSON.stringify({ journeyIds, ownerUserId }) }),
  recordOutcome: (appointmentId: string, input: Omit<RecordOutcomeInput, "appointmentId">) =>
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
  treatments: (filters: TreatmentFilters = {}) => request<TreatmentRow[]>(`/treatments${toQuery({ ...filters })}`),
  treatmentCatalog: (specialtyKey?: string) => request<TreatmentDefinitionVm[]>(`/treatment-catalog${toQuery({ specialtyKey })}`),
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
  leads: (filters: { status?: LeadStatus; specialtyKey?: string; source?: string; owner?: "mine" | "unassigned" | (string & {}) } = {}) => request<LeadRow[]>(`/leads${toQuery({ ...filters })}`),
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

  // Analytics workspace — every call takes the same AnalyticsQuery so all panels agree.
  analyticsSummary: (q: AnalyticsQuery = {}) => request<AnalyticsSummary>(`/analytics/summary${toQuery({ ...q })}`),
  analyticsLeads: (q: AnalyticsQuery = {}) => request<LeadsBySourceResponse>(`/analytics/leads${toQuery({ ...q })}`),
  analyticsFunnel: (q: AnalyticsQuery = {}) => request<AnalyticsFunnel>(`/analytics/funnel${toQuery({ ...q })}`),
  analyticsSourceConversion: (q: AnalyticsQuery = {}) => request<SourceConversionResponse>(`/analytics/source-conversion${toQuery({ ...q })}`),
  analyticsRevenue: (q: AnalyticsQuery = {}) => request<AnalyticsRevenue>(`/analytics/revenue${toQuery({ ...q })}`),
  analyticsCampaigns: (q: AnalyticsQuery = {}) => request<AnalyticsCampaigns>(`/analytics/campaigns${toQuery({ ...q })}`),
  analyticsServices: (q: AnalyticsQuery = {}) => request<AnalyticsServices>(`/analytics/services${toQuery({ ...q })}`),
  analyticsFlow: (q: AnalyticsQuery = {}) => request<AnalyticsFlow>(`/analytics/flow${toQuery({ ...q })}`),
  analyticsTeam: (q: AnalyticsQuery = {}) => request<AnalyticsTeam>(`/analytics/team${toQuery({ ...q })}`),
  analyticsFilterOptions: () => request<AnalyticsFilterOptions>("/analytics/filter-options"),
};

export { ApiError };
export type { SessionUser };
