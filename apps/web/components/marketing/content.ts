// Public landing page content. All patient/hospital data here is SYNTHETIC and fictional (no real hospital, patient or
// phone number). Product claims are limited to what the app does today; provider-dependent behaviour (WhatsApp, calling,
// ad reporting) is always worded as "when your provider is connected".

export const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "For Hospitals", href: "#for-hospitals" },
  { label: "Integrations", href: "#integrations" },
  { label: "Resources", href: "#resources" },
] as const;

/** Where a visitor sends demo requests. Nothing is invented: unset means the form says so instead of dropping the request. */
export const DEMO_REQUEST_EMAIL = process.env.NEXT_PUBLIC_DEMO_REQUEST_EMAIL?.trim() || "";

export const FUNNEL_STAGES = [
  { key: "enquiries", label: "Enquiries", count: 143 },
  { key: "booked", label: "Appointments booked", count: 91 },
  { key: "attended", label: "Visits attended", count: 72 },
  { key: "consulted", label: "Consultations completed", count: 68 },
  { key: "advised", label: "Procedures advised", count: 34 },
  { key: "scheduled", label: "Procedures scheduled", count: 19 },
  { key: "done", label: "Procedures done", count: 14 },
] as const;

export const SOURCE_OUTCOMES = [
  { source: "Google", enquiries: 40, visits: 18, consultations: 11, procedures: 5 },
  { source: "Instagram", enquiries: 35, visits: 12, consultations: 6, procedures: 1 },
  { source: "Website", enquiries: 18, visits: 9, consultations: 7, procedures: 3 },
  { source: "Phone", enquiries: 31, visits: 22, consultations: 20, procedures: 4 },
] as const;

export const SERVICE_OUTCOMES = [
  { service: "Cataract", enquiries: 52, advised: 14 },
  { service: "Oculoplasty", enquiries: 31, advised: 8 },
  { service: "Laser vision correction", enquiries: 27, advised: 7 },
  { service: "Squint", enquiries: 19, advised: 5 },
] as const;

export const TEAM_ROWS = [
  { name: "Shivani", enquiries: 48, followUps: "Up to date" },
  { name: "Deepa", enquiries: 41, followUps: "2 overdue" },
  { name: "Arun", enquiries: 35, followUps: "Up to date" },
] as const;

export const SOURCES = ["Meta Ads", "Google", "Website", "Phone", "WhatsApp", "Walk-in", "Referral"] as const;
export const ARTIFACTS = ["Spreadsheet", "Notebook", "Call log", "WhatsApp chats", "Appointment book"] as const;

export const JOURNEY_STAGES = [
  {
    key: "enquiry",
    label: "Enquiry",
    title: "Google · Cataract",
    lines: ["Enquiry created from Google", "Assigned to Shivani", "Source and service saved on the journey"],
    tone: "primary",
    status: "New",
  },
  {
    key: "followup",
    label: "Follow-up",
    title: "Call logged",
    lines: ["Patient asked about timings", "Next action: call tomorrow · 11:00 AM", "Owner: Shivani"],
    tone: "warning",
    status: "Next action set",
  },
  {
    key: "appointment",
    label: "Appointment",
    title: "Confirmed · 10 Oct · 10:30 AM",
    lines: ["Cataract consultation with Dr. Menon", "Booked while on the call", "Confirmation and reminder planned*"],
    tone: "primary",
    status: "Confirmed",
  },
  {
    key: "visit",
    label: "Visit",
    title: "Waiting · 8 min",
    lines: ["Checked in at 10:22 AM", "Front desk and doctor see the same status", "Next step: send to doctor"],
    tone: "warning",
    status: "Waiting",
  },
  {
    key: "consultation",
    label: "Consultation",
    title: "Completed",
    lines: ["Seen by Dr. Menon at 10:41 AM", "Outcome recorded on the journey", "Operational view only. Clinical notes stay in your EMR"],
    tone: "success",
    status: "Completed",
  },
  {
    key: "procedure",
    label: "Procedure",
    title: "Cataract surgery advised",
    lines: ["Decision pending with the patient", "Source Google stays attached", "Marketing can finally see this conversion"],
    tone: "primary",
    status: "Advised",
  },
  {
    key: "recall",
    label: "Follow-up",
    title: "Coordinator follow-up due tomorrow",
    lines: ["Task owner: Shivani", "Due tomorrow · 11:00 AM", "Full history one tap away"],
    tone: "warning",
    status: "Due tomorrow",
  },
] as const;

export const TIMELINE_EVENTS = [
  { time: "09:42", title: "Lead created", detail: "Google · Oculoplasty", kind: "lead" },
  { time: "09:48", title: "Incoming call", detail: "Patient asked about eye-bag treatment", kind: "call" },
  { time: "09:50", title: "Appointment confirmed", detail: "Tomorrow · 11:30 AM", kind: "appt" },
  { time: "Next day 11:26", title: "Patient checked in", detail: "Waiting", kind: "visit" },
  { time: "11:38", title: "Sent to doctor", detail: "With doctor", kind: "visit" },
  { time: "12:02", title: "Consultation completed", detail: "Dr. Bhat", kind: "consult" },
  { time: "12:05", title: "Procedure advised", detail: "Upper eyelid surgery · decision pending", kind: "proc" },
] as const;

