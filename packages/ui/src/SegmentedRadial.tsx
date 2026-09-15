import { Card, SectionHeading } from "./primitives";

export interface RadialSegment {
  key: string;
  label: string;
  count: number;
  pct: number;
  color: string;
}

export function SegmentedRadial({
  title,
  subtitle,
  segments,
  centerLabel,
  centerValue,
  onSegmentClick,
  testId,
}: {
  title: string;
  subtitle?: string;
  segments: RadialSegment[];
  centerLabel: string;
  centerValue: string;
  onSegmentClick?: (key: string) => void;
  testId?: string;
}) {
  const size = 220;
  const center = size / 2;
  const strokeWidth = 11;
  const gap = 3;
  const outerRadius = 92;

  // Center label geometry, computed rather than eyeballed: two SVG text
  // lines (value + label), each vertically centered on its own baseline via
  // dominant-baseline="central", stacked and centered as a block around the
  // ring's true (cx, cy). No magic per-pixel y offsets to retune by eye.
  const valueFontSize = 26;
  const labelFontSize = 11;
  const lineGap = 4;
  const blockHeight = valueFontSize + lineGap + labelFontSize;
  const valueY = center - blockHeight / 2 + valueFontSize / 2;
  const labelY = center - blockHeight / 2 + valueFontSize + lineGap + labelFontSize / 2;

  return (
    <Card className="p-4" data-testid={testId}>
      <SectionHeading title={title} subtitle={subtitle} />
      <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        {/* CSS controls the rendered box (aspect-square + a max-width cap,
            allowed to shrink below that in a tight flex row); viewBox stays
            fixed at the original 220-unit coordinate system so every radius/
            text-position computed above keeps working unchanged — the SVG
            just scales its whole content to fit, same technique as a
            responsive <img>. This is what actually avoids collision at
            1024px, where a hardcoded 220px box didn't leave the legend any
            room at all. */}
        <svg viewBox={`0 0 ${size} ${size}`} className="aspect-square w-full max-w-[170px] shrink" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
          {segments.map((seg, idx) => {
            const radius = outerRadius - idx * (strokeWidth + gap);
            const circumference = 2 * Math.PI * radius;
            const filled = (Math.min(seg.pct, 100) / 100) * circumference;
            return (
              <g key={seg.key}>
                <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-neutral-100)" strokeWidth={strokeWidth} />
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${filled} ${circumference - filled}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${center} ${center})`}
                  className={onSegmentClick ? "cursor-pointer transition-opacity hover:opacity-80" : undefined}
                  onClick={() => onSegmentClick?.(seg.key)}
                />
              </g>
            );
          })}
          <text x={center} y={valueY} textAnchor="middle" dominantBaseline="central" className="fill-slate-900 font-semibold" style={{ fontSize: valueFontSize, fontWeight: 600 }}>
            {centerValue}
          </text>
          <text x={center} y={labelY} textAnchor="middle" dominantBaseline="central" style={{ fontSize: labelFontSize, fill: "var(--color-neutral-500)" }}>
            {centerLabel}
          </text>
        </svg>

        <ul className="min-w-[140px] flex-1 space-y-1.5">
          {segments.map((seg) => (
            <li key={seg.key}>
              <button
                type="button"
                onClick={() => onSegmentClick?.(seg.key)}
                className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-neutral-50"
                data-testid={`radial-segment-${seg.key}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="min-w-0 flex-1 truncate text-xs text-neutral-600">{seg.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-slate-700">{seg.count}</span>
                <span className="w-9 shrink-0 text-right text-xs tabular-nums text-neutral-400">{seg.pct}%</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
