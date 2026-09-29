import type { CSSProperties } from "react";

export interface MetricCellDef {
  key: string;
  label: string;
  value: string | number;
  onClick?: () => void;
  testId?: string;
}

/**
 * One connected panel of metric cells with hairline internal dividers — the
 * pattern every reference dashboard uses instead of N separate floating cards.
 * The strip adapts its column count to the number of cells.
 *
 * `anchorKey` marks ONE cell as the anchor metric (the blue emphasis surface). Use it for the single number the page is about,
 * never for several cells at once.
 */
export function MetricStrip({ cells, testId, anchorKey }: { cells: MetricCellDef[]; testId?: string; anchorKey?: string }) {
  const n = cells.length;
  const smCols = n <= 4 ? Math.max(n, 1) : 3;
  const style = { "--sm-cols": smCols, "--lg-cols": Math.max(n, 1) } as CSSProperties;
  const lastIndex = n - 1;

  // Only the last cell can leave a hole in a wrapped grid; let it span the rest of its row.
  function lastCellSpan(index: number): string {
    if (index !== lastIndex) return "";
    const mobile = n % 2 === 1 ? "max-sm:col-span-2 " : "";
    const rest = n % smCols === 1 ? "sm:max-lg:col-span-full" : n % smCols === 2 && smCols === 3 ? "sm:max-lg:col-span-2" : "";
    return mobile + rest;
  }

  return (
    <div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-panel sm:[grid-template-columns:repeat(var(--sm-cols),minmax(0,1fr))] lg:[grid-template-columns:repeat(var(--lg-cols),minmax(0,1fr))]"
      style={style}
      data-testid={testId}
    >
      {cells.map((cell, index) => {
        const cellTestId = cell.testId ?? `metric-${cell.key}`;
        const anchor = anchorKey !== undefined && anchorKey === cell.key;
        const surface = anchor ? "bg-primary-700 text-white" : "bg-surface";
        const content = (
          <>
            <span className={`block text-xl font-semibold leading-none tabular-nums ${anchor ? "text-white" : "text-ink"}`}>{cell.value}</span>
            <span className={`mt-1.5 block text-xs font-medium leading-tight ${anchor ? "text-primary-100" : "text-ink-2"}`}>{cell.label}</span>
          </>
        );
        const span = lastCellSpan(index);
        return cell.onClick ? (
          <button
            key={cell.key}
            type="button"
            onClick={cell.onClick}
            className={`flex min-w-0 flex-col items-start px-4 py-3 text-left transition ${anchor ? "hover:bg-primary-800" : "hover:bg-primary-50"} ${surface} ${span}`}
            data-testid={cellTestId}
          >
            {content}
          </button>
        ) : (
          <div key={cell.key} className={`min-w-0 px-4 py-3 ${surface} ${span}`} data-testid={cellTestId}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
