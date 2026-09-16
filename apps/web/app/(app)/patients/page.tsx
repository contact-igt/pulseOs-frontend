"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@pulseos/api-client";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, Table, TableBody, TableHead, Td, Th, Tr, fmtDate, JOURNEY_STAGE_LABEL, JOURNEY_STAGE_TONE } from "@pulseos/ui";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import { hasPermission } from "@pulseos/types";

const STAGE_LABEL = JOURNEY_STAGE_LABEL;
const STAGE_TONE = JOURNEY_STAGE_TONE;

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
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          data-testid="patient-search"
        />
        {data && <span className="text-xs text-neutral-400">{data.length} patient{data.length === 1 ? "" : "s"}</span>}
        {stageFilter && <span className="text-xs text-neutral-400">Filtered from dashboard: {stageFilter}</span>}
        {canEditPatients && (
          <Button variant="primary" onClick={() => quickCreate.openAddPatient()} data-testid="add-patient-button" className="ml-auto">
            + Add Patient
          </Button>
        )}
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
          <Table className="min-w-[820px]">
            <TableHead>
              <tr>
                <Th leading>Patient</Th>
                <Th>Branch</Th>
                <Th align="center">Journeys</Th>
                <Th>Stage</Th>
                <Th>Source</Th>
                <Th>Last Interaction</Th>
                <Th>Next Action</Th>
                <Th>Owner</Th>
              </tr>
            </TableHead>
            <TableBody>
              {data.map((p) => (
                <Tr key={p.id} onClick={() => router.push(`/patients/${p.id}`)}>
                  <Td leading>
                    <span className="block text-slate-900">{p.name}</span>
                    <span className="block text-[11px] text-neutral-400">{p.phone}</span>
                  </Td>
                  <Td className="text-neutral-600">{p.branchName ?? "—"}</Td>
                  <Td align="center">{p.activeJourneyCount}</Td>
                  <Td>{p.currentStage ? <Badge tone={STAGE_TONE[p.currentStage] ?? "neutral"}>{STAGE_LABEL[p.currentStage] ?? p.currentStage}</Badge> : "—"}</Td>
                  <Td className="text-neutral-600">{p.source ?? "—"}</Td>
                  <Td className="text-neutral-600">{fmtDate(p.lastInteractionAt)}</Td>
                  <Td className="text-neutral-600">{fmtDate(p.nextActionDueAt)}</Td>
                  <Td className="text-neutral-600">{p.ownerName ?? "—"}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
