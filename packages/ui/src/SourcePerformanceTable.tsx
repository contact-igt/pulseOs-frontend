"use client";

import { useState } from "react";
import type { SourcePerformanceRow } from "@pulseos/types";
import { Card, SectionHeading } from "./primitives";
import { formatInr, formatMoneyOrDash, formatRoas } from "./format";

type SortKey = "spend" | "enquiries" | "treatments" | "revenue" | "roas";

export function SourcePerformanceTable({ rows, onRowClick }: { rows: SourcePerformanceRow[]; onRowClick?: (row: SourcePerformanceRow) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [desc, setDesc] = useState(true);

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return desc ? bv - av : av - bv;
  });

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "spend", label: "Spend" },
    { key: "enquiries", label: "Enquiries" },
    { key: "treatments", label: "Treatments" },
    { key: "revenue", label: "Revenue" },
    { key: "roas", label: "ROAS" },
  ];

  return (
    <Card className="overflow-x-auto p-4">
      <SectionHeading title="Source / Campaign Performance" />
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead>
          <tr className="text-neutral-500">
            <th className="pb-1 font-medium">Campaign</th>
            {columns.map((c) => (
              <th key={c.key} className="cursor-pointer pb-1 text-right font-medium hover:text-slate-900" onClick={() => toggleSort(c.key)}>
                {c.label}{sortKey === c.key ? (desc ? " ↓" : " ↑") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {sorted.map((row) => (
            <tr key={row.campaignId ?? row.source} className="cursor-pointer hover:bg-neutral-50" onClick={() => onRowClick?.(row)}>
              <td className="py-1.5">
                <span className="block text-slate-900">{row.campaignName}</span>
                <span className="block text-[11px] text-neutral-400">{row.source}</span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatInr(row.spend)}</td>
              <td className="py-1.5 text-right tabular-nums">{row.enquiries}</td>
              <td className="py-1.5 text-right tabular-nums">{row.treatments}</td>
              <td className="py-1.5 text-right tabular-nums">{formatMoneyOrDash(row.revenue)}</td>
              <td className="py-1.5 text-right tabular-nums font-medium">{formatRoas(row.roas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
