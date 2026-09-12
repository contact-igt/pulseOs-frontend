"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { DoctorTodayList, ErrorState, NextPatientCard, OutcomeActionList, Skeleton } from "@pulseos/ui";
import type { ConsultationOutcomeValue } from "@pulseos/types";

export default function DoctorHomePage() {
  const queryClient = useQueryClient();
  const dashboard = useQuery({ queryKey: ["dashboard", "doctor"], queryFn: api.doctorDashboard });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const recordOutcome = useMutation({
    mutationFn: ({ appointmentId, outcome }: { appointmentId: string; outcome: ConsultationOutcomeValue }) =>
      api.recordOutcome(appointmentId, { outcome }),
    onMutate: ({ appointmentId }) => setPendingId(appointmentId),
    onSuccess: (_data, { outcome }) => {
      setFeedback(`Outcome recorded: ${outcome.replace(/_/g, " ").toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor"] });
      setTimeout(() => setFeedback(null), 4000);
    },
    onSettled: () => setPendingId(null),
  });

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

      {feedback && (
        <p role="status" className="rounded bg-primary-50 px-3 py-2 text-xs text-primary-700">
          {feedback}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <NextPatientCard dashboard={data} />
        </div>
        <div className="lg:col-span-2">
          <DoctorTodayList items={data.today} title="Today's appointments" />
        </div>
      </div>

      <OutcomeActionList
        items={data.awaitingOutcome}
        pendingAppointmentId={pendingId}
        onRecord={(appointmentId, outcome) => recordOutcome.mutate({ appointmentId, outcome })}
      />
    </div>
  );
}
