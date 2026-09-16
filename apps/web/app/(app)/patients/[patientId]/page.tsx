"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import {
  Badge, Card, ErrorState, Skeleton, Timeline,
  JOURNEY_STAGE_LABEL, JOURNEY_STAGE_TONE, APPOINTMENT_STATUS_LABEL, TREATMENT_STATUS_LABEL,
} from "@pulseos/ui";
import { formatInr, formatMoneyOrDash, fmtDateTime as fmtDate } from "@pulseos/ui";
import { BackLink } from "@/components/shell/BackLink";
import type { AppointmentStatus, JourneyCardVm, JourneyStage, TreatmentStatus } from "@pulseos/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Four checkpoints a coordinator actually thinks in, collapsed from the
// finer-grained JourneyStage enum — "is this patient still pre-appointment,
// booked, in consultation, or into treatment?" at a glance, no separate
// funnel needed for a single journey.
const MINI_FLOW_STEPS = ["Enquiry", "Appointment", "Consultation", "Treatment"] as const;
const STAGE_CHECKPOINT: Partial<Record<JourneyStage, number>> = {
  enquiry: 0, contacted: 0, booked: 1, attended: 1, consulted: 2, treatment_advised: 2, scheduled: 3, completed: 3,
};

function JourneyMiniFlow({ stage }: { stage: JourneyStage }) {
  if (stage === "lost") return null;
  const current = STAGE_CHECKPOINT[stage] ?? 0;
  return (
    <div className="mt-2.5 flex items-center" aria-label={`Progress: ${MINI_FLOW_STEPS[current]}`}>
      {MINI_FLOW_STEPS.map((label, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                  done ? "bg-primary-500 text-white" : isCurrent ? "border-2 border-primary-500 bg-white text-primary-500" : "border border-neutral-300 bg-white text-neutral-300"
                }`}
              >
                {done ? "✓" : ""}
              </span>
              <span className={`whitespace-nowrap text-[10px] ${isCurrent ? "font-medium text-slate-900" : "text-neutral-400"}`}>{label}</span>
            </div>
            {i < MINI_FLOW_STEPS.length - 1 && <span className={`mx-1 mb-3.5 h-px flex-1 ${done ? "bg-primary-500" : "bg-neutral-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function JourneyCard({ journey, active, onClick }: { journey: JourneyCardVm; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-primary-500 bg-primary-50" : "border-neutral-200 bg-white hover:border-primary-300"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900">{journey.journeyType}</span>
        <Badge tone={JOURNEY_STAGE_TONE[journey.stage] ?? "neutral"}>{JOURNEY_STAGE_LABEL[journey.stage] ?? journey.stage}</Badge>
      </div>
      <JourneyMiniFlow stage={journey.stage} />
      <dl className="mt-3 space-y-0.5 text-xs text-neutral-500">
        <div className="flex justify-between"><dt>Owner</dt><dd>{journey.ownerName ?? "—"}</dd></div>
        <div className="flex justify-between"><dt>Doctor</dt><dd>{journey.doctorName ?? "—"}</dd></div>
        <div className="flex justify-between"><dt>Last interaction</dt><dd>{fmtDate(journey.lastInteractionAt)}</dd></div>
        <div className="flex justify-between"><dt>Next action</dt><dd>{fmtDate(journey.nextActionDueAt)}</dd></div>
        <div className="flex justify-between">
          <dt>Next appointment</dt>
          <dd>
            {journey.appointmentTime
              ? `${fmtDate(journey.appointmentTime)} · ${APPOINTMENT_STATUS_LABEL[journey.appointmentStatus as AppointmentStatus] ?? journey.appointmentStatus}`
              : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Treatment status</dt>
          <dd>
            {journey.treatmentLabel
              ? `${journey.treatmentLabel} · ${TREATMENT_STATUS_LABEL[journey.treatmentStatus as TreatmentStatus] ?? journey.treatmentStatus}`
              : "—"}
          </dd>
        </div>
      </dl>
    </button>
  );
}

export default function Patient360Page() {
  const params = useParams<{ patientId: string }>();
  const patientId = params.patientId;
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [showAllJourneys, setShowAllJourneys] = useState(true);

  const patient360 = useQuery({ queryKey: ["patient360", patientId], queryFn: () => api.patient360(patientId) });
  const currentJourneyId = selectedJourneyId ?? patient360.data?.journeys[0]?.id;
  const timeline = useQuery({
    queryKey: ["timeline", patientId, showAllJourneys ? "all" : currentJourneyId],
    queryFn: () => api.patientTimeline(patientId, showAllJourneys ? undefined : currentJourneyId),
    enabled: patient360.isSuccess,
  });

  if (patient360.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <Skeleton className="h-20" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (patient360.isError || !patient360.data) {
    return <ErrorState message="Could not load this patient." />;
  }

  const { patient, journeys, acquisition } = patient360.data;

  return (
    <div className="mx-auto max-w-6xl space-y-5" data-testid="patient-360">
      <BackLink fallback="/patients" fallbackLabel="Back to Patients" />

      {/* Header / patient context */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
            {initials(patient.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{patient.name}</h1>
              <span className="text-xs text-neutral-400">{journeys.length} active journey{journeys.length === 1 ? "" : "s"}</span>
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">
              {patient.phone} · {patient.preferredLanguage} · {patient.branchName ?? "No branch"}
            </p>
          </div>
        </div>
      </Card>

      {/* Main area: Timeline dominant (left), Journey/Next-Action context (right) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3 lg:order-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAllJourneys(true)}
              className={`rounded px-2 py-1 text-xs ${showAllJourneys ? "bg-primary-100 text-primary-700" : "text-neutral-500 hover:bg-neutral-100"}`}
            >
              All journeys
            </button>
            {!showAllJourneys && <span className="text-xs text-neutral-400">Showing timeline for the selected journey only</span>}
          </div>

          {timeline.isLoading ? (
            <Skeleton className="h-96" />
          ) : timeline.isError ? (
            <ErrorState message="Could not load the timeline." />
          ) : (
            timeline.data && <Timeline events={timeline.data} />
          )}
        </div>

        <div className="space-y-3 lg:order-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Journeys ({journeys.length})</h2>
          {journeys.map((j) => (
            <JourneyCard
              key={j.id}
              journey={j}
              active={!showAllJourneys && j.id === currentJourneyId}
              onClick={() => {
                setSelectedJourneyId(j.id);
                setShowAllJourneys(false);
              }}
            />
          ))}
        </div>
      </div>

      {/* Acquisition / revenue: subordinate, below the operational section */}
      <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Acquisition &amp; revenue</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Source</span>
            <span className="text-sm text-slate-700">{acquisition.source ?? "—"}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Campaign</span>
            <span className="text-sm text-slate-700">{acquisition.campaignName ?? "Organic / No campaign"}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">First touch</span>
            <span className="text-sm text-slate-700">{fmtDate(acquisition.firstTouchAt)}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Acquisition cost</span>
            <span className="text-sm text-slate-700">{formatMoneyOrDash(acquisition.allocatedAcquisitionCost)}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Est. treatment value</span>
            <span className="text-sm text-slate-700">{formatInr(acquisition.estimatedTreatmentValue)}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Attributed revenue</span>
            <span className="text-sm font-medium text-slate-700">{formatInr(acquisition.attributedRevenue)}</span>
          </div>
        </div>

        {acquisition.lastTouch && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-xs" data-testid="patient-last-touch">
            <span className="font-medium text-primary-700">Multi-touch:</span>
            <span className="text-primary-700">
              {acquisition.touchpointCount} touches recorded — most recently via <strong>{acquisition.lastTouch.source ?? "unknown source"}</strong>
              {acquisition.lastTouch.campaignName ? ` (${acquisition.lastTouch.campaignName})` : ""} on {fmtDate(acquisition.lastTouch.occurredAt)}. First touch above is preserved.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
