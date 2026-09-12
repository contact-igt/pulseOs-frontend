import type { JourneyHealth } from "@pulseos/types";
import { SegmentedRadial } from "./SegmentedRadial";

const COLORS: Record<string, string> = {
  contacted: "var(--color-chart-blue)",
  booked: "var(--color-chart-teal)",
  attended: "var(--color-chart-indigo)",
  consulted: "var(--color-chart-amber)",
  treatment_advised: "var(--color-chart-violet)",
};

export function JourneyHealthRadial({ data, onSegmentClick }: { data: JourneyHealth; onSegmentClick?: (key: string) => void }) {
  return (
    <SegmentedRadial
      title="Journey Health"
      subtitle={`${data.totalJourneys} journeys`}
      segments={data.segments.map((s) => ({ key: s.key, label: s.label, count: s.count, pct: s.pct, color: COLORS[s.key] ?? "var(--color-chart-blue)" }))}
      centerLabel="Journey Conversion"
      centerValue={`${data.overallPct}%`}
      onSegmentClick={onSegmentClick}
      testId="journey-health-radial"
    />
  );
}