export const PAIN_POINTS = [
  { key: "followups", title: "Leads come in. Follow-ups disappear.", body: "A callback promised on Monday is nobody's job by Wednesday." },
  { key: "showed", title: "Appointments are booked, but nobody knows who actually showed up.", body: "Booked is not the same as arrived." },
  { key: "report", title: "Your marketing report stops at leads.", body: "Lead counts say nothing about consultations or procedures." },
  { key: "phones", title: "Patient conversations live inside different phones.", body: "Calls, chats and walk-ins end up in five places." },
  { key: "coordinator", title: "One coordinator knows the history. The rest of the team doesn't.", body: "When they are absent, the context is gone." },
  { key: "conversion", title: "Procedure advice happens in consultation, but marketing never sees the conversion.", body: "The source that actually fills your OT stays invisible." },
] as const;

export const ROLES = [
  {
    key: "owner",
    tab: "Owner",
    eyebrow: "For the owner",
    headline: "Stop asking your team for updates. See the hospital journey yourself.",
    benefits: ["Which source creates consultations, not just leads", "Which service creates procedures", "Where patients drop off, and which follow-ups are overdue"],
  },
  {
    key: "frontdesk",
    tab: "Front Desk",
    eyebrow: "For your front desk",
    headline: "Less clicking. Less writing. A clearer clinic day.",
    benefits: ["Check in puts the patient in the waiting queue automatically", "Send to doctor in one tap", "No paper queue. Everyone sees the same patient state"],
  },
  {
    key: "coordinator",
    tab: "Coordinator",
    eyebrow: "For patient coordinators",
    headline: "Every follow-up has an owner and a next action.",
    benefits: ["Log the call, set the next action, book the appointment in one place", "Follow-up is a task with an owner, a date, a time and history", "No more spreadsheet columns to maintain"],
  },
  {
    key: "doctor",
    tab: "Doctor",
    eyebrow: "For the doctor",
    headline: "See who's coming. Who's waiting. And why they're here.",
    benefits: ["Time, patient, service and status on one clean planner", "Waiting time visible at a glance", "No marketing dashboard. Not clinical charting either"],
  },
] as const;

export const FRONT_DESK_QUEUE = [
  { time: "10:30", patient: "Anil Joshi", service: "Cataract consultation", status: "Waiting", tone: "warning", wait: "8 min", next: "Send to doctor" },
  { time: "10:45", patient: "Zoya Khan", service: "Laser vision correction", status: "Checked in", tone: "warning", wait: "2 min", next: "Move to waiting" },
  { time: "11:00", patient: "Pallavi Nayak", service: "Oculoplasty", status: "With doctor", tone: "primary", wait: "", next: "" },
  { time: "09:30", patient: "Bhaskar Rao", service: "Cataract consultation", status: "Completed", tone: "success", wait: "", next: "" },
] as const;

export const PLANNER_ROWS = [
  { time: "10:30 AM", patient: "Anil Joshi", service: "Cataract consultation", status: "Waiting · 8 min", tone: "warning" },
  { time: "10:45 AM", patient: "Zoya Khan", service: "Laser vision correction", status: "Checked in", tone: "warning" },
  { time: "11:15 AM", patient: "Harish Bhat", service: "Squint review", status: "Confirmed", tone: "neutral" },
  { time: "11:30 AM", patient: "Meera Pillai", service: "Oculoplasty", status: "Confirmed", tone: "neutral" },
  { time: "12:00 PM", patient: "Tanvi Shetty", service: "Cataract follow-up", status: "Booked", tone: "neutral" },
] as const;

export const CRM_FIELDS = [
  { key: "phone", name: "Phone", required: true, filterable: true, usedIn: "Lead, Patient", locked: true },
  { key: "name", name: "Name", required: false, filterable: true, usedIn: "Lead, Patient", locked: false },
  { key: "area", name: "Area / Locality", required: false, filterable: true, usedIn: "Lead, Patient", locked: false },
  { key: "dob", name: "Date of Birth", required: false, filterable: false, usedIn: "Patient", locked: false },
] as const;

export const COMPARISON = [
  {
    key: "ivr",
    name: "Calling / IVR",
    handles: ["Calls", "Routing", "Recording"],
    missing: "The full patient journey after the call",
  },
  {
    key: "crm",
    name: "General CRM",
    handles: ["Leads", "Tasks", "Pipeline"],
    missing: "Hospital-specific visit and treatment workflow",
  },
  {
    key: "emr",
    name: "EMR / HMIS",
    handles: ["Clinical records", "Prescriptions", "Billing", "Hospital administration"],
    missing: "The marketing-to-patient engagement journey",
  },
  {
    key: "pulse",
    name: "PulseOS",
    handles: ["Enquiry", "Call", "Follow-up", "Appointment", "Visit", "Consultation", "Treatment", "Source attribution"],
    missing: "",
  },
] as const;

export const PRINCIPLES = [
  "One patient, multiple journeys.",
  "Every interaction has context.",
  "Every follow-up has a next action.",
  "Clinical systems stay clinical. PulseOS manages the operational journey.",
] as const;

export const SECURITY_POINTS = [
  { title: "Role-based access", body: "Owners, admins, coordinators, front desk and doctors each see only what their role allows. Permissions are enforced on the server, not just hidden in the screen." },
  { title: "Separate hospital data", body: "Each hospital's workspace is kept apart. Your team's access is always derived from their signed-in session." },
  { title: "Secure sessions", body: "Passwords are stored as one-way hashes and sign-in uses secure, server-managed session cookies." },
  { title: "Protected integration credentials", body: "Provider keys are stored on the server and are never shown back in the browser. Sensitive changes are recorded in an activity log." },
] as const;

export const INDIA_REALITIES = ["Phone-first enquiries", "WhatsApp conversations", "Walk-ins", "Referrals and multiple lead sources", "Front desk and patient coordinators", "Single-doctor clinics to larger hospitals", "Services configured per hospital"] as const;
