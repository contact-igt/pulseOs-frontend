"use client";

import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@pulseos/api-client";
import { Button, Card, EmptyState, ErrorState, Skeleton, Tabs, Toolbar, ViewSwitcher } from "@pulseos/ui";
import { LEAD_VIEWS, hasPermission, type LeadRow, type LeadsTodaySummary } from "@pulseos/types";
import { Columns3, Table2 } from "lucide-react";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import { withFrom } from "@/components/shell/BackLink";
import { AssignOwnerDialog } from "@/components/journey/AssignOwnerDialog";
import { invalidateJourneyQueries } from "@/components/journey/invalidate";
import { replaceUrlParams } from "@/lib/urlParams";
import { LeadsStageBoard } from "@/components/leads/LeadsStageBoard";
import { LeadsFilterBar } from "@/components/leads/LeadsFilterBar";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { LeadsTodayStrip } from "@/components/leads/LeadsTodayStrip";
import { activeLeadChips, isDefaultLeadFilters, leadFilterPatch, readLeadFilters, resetLeadPatch, toWorkspaceQuery, type LeadFilters } from "@/components/leads/leadFilters";

type LeadsView = "table" | "board";
const VIEW_OPTIONS = [
  { key: "table" as const, label: "Table", icon: <Table2 size={14} />, controls: "leads-view-panel" },
  { key: "board" as const, label: "Board", icon: <Columns3 size={14} />, controls: "leads-view-panel" },
];

/** What the open assignment dialog is for: one row, or the current bulk selection. */
type Assigning = { kind: "one"; row: LeadRow } | { kind: "bulk" } | null;

