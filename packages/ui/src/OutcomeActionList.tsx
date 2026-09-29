"use client";

import { useState } from "react";
import type { ConsultationOutcomeValue, DoctorTodayItem, TreatmentDefinitionVm } from "@pulseos/types";
import { Card, EmptyState, SectionHeading } from "./primitives";
import { fmtTime } from "./format";

const ACTIONS: { outcome: ConsultationOutcomeValue; label: string }[] = [
  { outcome: "CONSULTED", label: "Consultation Completed" },
  { outcome: "TREATMENT_ADVISED", label: "Treatment Advised" },
  { outcome: "DECISION_PENDING", label: "Decision Pending" },
  { outcome: "FOLLOW_UP_REQUIRED", label: "Follow-up Required" },
  { outcome: "NO_TREATMENT_REQUIRED", label: "No Treatment Required" },
];

// Outcomes that open a Treatment Opportunity on the API, so the doctor says which one.
const OUTCOMES_WITH_TREATMENT: ConsultationOutcomeValue[] = ["TREATMENT_ADVISED", "DECISION_PENDING"];

/** What the doctor picked for the treatment: a catalog procedure, or a free-text label when the catalog is empty. */
export type OutcomeTreatmentChoice = { treatmentDefinitionId: string } | { treatmentLabel: string };

const fieldClass = "rounded border border-neutral-200 px-2 py-1 text-xs text-slate-900 outline-none focus:border-primary-500";

export function OutcomeActionList({
  items,
  onRecord,
  pendingAppointmentId,
  getTreatmentOptions,
}: {
  items: DoctorTodayItem[];
  onRecord: (appointmentId: string, outcome: ConsultationOutcomeValue, treatment?: OutcomeTreatmentChoice) => void;
  pendingAppointmentId?: string | null;
  /**
   * The tenant's treatment catalog for this appointment's journey specialty (GET /treatment-catalog).
   * When provided, Treatment Advised / Decision Pending ask which treatment: a select of catalog
   * procedures, or a free-text field only if the catalog is empty. When omitted the outcome records at once.
   */
  getTreatmentOptions?: (item: DoctorTodayItem) => TreatmentDefinitionVm[];
}) {
  const [picking, setPicking] = useState<{ appointmentId: string; outcome: ConsultationOutcomeValue } | null>(null);
  const [definitionId, setDefinitionId] = useState("");
  const [freeText, setFreeText] = useState("");

  function closePicker() {
    setPicking(null);
    setDefinitionId("");
    setFreeText("");
  }

  return (
    <Card className="p-4">
      <SectionHeading title="Awaiting outcome" subtitle={`${items.length}`} />
      {items.length === 0 ? (
        <EmptyState message="Nothing awaiting an outcome" />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((item) => {
            const isPending = pendingAppointmentId === item.appointmentId;
            const options = getTreatmentOptions?.(item);
            const picker = picking?.appointmentId === item.appointmentId ? picking : null;
            const useCatalog = (options?.length ?? 0) > 0;
            const canConfirm = useCatalog ? definitionId !== "" : freeText.trim() !== "";
            return (
              <li key={item.appointmentId} className="py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-900">{item.patientName}</span>
                  <span className="text-xs tabular-nums text-neutral-500">{fmtTime(item.time)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.outcome}
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        if (options && OUTCOMES_WITH_TREATMENT.includes(a.outcome)) {
                          setPicking({ appointmentId: item.appointmentId, outcome: a.outcome });
                          setDefinitionId("");
                          setFreeText("");
                        } else {
                          closePicker();
                          onRecord(item.appointmentId, a.outcome);
                        }
                      }}
                      className="rounded border border-neutral-200 px-2 py-1 text-[11px] text-neutral-600 transition hover:border-primary-500 hover:text-primary-700 disabled:opacity-40"
                      data-testid={`outcome-${a.outcome}-${item.appointmentId}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                {picker && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid={`treatment-picker-${item.appointmentId}`}>
                    {useCatalog ? (
                      <select
                        aria-label="Treatment"
                        value={definitionId}
                        onChange={(e) => setDefinitionId(e.target.value)}
                        className={fieldClass}
                        data-testid={`treatment-select-${item.appointmentId}`}
                      >
                        <option value="">Select a treatment</option>
                        {options!.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        aria-label="Treatment"
                        value={freeText}
                        onChange={(e) => setFreeText(e.target.value)}
                        placeholder="Treatment"
                        className={fieldClass}
                        data-testid={`treatment-text-${item.appointmentId}`}
                      />
                    )}
                    <button
                      type="button"
                      disabled={isPending || !canConfirm}
                      onClick={() => {
                        onRecord(item.appointmentId, picker.outcome, useCatalog ? { treatmentDefinitionId: definitionId } : { treatmentLabel: freeText.trim() });
                        closePicker();
                      }}
                      className="rounded bg-primary-600 px-2 py-1 text-[11px] text-white transition hover:bg-primary-700 disabled:opacity-40"
                      data-testid={`treatment-confirm-${item.appointmentId}`}
                    >
                      Record
                    </button>
                    <button
                      type="button"
                      onClick={closePicker}
                      className="rounded border border-neutral-200 px-2 py-1 text-[11px] text-neutral-600 transition hover:border-neutral-300"
                      data-testid={`treatment-cancel-${item.appointmentId}`}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
