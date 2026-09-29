"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import {
  AwaitingOutcomeList,
  DoctorFlowRadial,
  DoctorKpiStrip,
  DoctorQuickStats,
  DoctorTodayList,
  ErrorState,
  RecentPatientsList,
  Skeleton,
} from "@pulseos/ui";

export default function DoctorHomePage() {
  const dashboard = useQuery({ queryKey: ["dashboard", "doctor"], queryFn: api.doctorDashboard });

  if (dashboard.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return <ErrorState message="Could not load your schedule." />;
  }

  const { data } = dashboard;

  return (
    <div className="mx-auto max-w-6xl space-y-5" data-testid="doctor-home">
      <DoctorKpiStrip dashboard={data} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <DoctorTodayList
          items={data.today}
          title="Today's Patient Queue"
          highlightId={data.nextPatient?.appointmentId}
          emptyMessage="No appointments on your schedule today."
        />
        <div className="space-y-5">
          <DoctorFlowRadial dashboard={data} />
          <DoctorQuickStats dashboard={data} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <AwaitingOutcomeList
          items={data.awaitingOutcome}
          title="Consultations Awaiting Outcome"
          emptyMessage="No consultations waiting on an outcome."
          showStatus={false}
        />
        <DoctorTodayList items={data.treatmentFollowUps} title="Treatment Follow-ups" emptyMessage="No treatment follow-ups due." showStatus={false} />
        <DoctorTodayList items={data.postCare} title="Post-care / Reviews" emptyMessage="No post-care reviews due." showStatus={false} />
      </div>

      <RecentPatientsList items={data.recentPatients} />
    </div>
  );
}
