"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { Search } from "lucide-react";
import {
  AppointmentDrawer,
  AppointmentList,
  Button,
  CalendarView,
  ErrorState,
  FilterBar,
  FilterSelect,
  Skeleton,
  Tabs,
  Toolbar,
  ViewSwitcher,
  formatKey,
} from "@pulseos/ui";
import { hasPermission } from "@pulseos/types";
import type { AppointmentRow } from "@pulseos/types";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import { useViewState } from "@/lib/useViewState";
import { APPOINTMENT_VIEWS, LIST_TABS, appointmentQuery, matchesSearch, toCalendarEvent } from "@/components/appointments/appointmentViews";
import type { AppointmentView, ListTab } from "@/components/appointments/appointmentViews";
import { useAppointmentActions, useCalendarContext, useUrlFilters } from "@/components/appointments/hooks";
import { DoctorScheduleView } from "@/components/appointments/DoctorScheduleView";
import { InlineNotice } from "@/components/appointments/InlineNotice";
import { renderAppointmentEvent } from "@/components/appointments/AppointmentEventBody";

const TAB_LABEL: Record<ListTab, string> = { today: "Today", upcoming: "Upcoming", no_show: "No-shows", completed: "Completed" };

// Text-only segments so all five fit a 390px phone without scrolling.
const VIEW_OPTIONS: { key: AppointmentView; label: string; controls: string }[] = [
  { key: "list", label: "List", controls: "appointments-view-panel" },
  { key: "day", label: "Day", controls: "appointments-view-panel" },
  { key: "week", label: "Week", controls: "appointments-view-panel" },
  { key: "month", label: "Month", controls: "appointments-view-panel" },
  { key: "doctors", label: "Doctors", controls: "appointments-view-panel" },
];

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const quickCreate = useQuickCreate();
  const { timeZone, today } = useCalendarContext();
  const { view, date, setView, setDate } = useViewState<AppointmentView>({ views: APPOINTMENT_VIEWS, defaultView: "list", timeZone });
  const filters = useUrlFilters();
  const rawTab = filters.get("tab");
  const tab: ListTab = LIST_TABS.find((t) => t === rawTab) ?? "today";
  const branchId = filters.get("branch");
  const doctorId = filters.get("doctor");
  const [search, setSearch] = useState(() => filters.get("q"));
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

  // One query for every view: same endpoint, same filters; only the day range follows the view + ?date.
  const query = appointmentQuery({ view, tab, date, branchId, doctorId });
  const appointments = useQuery({
    queryKey: ["appointments", query],
    queryFn: () => api.appointmentsInRange(query),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["timeline"] });
    // Check-in/status changes move Front Desk's Patient Flow counts and the
    // Command Centre's today/patient-flow KPIs — keep both in sync, not just
    // this table (the sync rule: an action's effect must be visible wherever
    // it's shown, not only where it was taken).
    queryClient.invalidateQueries({ queryKey: ["front-desk"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);
  const closeDrawer = useCallback(() => setSelected(null), [setSelected]);
  const actions = useAppointmentActions({ refresh: invalidate, onDone: closeDrawer });

  const rows = useMemo(() => appointments.data ?? [], [appointments.data]);
  const visibleRows = useMemo(() => {
    const byTab =
      view === "list" && tab === "upcoming"
        ? rows.filter((r) => new Date(r.scheduledAt) > new Date() && r.status !== "completed" && r.status !== "cancelled")
        : rows;
    return byTab.filter((r) => matchesSearch(r, search));
  }, [rows, view, tab, search]);
  const events = useMemo(() => visibleRows.map(toCalendarEvent), [visibleRows]);

  const dayLabel = date === today ? "Today" : formatKey(date, { weekday: "short", day: "numeric", month: "short" });
  const tabLabel = (t: ListTab) => (t === "today" ? dayLabel : TAB_LABEL[t]);

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
          <div className="max-w-full overflow-x-auto">
            <ViewSwitcher ariaLabel="Appointments view" value={view} onChange={(v) => setView(v)} options={VIEW_OPTIONS} />
          </div>
          {view === "list" && (
            <Tabs
              ariaLabel="Appointment list"
              items={LIST_TABS.map((t) => ({ key: t, label: tabLabel(t), testId: `appointments-tab-${t}` }))}
              value={tab}
              onChange={(k) => filters.set({ tab: k === "today" ? undefined : k })}
            />
          )}
          <FilterBar>
            <FilterSelect value={branchId} onChange={(e) => filters.set({ branch: e.target.value })} aria-label="Branch">
              <option value="">All branches</option>
              {lookups.data?.branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={doctorId} onChange={(e) => filters.set({ doctor: e.target.value })} aria-label="Doctor">
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
                onChange={(e) => {
                  setSearch(e.target.value);
                  filters.set({ q: e.target.value.trim() ? e.target.value : undefined });
                }}
                className="h-full w-full bg-transparent pl-8 pr-2.5 text-xs text-ink outline-none placeholder:text-neutral-500"
              />
            </label>
          </FilterBar>
        </div>
      </Toolbar>

      {actions.error && <InlineNotice message={actions.error} onDismiss={actions.clearError} testId="appointments-action-error" />}

      <div id="appointments-view-panel" role="tabpanel" data-testid={`appointments-view-${view}`} data-from={query.from} data-to={query.to} className="min-w-0">
        {appointments.isLoading ? (
          <Skeleton className="h-64" />
        ) : appointments.isError ? (
          <ErrorState message="Could not load appointments." />
        ) : view === "list" ? (
          <AppointmentList
            title={tabLabel(tab)}
            rows={visibleRows}
            onAction={canManage ? actions.handleAction : undefined}
            onComplete={canManage ? actions.handleComplete : undefined}
            onRowClick={(row) => setSelected(row)}
            showBranch
            showDate={tab !== "today"}
            emptyMessage="No appointments match these filters."
          />
        ) : view === "doctors" ? (
          <DoctorScheduleView rows={visibleRows} date={date} today={today} timeZone={timeZone} onDateChange={setDate} onSelect={setSelected} />
        ) : (
          <CalendarView
            events={events}
            mode={view}
            date={date}
            onDateChange={setDate}
            timeZone={timeZone}
            onEventClick={(e) => e.data && setSelected(e.data)}
            renderEvent={renderAppointmentEvent}
            ariaLabel="Appointments calendar"
            emptyMessage="No appointments in this period."
          />
        )}
      </div>

      <AppointmentDrawer
        appointment={selected}
        recentEvents={timeline.data}
        onClose={closeDrawer}
        onAction={actions.handleAction}
        onComplete={actions.handleComplete}
        onReschedule={actions.handleReschedule}
        readOnly={!canManage}
      />
    </div>
  );
}
