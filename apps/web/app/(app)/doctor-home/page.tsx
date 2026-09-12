"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { AwaitingOutcomeList, DoctorTodayList, ErrorState, NextPatientCard, Skeleton } from "@pulseos/ui";

export default function DoctorHomePage() {
  const dashboard = useQuery({ queryKey: ["dashboard", "doctor"], queryFn: api.doctorDashboard });

  if (dashboard.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-40 lg:col-span-1" />
          <Skeleton className="h-40 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return <ErrorState message="Could not load your schedule." />;
  }

  const { data } = dashboard;

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="doctor-home">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Your day</h1>
        <p className="text-sm text-neutral-500">
          {data.todayCount} appointments today · {data.waitingCount} waiting now
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <NextPatientCard dashboard={data} />
        </div>
        <div className="lg:col-span-2">
          <DoctorTodayList items={data.today} title="Today's appointments" />
        </div>
      </div>

      <AwaitingOutcomeList items={data.awaitingOutcome} title="Awaiting outcome" />
    </div>
  );
}
