"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@pulseos/api-client";
import {
  DoctorKpiStrip,
  DoctorTodayList,
  ErrorState,
  NextPatientCard,
  OutcomeActionList,
  RecentPatientsList,
  Skeleton,
  type OutcomeTreatmentChoice,
} from "@pulseos/ui";
import type { ConsultationOutcomeValue, DoctorTodayItem } from "@pulseos/types";

const OUTCOME_NOTICE: Record<ConsultationOutcomeValue, string> = {
  CONSULTED: "Consultation completed",
  TREATMENT_ADVISED: "Treatment advised",
  NO_TREATMENT_REQUIRED: "No treatment required",
  DECISION_PENDING: "Decision pending",
  FOLLOW_UP_REQUIRED: "Follow-up required",
  REFERRED: "Referred",
  OTHER: "Outcome",
};

const ERROR_TEXT: Record<string, string> = {
  outcome_already_recorded: "An outcome was already recorded for this consultation. The list has been refreshed.",
  invalid_treatment_definition: "That treatment is no longer available in the catalog. Pick another one.",
  appointment_not_found: "This appointment could not be found.",
};

type Notice = { kind: "success" | "error"; text: string };

function patientLink(item: { patientId?: string }, children: ReactNode) {
  if (!item.patientId) return children;
  return (
    <Link href={`/patients/${item.patientId}`} className="min-w-0 hover:text-primary-700 hover:underline">
      {children}
    </Link>
  );
}

export default function DoctorHomePage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice | null>(null);

  const dashboard = useQuery({ queryKey: ["dashboard", "doctor"], queryFn: api.doctorDashboard });
  // The tenant's whole catalog, once; each awaiting row is offered only the slice matching its journey's specialty.
  const catalog = useQuery({ queryKey: ["treatment-catalog"], queryFn: () => api.treatmentCatalog() });

  const recordOutcome = useMutation({
    mutationFn: (vars: { item: DoctorTodayItem; outcome: ConsultationOutcomeValue; treatment?: OutcomeTreatmentChoice }) =>
      api.recordOutcome(vars.item.appointmentId, { outcome: vars.outcome, ...vars.treatment }),
    onSuccess: (_result, vars) => {
      const choice = vars.treatment;
      const treatmentName = !choice ? undefined : "treatmentDefinitionId" in choice ? catalog.data?.find((d) => d.id === choice.treatmentDefinitionId)?.label : choice.treatmentLabel;
      setNotice({
        kind: "success",
        text: `Outcome recorded: ${OUTCOME_NOTICE[vars.outcome]}${treatmentName ? ` (${treatmentName})` : ""} for ${vars.item.patientName}.`,
      });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.message : "";
      setNotice({ kind: "error", text: ERROR_TEXT[code] ?? "Could not record the outcome. Please try again." });
    },
    // Success or failure, the queue must reflect the server (a 409 means someone already recorded it).
    onSettled: () => {
      for (const key of ["dashboard", "treatments", "journeys", "patients", "patient360", "timeline", "journey"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  if (dashboard.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_1fr]">
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
  const nextStatus = data.nextPatient ? data.today.find((i) => i.appointmentId === data.nextPatient!.appointmentId)?.status : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-testid="doctor-home">
      <DoctorKpiStrip dashboard={data} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0 space-y-4">
          <NextPatientCard patient={data.nextPatient} status={nextStatus} renderPatientLink={patientLink} />
          <DoctorTodayList
            items={data.today}
            title="Today's patient queue"
            highlightId={data.nextPatient?.appointmentId}
            emptyMessage="No appointments on your schedule today."
            renderPatientLink={patientLink}
            testId="doctor-queue"
          />
        </div>

        <div className="min-w-0 space-y-3">
          {notice && (
            <div
              role={notice.kind === "error" ? "alert" : "status"}
              className={`flex items-start justify-between gap-3 rounded-card border px-3 py-2 text-xs ${
                notice.kind === "error" ? "border-danger-500/30 bg-danger-100 text-danger-700" : "border-primary-200 bg-surface-info text-primary-800"
              }`}
              data-testid="outcome-notice"
            >
              <span className="min-w-0 break-words">{notice.text}</span>
              <button type="button" onClick={() => setNotice(null)} className="shrink-0 font-medium underline-offset-2 hover:underline">
                Dismiss
              </button>
            </div>
          )}
          <OutcomeActionList
            title="Consultations awaiting outcome"
            items={data.awaitingOutcome}
            emptyMessage="No consultations waiting on an outcome."
            pendingAppointmentId={recordOutcome.isPending ? recordOutcome.variables?.item.appointmentId : null}
            renderPatientLink={patientLink}
            // Only the procedures of this journey's own service; an empty slice falls back to a free-text label.
            getTreatmentOptions={(item) => (catalog.data ?? []).filter((d) => !!item.specialtyKey && d.specialtyKey === item.specialtyKey)}
            onRecord={(appointmentId, outcome, treatment) => {
              const item = data.awaitingOutcome.find((i) => i.appointmentId === appointmentId);
              if (!item) return;
              setNotice(null);
              recordOutcome.mutate({ item, outcome, treatment });
            }}
          />
          <p className="px-1 text-[11px] leading-4 text-ink-2">
            Outcomes here drive follow-up, treatment tracking and revenue. Clinical notes and prescriptions stay in your hospital&rsquo;s clinical system.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <DoctorTodayList
          items={data.treatmentFollowUps}
          title="Treatment follow-up"
          emptyMessage="No treatment follow-ups due."
          showStatus={false}
          renderPatientLink={patientLink}
          testId="doctor-treatment-follow-up"
        />
        <DoctorTodayList
          items={data.postCare}
          title="Post-care reviews"
          emptyMessage="No post-care reviews due."
          showStatus={false}
          renderPatientLink={patientLink}
          testId="doctor-post-care"
        />
      </div>

      <RecentPatientsList items={data.recentPatients} renderPatientLink={patientLink} />
    </div>
  );
}
