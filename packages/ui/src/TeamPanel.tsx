import type { BranchDoctorRow, TeamWorkloadRow } from "@pulseos/types";
import { Card, SectionHeading } from "./primitives";

interface LoadRow {
  id: string;
  name: string;
  roleLabel: string;
  assigned: number;
  overdue: number;
  waiting: number;
}

function Bar({ row, max, onClick }: { row: LoadRow; max: number; onClick?: () => void }) {
  const pct = max > 0 ? (row.assigned / max) * 100 : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded px-1 py-1 text-left hover:bg-neutral-50"
      data-testid={`load-row-${row.id}`}
    >
      <span className="w-28 shrink-0 truncate text-xs text-neutral-700">{row.name}</span>
      <span className="w-20 shrink-0 truncate text-[10px] uppercase tracking-wide text-neutral-400">{row.roleLabel}</span>
      <div className="h-2 flex-1 rounded-full bg-neutral-100">
        <div className={`h-2 rounded-full ${row.overdue > 0 ? "bg-danger-500" : "bg-primary-400"}`} style={{ width: `${Math.max(pct, row.assigned > 0 ? 4 : 0)}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-700">{row.assigned}</span>
      <span className={`w-16 shrink-0 text-right text-xs tabular-nums ${row.overdue > 0 ? "text-danger-500" : "text-neutral-400"}`}>
        {row.overdue > 0 ? `${row.overdue} overdue` : row.waiting > 0 ? `${row.waiting} waiting` : ""}
      </span>
    </button>
  );
}

export function TeamPanel({
  team,
  doctors,
  onTeamClick,
  onDoctorClick,
}: {
  team: TeamWorkloadRow[];
  doctors: BranchDoctorRow[];
  onTeamClick?: (row: TeamWorkloadRow) => void;
  onDoctorClick?: (row: BranchDoctorRow) => void;
}) {
  const teamRows: LoadRow[] = team.map((r) => ({
    id: r.userId,
    name: r.name,
    roleLabel: r.role === "FRONT_DESK" ? "Front Desk" : "Coordinator",
    assigned: r.openTasks,
    overdue: r.overdueTasks,
    waiting: 0,
  }));
  const doctorRows: LoadRow[] = doctors.map((r) => ({
    id: r.id,
    name: r.name,
    roleLabel: "Doctor",
    assigned: r.appointments,
    overdue: 0,
    waiting: r.waitingLoad,
  }));

  const max = Math.max(...teamRows.map((r) => r.assigned), ...doctorRows.map((r) => r.assigned), 1);

  return (
    <Card className="p-4">
      <SectionHeading title="Team / Doctor Load" subtitle="Assigned work by person" />
      <div className="space-y-0.5">
        {teamRows.map((row) => {
          const source = team.find((t) => t.userId === row.id)!;
          return <Bar key={row.id} row={row} max={max} onClick={() => onTeamClick?.(source)} />;
        })}
        {doctorRows.map((row) => {
          const source = doctors.find((d) => d.id === row.id)!;
          return <Bar key={row.id} row={row} max={max} onClick={() => onDoctorClick?.(source)} />;
        })}
      </div>
    </Card>
  );
}
