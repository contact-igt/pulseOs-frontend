"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { AppointmentDrawer, AppointmentList, ErrorState, Skeleton } from "@pulseos/ui";
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
    <div className="mx-auto max-w-6xl space-y-4" data-testid="appointments-page">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
        <div className="flex gap-0.5 rounded border border-neutral-200 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${tab === t.key ? "bg-primary-50 text-primary-700" : "text-neutral-500 hover:bg-neutral-100"}`}
              data-testid={`appointments-tab-${t.key}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700">
          <option value="">All branches</option>
          {lookups.data?.branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700">
          <option value="">All doctors</option>
          {lookups.data?.doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search patients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary-400"
        />
      </div>

      {appointments.isLoading ? (
        <Skeleton className="h-64" />
      ) : appointments.isError ? (
        <ErrorState message="Could not load appointments." />
      ) : (
        <AppointmentList
          title={TABS.find((t) => t.key === tab)!.label}
          rows={searched}
          onAction={handleAction}
          onComplete={handleComplete}
          onRowClick={(row) => setSelected(row)}
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
      />
    </div>
  );
}
