import type { BranchDoctorRow } from "@pulseos/types";
import { Card, SectionHeading } from "./primitives";

export function BranchDoctorPanel({ rows, onRowClick }: { rows: BranchDoctorRow[]; onRowClick?: (row: BranchDoctorRow) => void }) {
  return (
    <Card className="overflow-hidden p-4">
      <SectionHeading title="Branch / Doctor" />
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-neutral-500">
            <th className="pb-1 font-medium">Doctor</th>
            <th className="pb-1 text-right font-medium">Appointments</th>
            <th className="pb-1 text-right font-medium">Waiting</th>
            <th className="pb-1 text-right font-medium">Consultations</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row) => (
            <tr key={row.id} className="cursor-pointer hover:bg-neutral-50" onClick={() => onRowClick?.(row)}>
              <td className="py-1.5 text-slate-900">{row.name}</td>
              <td className="py-1.5 text-right tabular-nums">{row.appointments}</td>
              <td className="py-1.5 text-right tabular-nums">{row.waitingLoad}</td>
              <td className="py-1.5 text-right tabular-nums">{row.consultations}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
