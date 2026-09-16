export interface MetricCellDef {
  key: string;
  label: string;
  value: string | number;
  onClick?: () => void;
  testId?: string;
}

/**
 * One connected panel of metric cells with internal dividers — the pattern every
 * reference dashboard uses instead of N separate floating cards. Cells share one
 * border/background so the strip reads as a single instrument, not a card grid.
 */
export function MetricStrip({ cells, testId }: { cells: MetricCellDef[]; testId?: string }) {
  return (
    <div
      className="grid grid-cols-2 divide-x divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0"
      data-testid={testId}
    >
      {cells.map((cell) => {
        const testId = cell.testId ?? `metric-${cell.key}`;
        const content = (
          <>
            <span className="block text-2xl font-semibold tabular-nums text-slate-900">{cell.value}</span>
            <span className="mt-1 block text-xs leading-tight text-neutral-500">{cell.label}</span>
          </>
        );
        return cell.onClick ? (
          <button
            key={cell.key}
            type="button"
            onClick={cell.onClick}
            className="flex flex-col items-start px-4 py-3.5 text-left transition hover:bg-primary-50/60"
            data-testid={testId}
          >
            {content}
          </button>
        ) : (
          <div key={cell.key} className="px-4 py-3.5" data-testid={testId}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
