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

  return (
    <Card className="p-4" data-testid={testId}>
      <SectionHeading title={title} subtitle={subtitle} />
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
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
          <text x={center} y={center - 6} textAnchor="middle" className="fill-slate-900 text-[26px] font-semibold" style={{ fontSize: 26, fontWeight: 600 }}>
            {centerValue}
          </text>
          <text x={center} y={center + 16} textAnchor="middle" style={{ fontSize: 10.5, fill: "var(--color-neutral-500)" }}>
            {centerLabel}
          </text>
        </svg>

        <ul className="w-full space-y-1.5">
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
