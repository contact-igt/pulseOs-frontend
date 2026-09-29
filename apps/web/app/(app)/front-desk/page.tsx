"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { Search } from "lucide-react";
import { AppointmentDrawer, AppointmentList, Button, ErrorState, MetricStrip, PatientFlowBoard, Skeleton, Toolbar } from "@pulseos/ui";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import type { AppointmentAction, AppointmentRow, PatientFlowCount } from "@pulseos/types";

const FLOW_LABEL: Record<PatientFlowCount["bucket"], string> = {
  confirmed: "Confirmed",
  checked_in: "Checked in",
  waiting: "Waiting",
  with_doctor: "With doctor",
  completed: "Completed",
};

function flowBucket(a: AppointmentRow): PatientFlowCount["bucket"] | null {
  if (a.status === "scheduled" || a.status === "confirmed" || a.status === "requested") return "confirmed";
  if (a.status === "checked_in" || a.status === "waiting" || a.status === "with_doctor" || a.status === "completed") return a.status;
  return null;
}

function buildFlow(today: AppointmentRow[]): PatientFlowCount[] {
  const buckets: Record<PatientFlowCount["bucket"], number> = { confirmed: 0, checked_in: 0, waiting: 0, with_doctor: 0, completed: 0 };
  for (const a of today) {
    if (a.status === "scheduled" || a.status === "confirmed" || a.status === "requested") buckets.confirmed++;
    else if (a.status === "checked_in") buckets.checked_in++;
    else if (a.status === "waiting") buckets.waiting++;
    else if (a.status === "with_doctor") buckets.with_doctor++;
    else if (a.status === "completed") buckets.completed++;
  }
  return (Object.keys(buckets) as PatientFlowCount["bucket"][]).map((bucket) => ({ bucket, count: buckets[bucket] }));
}

export default function FrontDeskPage() {
  const queryClient = useQueryClient();
  const quickCreate = useQuickCreate();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  // Clicking a Patient Flow stage narrows the Today list to that stage.
  const [flowFilter, setFlowFilter] = useState<PatientFlowCount["bucket"] | null>(null);

  const dashboard = useQuery({ queryKey: ["front-desk"], queryFn: () => api.frontDesk() });
  const timeline = useQuery({
    queryKey: ["timeline", selected?.patientId, selected?.journeyId],
    queryFn: () => api.patientTimeline(selected!.patientId, selected!.journeyId),
    enabled: !!selected,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["front-desk"] });
    queryClient.invalidateQueries({ queryKey: ["timeline"] });
  }

  async function handleAction(row: AppointmentRow, action: AppointmentAction) {
    await api.appointmentAction(row.id, action);
    invalidate();
    setSelected(null);
  }

  async function handleComplete(row: AppointmentRow) {
    await api.completeAppointment(row.id);
    invalidate();
    setSelected(null);
  }

  async function handleReschedule(row: AppointmentRow, newIso: string) {
    await api.rescheduleAppointment(row.id, newIso);
    invalidate();
    setSelected(null);
  }

  const today = useMemo(() => dashboard.data?.today ?? [], [dashboard.data]);
  const filteredToday = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byStage = flowFilter ? today.filter((a) => flowBucket(a) === flowFilter) : today;
    return q ? byStage.filter((a) => a.patientName.toLowerCase().includes(q)) : byStage;
  }, [today, search, flowFilter]);

  const kpis = useMemo(
    () => [
      { label: "Today", value: today.length },
      { label: "Confirmed", value: today.filter((a) => a.status === "confirmed" || a.status === "scheduled" || a.status === "requested").length },
      { label: "Checked In", value: today.filter((a) => a.status === "checked_in").length },
      { label: "Waiting", value: today.filter((a) => a.status === "waiting").length },
      { label: "With Doctor", value: today.filter((a) => a.status === "with_doctor").length },
      { label: "No-shows", value: today.filter((a) => a.status === "no_show").length },
    ],
    [today],
  );

  if (dashboard.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return <ErrorState message="Could not load the front desk view." />;
  }

  const queueCount = dashboard.data.waitingQueue.length;

  return (
    <div className="mx-auto max-w-7xl space-y-4" data-testid="front-desk-page">
      <Toolbar
        actions={
          <>
            <Button variant="secondary" onClick={() => quickCreate.openAddLead({ source: "walk_in" })} data-testid="front-desk-add-lead-button">
              + Add Lead
            </Button>
            <Button variant="primary" onClick={() => quickCreate.openNewAppointment()}>
              + New Appointment
            </Button>
          </>
        }
      >
        <label className="glass-control relative flex h-8 w-full max-w-xs items-center rounded-control">
          <Search size={14} className="pointer-events-none absolute left-2.5 text-neutral-500" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search today's patients…"
            aria-label="Search today's patients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-full w-full bg-transparent pl-8 pr-2.5 text-xs text-ink outline-none placeholder:text-neutral-500"
            data-testid="front-desk-search"
          />
        </label>
      </Toolbar>

      <MetricStrip
        testId="front-desk-kpi-strip"
        anchorKey={queueCount > 0 ? "Waiting" : undefined}
        cells={kpis.map((k) => ({ key: k.label, label: k.label, value: k.value }))}
      />

      {/* Two columns from xl. Below xl the wrappers dissolve (`contents`) and the panels stack in operational order: Waiting Queue first. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] xl:items-start">
        <div className="contents xl:block xl:space-y-4">
          <div className="order-2 min-w-0 xl:order-none">
            <PatientFlowBoard data={buildFlow(today)} onBucketClick={(b) => setFlowFilter((cur) => (cur === b ? null : b))} />
          </div>
          <div className="order-4 min-w-0 xl:order-none">
            <AppointmentList
              title="Pending Confirmation"
              rows={dashboard.data.pendingConfirmations}
              onAction={handleAction}
              onRowClick={(row) => setSelected(row)}
              showDoctor={false}
              emptyMessage="Nothing pending confirmation."
            />
          </div>
          <div className="order-5 min-w-0 xl:order-none">
            <AppointmentList
              title="No-show Recovery"
              rows={dashboard.data.noShows}
              onAction={handleAction}
              onRowClick={(row) => setSelected(row)}
              showDoctor={false}
              emptyMessage="No no-shows today."
            />
          </div>
        </div>

        <div className="contents xl:block xl:space-y-4">
          <div className="order-1 min-w-0 xl:order-none">
            <AppointmentList
              title="Waiting Queue"
              rows={dashboard.data.waitingQueue}
              onAction={handleAction}
              onComplete={handleComplete}
              onRowClick={(row) => setSelected(row)}
              showWait
              emptyMessage="No one waiting."
            />
          </div>
          <div className="order-3 min-w-0 xl:order-none">
            <AppointmentList
              title={flowFilter ? `Today · ${FLOW_LABEL[flowFilter]}` : "Today's Appointments"}
              rows={filteredToday}
              onAction={handleAction}
              onComplete={handleComplete}
              onRowClick={(row) => setSelected(row)}
              actions={
                flowFilter ? (
                  <button type="button" onClick={() => setFlowFilter(null)} className="text-xs font-medium text-primary-700 hover:underline" data-testid="front-desk-clear-stage">
                    Show all
                  </button>
                ) : undefined
              }
              emptyMessage={flowFilter || search ? "No appointments match this view." : "No appointments today."}
            />
          </div>
        </div>
      </div>

      <AppointmentDrawer
        appointment={selected}
        recentEvents={timeline.data}
        onClose={() => setSelected(null)}
        onAction={handleAction}
        onComplete={handleComplete}
        onReschedule={handleReschedule}
      />
    </div>
  );
}
