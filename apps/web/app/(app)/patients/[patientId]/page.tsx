"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { Badge, Card, ErrorState, Skeleton, Timeline } from "@pulseos/ui";
import { formatInr, formatMoneyOrDash } from "@pulseos/ui";
import type { JourneyCardVm } from "@pulseos/types";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function JourneyCard({ journey, active, onClick }: { journey: JourneyCardVm; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition ${active ? "border-primary-500 bg-primary-50" : "border-neutral-200 hover:border-primary-300"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900">{journey.journeyType}</span>
        <Badge tone={journey.stage === "lost" ? "danger" : "primary"}>{journey.stage.replace(/_/g, " ")}</Badge>
      </div>
      <dl className="mt-2 space-y-0.5 text-xs text-neutral-500">
        <div className="flex justify-between"><dt>Source</dt><dd>{journey.source}</dd></div>
        <div className="flex justify-between"><dt>Owner</dt><dd>{journey.ownerName ?? "—"}</dd></div>
        <div className="flex justify-between"><dt>Next action</dt><dd>{fmtDate(journey.nextActionDueAt)}</dd></div>
        {journey.appointmentTime && (
          <div className="flex justify-between"><dt>Appointment</dt><dd>{fmtDate(journey.appointmentTime)} · {journey.appointmentStatus}</dd></div>
        )}
        {journey.treatmentLabel && (
          <div className="flex justify-between"><dt>Treatment</dt><dd>{journey.treatmentLabel} · {journey.treatmentStatus}</dd></div>
        )}
      </dl>
    </button>
  );
}

export default function Patient360Page() {
  const params = useParams<{ patientId: string }>();
  const patientId = params.patientId;
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);

  const patient360 = useQuery({ queryKey: ["patient360", patientId], queryFn: () => api.patient360(patientId) });
  const currentJourneyId = selectedJourneyId ?? patient360.data?.journeys[0]?.id;
  const [showAllJourneys, setShowAllJourneys] = useState(true);
  const timeline = useQuery({
    queryKey: ["timeline", patientId, showAllJourneys ? "all" : currentJourneyId],
    queryFn: () => api.patientTimeline(patientId, showAllJourneys ? undefined : currentJourneyId),
    enabled: patient360.isSuccess,
  });

  if (patient360.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (patient360.isError || !patient360.data) {
    return <ErrorState message="Could not load this patient." />;
  }

  const { patient, journeys, acquisition } = patient360.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="patient-360">
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{patient.name}</h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              {patient.phone} · {patient.preferredLanguage} · {patient.branchName ?? "No branch"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4 sm:grid-cols-4">
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Source</span>
            <span className="text-sm text-slate-900">{acquisition.source ?? "—"}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Campaign</span>
            <span className="text-sm text-slate-900">{acquisition.campaignName ?? "Organic / No campaign"}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">First touch</span>
            <span className="text-sm text-slate-900">{fmtDate(acquisition.firstTouchAt)}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Acquisition cost</span>
            <span className="text-sm text-slate-900">{formatMoneyOrDash(acquisition.allocatedAcquisitionCost)}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Est. treatment value</span>
            <span className="text-sm text-slate-900">{formatInr(acquisition.estimatedTreatmentValue)}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Attributed revenue</span>
            <span className="text-sm font-medium text-primary-700">{formatInr(acquisition.attributedRevenue)}</span>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Journeys ({journeys.length})</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <Skeleton className="h-64" />
      ) : timeline.isError ? (
        <ErrorState message="Could not load the timeline." />
      ) : (
        timeline.data && <Timeline events={timeline.data} />
      )}
    </div>
  );
}
