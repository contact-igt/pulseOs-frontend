"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { Search } from "lucide-react";
import { AppointmentDrawer, AppointmentList, Button, ErrorState, FilterBar, FilterSelect, Skeleton, Tabs, Toolbar } from "@pulseos/ui";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import { hasPermission } from "@pulseos/types";
import type { AppointmentAction, AppointmentRow } from "@pulseos/types";

type ViewTab = "today" | "upcoming" | "no_show" | "completed";

const TABS: { key: ViewTab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "no_show", label: "No-shows" },
  { key: "completed", label: "Completed" },
];

function todayIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const quickCreate = useQuickCreate();
  const [tab, setTab] = useState<ViewTab>("today");
  const [branchId, setBranchId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AppointmentRow | null>(null);

  const timeline = useQuery({
    queryKey: ["timeline", selected?.patientId, selected?.journeyId],
    queryFn: () => api.patientTimeline(selected!.patientId, selected!.journeyId),
    enabled: !!selected,
  });

  const lookups = useQuery({ queryKey: ["lookups"], queryFn: api.lookups });

  // MANAGE_APPOINTMENTS gates every action endpoint server-side (Doctor has
  // only VIEW_APPOINTMENTS) — mirrored here only to avoid showing dead
  // controls, never as the actual authorization boundary.
  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  const canManage = !!session.data && hasPermission(session.data.user.role, "MANAGE_APPOINTMENTS");

  const filters =
    tab === "today"
      ? { date: todayIso() }
      : tab === "no_show"
        ? { status: "no_show" as const }
        : tab === "completed"
          ? { status: "completed" as const }
          : {};

  const appointments = useQuery({
    queryKey: ["appointments", tab, branchId, doctorId],
    queryFn: () => api.appointments({ ...filters, branchId: branchId || undefined, doctorId: doctorId || undefined }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["timeline"] });
    // Check-in/status changes move Front Desk's Patient Flow counts and the
    // Command Centre's today/patient-flow KPIs — keep both in sync, not just
    // this table (the sync rule: an action's effect must be visible wherever
    // it's shown, not only where it was taken).
    queryClient.invalidateQueries({ queryKey: ["front-desk"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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

  const rows = appointments.data ?? [];
  const visibleRows =
    tab === "upcoming"
      ? rows.filter((r) => new Date(r.scheduledAt) > new Date() && r.status !== "completed" && r.status !== "cancelled")
      : rows;
  const searched = search.trim() ? visibleRows.filter((r) => r.patientName.toLowerCase().includes(search.trim().toLowerCase())) : visibleRows;

  return (
    <div className="mx-auto max-w-6xl space-y-3" data-testid="appointments-page">
      <Toolbar
        actions={
          canManage && (
            <Button variant="primary" onClick={() => quickCreate.openNewAppointment()} data-testid="new-appointment-button">
              + New Appointment
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Tabs
            ariaLabel="Appointment view"
            items={TABS.map((t) => ({ key: t.key, label: t.label, testId: `appointments-tab-${t.key}` }))}
            value={tab}
            onChange={(k) => setTab(k as ViewTab)}
          />
          <FilterBar>
            <FilterSelect value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="Branch">
              <option value="">All branches</option>
              {lookups.data?.branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={doctorId} onChange={(e) => setDoctorId(e.target.value)} aria-label="Doctor">
              <option value="">All doctors</option>
              {lookups.data?.doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </FilterSelect>
            <label className="glass-control relative flex h-8 min-w-0 flex-1 items-center rounded-control sm:w-48 sm:flex-none">
              <Search size={14} className="pointer-events-none absolute left-2.5 text-neutral-500" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search patients…"
                aria-label="Search patients"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-full w-full bg-transparent pl-8 pr-2.5 text-xs text-ink outline-none placeholder:text-neutral-500"
              />
            </label>
          </FilterBar>
        </div>
      </Toolbar>

      {appointments.isLoading ? (
        <Skeleton className="h-64" />
      ) : appointments.isError ? (
        <ErrorState message="Could not load appointments." />
      ) : (
        <AppointmentList
          title={TABS.find((t) => t.key === tab)!.label}
          rows={searched}
          onAction={canManage ? handleAction : undefined}
          onComplete={canManage ? handleComplete : undefined}
          onRowClick={(row) => setSelected(row)}
          showBranch
          showDate={tab !== "today"}
          emptyMessage="No appointments match these filters."
        />
      )}

      <AppointmentDrawer
        appointment={selected}
        recentEvents={timeline.data}
        onClose={() => setSelected(null)}
        onAction={handleAction}
        onComplete={handleComplete}
        onReschedule={handleReschedule}
        readOnly={!canManage}
      />
    </div>
  );
}