export default function LeadsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const quickCreate = useQuickCreate();
  const searchParams = useSearchParams();
  // Every filter lives in the URL, so reload, back/forward and shared links restore exactly this list.
  const filters = useMemo(() => readLeadFilters((k) => searchParams.get(k) ?? "", ""), [searchParams]);
  const change = useCallback((patch: Partial<LeadFilters>) => void replaceUrlParams(leadFilterPatch(patch)), []);
  // Table / Board is `?layout=` (`?view=` belongs to the quick views). An older `?view=board` link still opens the board.
  const view: LeadsView = searchParams.get("layout") === "board" || (!searchParams.get("layout") && searchParams.get("view") === "board") ? "board" : "table";
  const setView = useCallback((next: LeadsView) => void replaceUrlParams({ layout: next === "table" ? undefined : next, ...(searchParams.get("view") === "board" ? { view: undefined } : {}) }), [searchParams]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState<Assigning>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const session = useQuery({ queryKey: ["session"], queryFn: api.session, retry: false });
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: api.lookups, staleTime: 60_000 });
  const query = useMemo(() => toWorkspaceQuery(filters), [filters]);
  // One request for the rows, every tab's count, the today strip and the owner counts: they cannot disagree.
  const leads = useQuery({ queryKey: ["leads", "workspace", query], queryFn: () => api.leadsWorkspace(query), placeholderData: keepPreviousData });
  const workspace = leads.data;

  const canAssign = session.data ? hasPermission(session.data.user.role, "MANAGE_JOURNEYS") : false;
  const owners = lookups.data?.owners ?? [];
  const rows = useMemo(() => workspace?.rows ?? [], [workspace]);
  // Selection only ever counts rows still on screen (filters can hide selected rows).
  const selectedIds = useMemo(() => rows.filter((r) => selected.has(r.id)).map((r) => r.id), [rows, selected]);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const chips = activeLeadChips(filters, { sources: workspace?.options.sources ?? [], owners });
  const dirty = !isDefaultLeadFilters(filters);

  const openStrip = (key: keyof LeadsTodaySummary) => {
    setSelected(new Set());
    if (key === "appointmentsToday") change({ view: "appointments_today" });
    else if (key === "newToday") change({ view: "new_today" });
    else if (key === "followUpsDue") change({ view: "follow_up_due", due: undefined });
    else change({ view: "follow_up_due", due: "overdue" });
  };
  const stripActive: keyof LeadsTodaySummary | null =
    filters.view === "appointments_today" ? "appointmentsToday" : filters.view === "new_today" ? "newToday" : filters.view === "follow_up_due" ? (filters.due ? "overdue" : "followUpsDue") : null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ownerName = (id: string | null) => (id ? owners.find((o) => o.id === id)?.name ?? "the selected owner" : "Unassigned");

  async function submitAssignment(ownerId: string | null) {
    if (!assigning) return;
    if (assigning.kind === "one") {
      await api.assignJourneyOwner(assigning.row.id, ownerId);
      setNotice(null);
    } else {
      const result = await api.assignJourneyOwnerBulk(selectedIds, ownerId);
      setSelected(new Set());
      setNotice(`${result.updatedCount} journey${result.updatedCount === 1 ? "" : "s"} assigned to ${ownerName(ownerId)}.`);
    }
    invalidateJourneyQueries(queryClient);
    setAssigning(null);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-3" data-testid="leads-page">
      <Toolbar
        actions={
          <>
            <ViewSwitcher ariaLabel="Leads view" value={view} onChange={setView} options={VIEW_OPTIONS} />
            <Button variant="primary" onClick={() => quickCreate.openAddLead()} className="max-md:min-h-11" data-testid="add-lead-button">
              + Add Lead
            </Button>
          </>
        }
      >
        <Tabs
          variant="underline"
          ariaLabel="Lead views"
          value={filters.view}
          onChange={(k) => {
            setSelected(new Set());
            change({ view: k as LeadFilters["view"] });
          }}
          items={LEAD_VIEWS.map((v) => ({ key: v.key, label: v.label, count: workspace?.counts[v.key], testId: `leads-tab-${v.key}` }))}
        />
      </Toolbar>

      {workspace && <LeadsTodayStrip summary={workspace.today} onOpen={openStrip} activeKey={stripActive} />}

      <LeadsFilterBar filters={filters} workspace={workspace} sessionUserId={session.data?.user.id} owners={owners} chips={chips} dirty={dirty} onChange={(p) => { setSelected(new Set()); change(p); }} onReset={() => { setSelected(new Set()); void replaceUrlParams(resetLeadPatch()); }} />

      {view === "table" && canAssign && selectedIds.length > 0 && (
        <Card tone="info" className="flex flex-wrap items-center gap-3 px-4 py-2" data-testid="bulk-bar" role="region" aria-label="Bulk actions">
          <span className="text-sm font-medium text-ink">{selectedIds.length} selected</span>
          <Button variant="primary" size="sm" onClick={() => { setNotice(null); setAssigning({ kind: "bulk" }); }} data-testid="bulk-assign">
            Assign to…
          </Button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-ink-2 hover:text-ink" data-testid="bulk-clear">
            Clear
          </button>
        </Card>
      )}
      {notice && (
        <p role="status" className="px-1 text-xs text-primary-700" data-testid="assign-notice">
          {notice}
        </p>
      )}

      {view === "board" && rows.length > 0 && (
        <div id="leads-view-panel" role="tabpanel" aria-label="Board">
          <LeadsStageBoard rows={rows} onOpen={(lead) => router.push(withFrom(`/journeys/${lead.id}`, "leads"))} />
        </div>
      )}

      <Card className={`overflow-x-auto p-0 ${view === "board" && rows.length > 0 ? "hidden" : ""}`} id={view === "table" ? "leads-view-panel" : undefined}>
        {leads.isLoading && <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>}
        {leads.isError && <div className="p-4"><ErrorState message="Could not load leads." /></div>}
        {workspace && rows.length === 0 && (
          <div className="p-8" data-testid="leads-empty">
            <EmptyState message={dirty ? "No leads match these filters." : "No leads yet."} />
            <div className="mt-3 flex justify-center gap-4">
              {dirty && (
                <button type="button" onClick={() => void replaceUrlParams(resetLeadPatch())} className="text-xs font-medium text-primary-600 hover:underline" data-testid="leads-empty-reset">
                  Reset filters
                </button>
              )}
              <button type="button" onClick={() => quickCreate.openAddLead()} className="text-xs font-medium text-primary-600 hover:underline">
                + Add Lead
              </button>
            </div>
          </div>
        )}
        {rows.length > 0 && view === "table" && (
          <LeadsTable
            rows={rows}
            canAssign={canAssign}
            selected={selected}
            allSelected={allSelected}
            onToggle={toggle}
            onToggleAll={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
            onOpen={(lead) => router.push(withFrom(`/journeys/${lead.id}`, "leads"))}
            onAssign={(lead) => {
              setNotice(null);
              setAssigning({ kind: "one", row: lead });
            }}
          />
        )}
      </Card>

      {assigning && canAssign && (
        <AssignOwnerDialog
          open
          subject={assigning.kind === "one" ? assigning.row.patientName : `${selectedIds.length} journey${selectedIds.length === 1 ? "" : "s"}`}
          owners={owners}
          initialOwnerId={assigning.kind === "one" ? assigning.row.ownerId : null}
          onClose={() => setAssigning(null)}
          onSubmit={submitAssignment}
        />
      )}
    </div>
  );
}
