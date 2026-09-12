"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MarketingSourceRow } from "@pulseos/types";
import { Card, SectionHeading } from "./primitives";

const SOURCE_LABEL: Record<MarketingSourceRow["source"], string> = {
  meta: "Meta",
  google: "Google",
  website: "Website",
  whatsapp: "WhatsApp",
  walk_in: "Walk-in",
  referral: "Referral",
};

type SortKey = "volume" | "spend" | "appointments" | "treatmentConversion" | "revenue" | "roas";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "volume", label: "Enquiries" },
  { key: "spend", label: "Spend" },
  { key: "appointments", label: "Appointments" },
  { key: "treatmentConversion", label: "Treatments" },
  { key: "revenue", label: "Revenue" },
  { key: "roas", label: "ROAS" },
];

function money(n: number) {
  return n > 0 ? `₹${n.toLocaleString("en-IN")}` : "—";
}

export function MarketingPanel({ rows, onSourceClick }: { rows: MarketingSourceRow[]; onSourceClick?: (source: MarketingSourceRow["source"]) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      return desc ? bv - av : av - bv;
    });
    return copy;
  }, [rows, sortKey, desc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  }

  return (
    <Card className="overflow-hidden p-4">
      <SectionHeading title="Source Performance" subtitle="Acquisition to revenue" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="text-neutral-500">
              <th className="pb-1.5 font-medium">Source</th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="pb-1.5 text-right font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-0.5 hover:text-slate-900"
                    data-testid={`sort-${col.key}`}
                  >
                    {col.label}
                    {sortKey === col.key ? (
                      desc ? <ChevronDown size={12} /> : <ChevronUp size={12} />
                    ) : (
                      <ChevronDown size={12} className="opacity-0" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sorted.map((row) => (
              <tr key={row.source} className="cursor-pointer hover:bg-neutral-50" onClick={() => onSourceClick?.(row.source)} data-testid={`source-row-${row.source}`}>
                <td className="py-1.5 text-slate-900">{SOURCE_LABEL[row.source]}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-600">{row.volume}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-600">{money(row.spend)}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-600">{row.appointments}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-600">{row.treatmentConversion}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-900">{money(row.revenue)}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-900">{row.roas !== null ? `${row.roas}×` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
