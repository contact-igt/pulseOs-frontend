"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { AppointmentDrawer, AppointmentList, Button, ErrorState, MetricStrip, PatientFlowBoard, Skeleton } from "@pulseos/ui";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import type { AppointmentAction, AppointmentRow, PatientFlowCount } from "@pulseos/types";

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
    return q ? today.filter((a) => a.patientName.toLowerCase().includes(q)) : today;
  }, [today, search]);

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
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return <ErrorState message="Could not load the front desk view." />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5" data-testid="front-desk-page">
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={() => quickCreate.openAddLead({ source: "walk_in" })} data-testid="front-desk-add-lead-button">
          + Add Lead
        </Button>
        <Button variant="primary" onClick={() => quickCreate.openNewAppointment()}>
          + New Appointment
        </Button>
      </div>

      <MetricStrip
        testId="front-desk-kpi-strip"
        cells={kpis.map((k) => ({ key: k.label, label: k.label, value: k.value }))}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.9fr_1fr]">
        <PatientFlowBoard data={buildFlow(today)} />
        <AppointmentList
          title="Waiting Queue"
          rows={dashboard.data.waitingQueue}
          onAction={handleAction}
          onComplete={handleComplete}
          onRowClick={(row) => setSelected(row)}
          showDoctor={false}
          emptyMessage="No one waiting."
        />
      </div>

      <div>
        <input
          type="text"
          placeholder="Search today's patients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary-400"
          data-testid="front-desk-search"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <AppointmentList
          title="Recent Arrivals"
          rows={filteredToday}
          onAction={handleAction}
          onComplete={handleComplete}
          onRowClick={(row) => setSelected(row)}
          emptyMessage="No appointments today."
        />
        <AppointmentList
          title="Pending Confirmation"
          rows={dashboard.data.pendingConfirmations}
          onAction={handleAction}
          onRowClick={(row) => setSelected(row)}
          showDoctor={false}
          emptyMessage="Nothing pending confirmation."
        />
        <AppointmentList
          title="No-show Recovery"
          rows={dashboard.data.noShows}
          onAction={handleAction}
          onRowClick={(row) => setSelected(row)}
          showDoctor={false}
          emptyMessage="No no-shows today."
        />
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
