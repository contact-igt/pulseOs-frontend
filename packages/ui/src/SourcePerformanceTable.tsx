"use client";

import { useState } from "react";
import type { SourcePerformanceRow } from "@pulseos/types";
import { Badge, Card, SectionHeading } from "./primitives";
import { formatInr, formatMoneyOrDash, formatRoas } from "./format";

type SortKey = "spend" | "enquiries" | "treatments" | "revenue" | "roas";

// A synced campaign's spend/performance numbers are only as real as the
// connector that produced them — a FIXTURE-mode campaign must never read as
// equivalent to a LIVE one anywhere this table is used (Command Centre,
// Campaigns/Sources). No badge at all for a manually-created campaign with
// no connectorMode (never synced, so the question doesn't apply).
function ConnectorModeBadge({ mode }: { mode: SourcePerformanceRow["connectorMode"] }) {
  if (!mode || mode === "LIVE") return null;
  return <Badge tone={mode === "SANDBOX" ? "warning" : "neutral"}>{mode === "SANDBOX" ? "Sandbox" : "Fixture"}</Badge>;
}

export function SourcePerformanceTable({
  rows,
  onRowClick,
  compact = false,
}: {
  rows: SourcePerformanceRow[];
  onRowClick?: (row: SourcePerformanceRow) => void;
  /** Narrow 3-column layout (source, revenue, ROAS) for a 1/3-width dashboard panel. */
  compact?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>(compact ? "revenue" : "spend");
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

  const columns: { key: SortKey; label: string }[] = compact
    ? [
        { key: "revenue", label: "Revenue" },
        { key: "roas", label: "ROAS" },
      ]
    : [
        { key: "spend", label: "Spend" },
        { key: "enquiries", label: "Enquiries" },
        { key: "treatments", label: "Treatments" },
        { key: "revenue", label: "Revenue" },
        { key: "roas", label: "ROAS" },
      ];

  return (
    <Card className={compact ? "overflow-hidden p-4" : "overflow-x-auto p-4"}>
      <SectionHeading title={compact ? "Top Sources by Revenue" : "Source / Campaign Performance"} />
      <table className={compact ? "w-full text-left text-xs" : "w-full min-w-[480px] text-left text-xs"}>
        <thead>
          <tr className="text-neutral-500">
            <th className="pb-1 font-medium">{compact ? "Source" : "Campaign"}</th>
            {columns.map((c) => (
              <th key={c.key} className="cursor-pointer pb-1 text-right font-medium hover:text-slate-900" onClick={() => toggleSort(c.key)}>
                {c.label}{sortKey === c.key ? (desc ? " ↓" : " ↑") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {(compact ? sorted.slice(0, 5) : sorted).map((row) => (
            <tr key={row.campaignId ?? row.source} className="cursor-pointer hover:bg-neutral-50" onClick={() => onRowClick?.(row)}>
              <td className="py-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="block truncate text-slate-900">{compact ? row.source : row.campaignName}</span>
                  <ConnectorModeBadge mode={row.connectorMode} />
                </span>
                {!compact && <span className="block text-[11px] text-neutral-400">{row.source}</span>}
              </td>
              {!compact && (
                <>
                  <td className="py-1.5 text-right tabular-nums">{formatInr(row.spend)}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.enquiries}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.treatments}</td>
                </>
              )}
              <td className="py-1.5 text-right tabular-nums">{formatMoneyOrDash(row.revenue)}</td>
              <td className="py-1.5 text-right tabular-nums font-medium">{formatRoas(row.roas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
