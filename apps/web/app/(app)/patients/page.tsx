"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@pulseos/api-client";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "@pulseos/ui";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import { hasPermission } from "@pulseos/types";
import type { JourneyStage } from "@pulseos/types";

const STAGE_TONE: Partial<Record<JourneyStage, "neutral" | "warning" | "danger" | "primary">> = {
  enquiry: "neutral",
  contacted: "neutral",
  booked: "primary",
  attended: "primary",
  consulted: "primary",
  treatment_advised: "warning",
  scheduled: "warning",
  completed: "primary",
  lost: "danger",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function PatientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quickCreate = useQuickCreate();
  // Seeds from the global TopBar search's `?q=` — otherwise a query typed
  // there silently vanishes on arrival here.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");

  const stageFilter = searchParams.get("filter") ?? undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", search],
    queryFn: () => api.patients({ search: search || undefined }),
  });

  // EDIT_PATIENTS gates patient creation server-side (Doctor doesn't have
  // it) — mirrored here only to avoid showing a dead control, never as the
  // actual authorization boundary.
  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  const canEditPatients = !!session.data && hasPermission(session.data.user.role, "EDIT_PATIENTS");

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-testid="patients-page">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Patients</h1>
          <p className="text-sm text-neutral-500">Find and understand people, not leads.</p>
        </div>
        {canEditPatients && (
          <button
            type="button"
            onClick={() => quickCreate.openAddPatient()}
            className="shrink-0 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
            data-testid="add-patient-button"
          >
            + Add Patient
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="search"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          data-testid="patient-search"
        />
        {stageFilter && <span className="text-xs text-neutral-400">Filtered from dashboard: {stageFilter}</span>}
      </div>

      <Card className="overflow-x-auto p-0">
        {isLoading && <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>}
        {isError && <div className="p-4"><ErrorState message="Could not load patients." /></div>}
        {data && data.length === 0 && (
          <div className="p-8">
            <EmptyState message="No patients found." />
            {canEditPatients && (
              <div className="mt-3 flex justify-center">
                <button type="button" onClick={() => quickCreate.openAddPatient()} className="text-xs font-medium text-primary-600 hover:underline">
                  + Add Patient
                </button>
              </div>
            )}
          </div>
        )}
        {data && data.length > 0 && (
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="border-b border-neutral-100 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Patient</th>
                <th className="px-2 py-2 font-medium">Branch</th>
                <th className="px-2 py-2 font-medium">Journeys</th>
                <th className="px-2 py-2 font-medium">Stage</th>
                <th className="px-2 py-2 font-medium">Source</th>
                <th className="px-2 py-2 font-medium">Last Interaction</th>
                <th className="px-2 py-2 font-medium">Next Action</th>
                <th className="px-2 py-2 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-neutral-50" onClick={() => router.push(`/patients/${p.id}`)}>
                  <td className="px-4 py-2">
                    <span className="block text-slate-900">{p.name}</span>
                    <span className="block text-[11px] text-neutral-400">{p.phone}</span>
                  </td>
                  <td className="px-2 py-2 text-neutral-600">{p.branchName ?? "—"}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{p.activeJourneyCount}</td>
                  <td className="px-2 py-2">
                    {p.currentStage ? <Badge tone={STAGE_TONE[p.currentStage] ?? "neutral"}>{p.currentStage.replace(/_/g, " ")}</Badge> : "—"}
                  </td>
                  <td className="px-2 py-2 text-neutral-600">{p.source ?? "—"}</td>
                  <td className="px-2 py-2 text-neutral-600">{fmtDate(p.lastInteractionAt)}</td>
                  <td className="px-2 py-2 text-neutral-600">{fmtDate(p.nextActionDueAt)}</td>
                  <td className="px-2 py-2 text-neutral-600">{p.ownerName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
