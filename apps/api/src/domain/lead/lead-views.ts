import { LEAD_VIEWS, type LeadDateContext, type LeadRow, type LeadView, type LeadsWorkspace } from "@pulseos/types";
import type { OwnerFilter } from "../journey/journey.service.js";

/**
 * The Leads workspace's quick views, as pure filters over per-journey facts. A view is never a stored status: it is a
 * question asked of real data (journey, tasks, appointments). The count beside a view and the rows it opens come from
 * the SAME predicate, so they can never disagree.
 *
 * Hospital time throughout: every day below is a hospital-local calendar day (YYYY-MM-DD) computed by the caller.
 */
export interface LeadFact {
  row: LeadRow;
  /** Hospital-local day the journey was created. */
  createdDay: string;
  /** Open (pending / in-progress) follow-ups: their due instants and hospital-local due days. */
  openTaskDueAts: number[];
  openTaskDays: string[];
  /** Hospital-local days of this journey's visits that are neither cancelled nor no-show. */
  appointmentDays: string[];
  /** A visit is booked and has not happened yet (requested / scheduled / confirmed). */
  bookedPending: boolean;
  /** The tenant's own lead-source key (null only for journeys that predate the catalogue). */
  sourceKey: string | null;
}

export interface LeadsWorkspaceInput {
  view?: LeadView;
  today: string;
  now: Date;
  /** Inclusive hospital-local range; applies to the date context of the views that have one. */
  range?: { from: string; to: string };
  owner?: OwnerFilter;
  source?: string;
  service?: string;
  status?: LeadRow["leadStatus"];
  due?: "overdue";
}

const FIXED_TODAY: LeadView[] = ["today", "new_today", "appointments_today"];

const inRange = (day: string, r: { from: string; to: string }) => day >= r.from && day <= r.to;

/** Which date a range is measured against for a view — always shown on screen. */
export function dateContextFor(view: LeadView): LeadDateContext {
  if (FIXED_TODAY.includes(view)) return { kind: "today", label: "Today (hospital time)" };
  if (view === "follow_up_due") return { kind: "follow_up_due", label: "Follow-up due date" };
  return { kind: "created", label: "Enquiry date" };
}

function matches(view: LeadView, f: LeadFact, i: LeadsWorkspaceInput): boolean {
  const lost = f.row.stage === "lost";
  const nowMs = i.now.getTime();
  const range = i.range;
  switch (view) {
    case "all":
      return !range || inRange(f.createdDay, range);
    case "new_today":
      return f.createdDay === i.today;
    case "uncontacted":
      return !lost && f.row.leadStatus !== "lost" && (f.row.leadStatus === "new" || f.row.leadStatus === "uncontacted") && (!range || inRange(f.createdDay, range));
    case "follow_up_due": {
      if (lost) return false;
      const due = range ? f.openTaskDays.some((d) => inRange(d, range)) : f.openTaskDays.some((d) => d <= i.today);
      if (!due) return false;
      return i.due === "overdue" ? f.openTaskDueAts.some((t) => t < nowMs) : true;
    }
    case "appointments_today":
      return !lost && f.appointmentDays.includes(i.today);
    case "appointment_booked":
      return !lost && f.bookedPending && (!range || inRange(f.createdDay, range));
    case "no_response":
      return f.row.leadStatus === "no_response" && (!range || inRange(f.createdDay, range));
    case "converted":
      return f.row.leadStatus === "converted" && (!range || inRange(f.createdDay, range));
    case "lost":
      return lost && (!range || inRange(f.createdDay, range));
    case "today":
      return !lost && (f.createdDay === i.today || f.openTaskDays.some((d) => d <= i.today) || f.appointmentDays.includes(i.today));
  }
}

const sharedFilters = (f: LeadFact, i: LeadsWorkspaceInput, skipOwner = false): boolean => {
  const r = f.row;
  if (i.status && r.leadStatus !== i.status) return false;
  // A person filters by the hospital's own source; an older link may carry the coarse bucket instead.
  if (i.source && !(f.sourceKey === i.source || (f.sourceKey === null && r.source === i.source))) return false;
  if (i.service && r.journeyType !== i.service) return false;
  if (!skipOwner && i.owner) return i.owner.kind === "unassigned" ? r.ownerId === null : r.ownerId === i.owner.userId;
  return true;
};

export type LeadsComputation = Pick<LeadsWorkspace, "view" | "dateContext" | "rows" | "counts" | "today" | "ownerCounts">;

export function computeLeadsWorkspace(facts: LeadFact[], input: LeadsWorkspaceInput): LeadsComputation {
  const view = input.view ?? "all";
  const scoped = facts.filter((f) => sharedFilters(f, input));
  const counts = Object.fromEntries(LEAD_VIEWS.map((v) => [v.key, scoped.filter((f) => matches(v.key, f, { ...input, due: undefined })).length])) as Record<LeadView, number>;
  // The overdue refinement belongs to Follow-up Due only; every other view ignores it.
  const rows = scoped.filter((f) => matches(view, f, { ...input, due: view === "follow_up_due" ? input.due : undefined })).map((f) => f.row);
  // The tab count of the active view tracks the refinement too, so what is counted is what is listed.
  if (view === "follow_up_due" && input.due) counts.follow_up_due = rows.length;

  const strip = { ...input, range: undefined, due: undefined };
  const today = {
    appointmentsToday: scoped.filter((f) => matches("appointments_today", f, strip)).length,
    followUpsDue: scoped.filter((f) => matches("follow_up_due", f, strip)).length,
    overdue: scoped.filter((f) => matches("follow_up_due", f, { ...strip, due: "overdue" })).length,
    newToday: scoped.filter((f) => matches("new_today", f, strip)).length,
  };

  // Owner counts: under every active filter except the owner filter itself, over the same view and range as the table.
  const forOwners = facts.filter((f) => sharedFilters(f, input, true) && matches(view, f, { ...input, due: view === "follow_up_due" ? input.due : undefined }));
  const byOwner = new Map<string, { userId: string; name: string; count: number }>();
  let unassigned = 0;
  for (const f of forOwners) {
    if (!f.row.ownerId) {
      unassigned++;
      continue;
    }
    const cur = byOwner.get(f.row.ownerId) ?? { userId: f.row.ownerId, name: f.row.ownerName ?? "Former staff", count: 0 };
    cur.count++;
    byOwner.set(f.row.ownerId, cur);
  }
  return {
    view,
    dateContext: dateContextFor(view),
    rows,
    counts,
    today,
    ownerCounts: { all: forOwners.length, unassigned, byOwner: [...byOwner.values()].sort((a, b) => a.name.localeCompare(b.name)) },
  };
}
