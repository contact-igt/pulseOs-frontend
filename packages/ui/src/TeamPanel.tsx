import type { TeamWorkloadRow } from "@pulseos/types";
import { Badge, Card, SectionHeading } from "./primitives";

export function TeamPanel({ rows, onRowClick }: { rows: TeamWorkloadRow[]; onRowClick?: (row: TeamWorkloadRow) => void }) {
  return (
    <Card className="p-4">
      <SectionHeading title="Team" />
      <ul className="divide-y divide-neutral-100">
        {rows.map((row) => (
          <li key={row.userId}>
            <button
              type="button"
              onClick={() => onRowClick?.(row)}
              className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-neutral-50"
            >
              <span className="text-sm text-slate-900">{row.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-neutral-500">{row.openTasks} open</span>
                {row.overdueTasks > 0 && <Badge tone="danger">{row.overdueTasks} overdue</Badge>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
