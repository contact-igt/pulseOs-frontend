import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

// The shared table grammar — Patients/Leads/Treatments/Journeys/Campaign
// Detail/Integrations already agreed on nearly this exact rhythm before
// this extraction (confirmed by reading all six), so this is a thin,
// no-behavior wrapper around native <table> markup that removes the
// className duplication, not a new generic DataTable abstraction. Compact
// row height (not the airier 44-48px some enterprise guides suggest) is
// deliberate — PulseOS's own VISUAL_DENSITY=8 target calls for dense, not
// spacious, tables.

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <table className={`w-full text-left text-xs ${className}`}>{children}</table>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-neutral-100 text-neutral-500">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-neutral-100">{children}</tbody>;
}

export function Tr({
  children,
  onClick,
  className = "",
  ...rest
}: { children: ReactNode; onClick?: () => void; className?: string } & HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`${onClick ? "cursor-pointer " : ""}hover:bg-neutral-50 ${className}`} onClick={onClick} {...rest}>
      {children}
    </tr>
  );
}

interface CellProps {
  children: ReactNode;
  /** The leading identity column gets a wider gutter (px-4) than interior columns (px-2). */
  leading?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
}

const ALIGN_CLASS = { left: "", right: "text-right tabular-nums", center: "text-center tabular-nums" } as const;

export function Th({ children, leading = false, align = "left", className = "", ...rest }: CellProps & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`${leading ? "px-4" : "px-2"} py-2.5 font-medium ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""} ${className}`} {...rest}>
      {children}
    </th>
  );
}

export function Td({ children, leading = false, align = "left", className = "", ...rest }: CellProps & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`${leading ? "px-4" : "px-2"} py-2.5 ${ALIGN_CLASS[align]} ${className}`} {...rest}>
      {children}
    </td>
  );
}
