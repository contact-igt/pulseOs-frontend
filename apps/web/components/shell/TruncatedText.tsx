"use client";

import { useState, type ReactNode } from "react";

/**
 * Text that is cut off with an ellipsis, and says so: the full text appears as a tooltip ONLY when it really is truncated
 * (measured on hover/focus), so a label that fits never grows a redundant tooltip.
 */
export function TruncatedText({ children, className = "", as: Tag = "span" }: { children: ReactNode; className?: string; as?: "span" | "p" }) {
  const [title, setTitle] = useState<string | undefined>(undefined);
  const check = (el: HTMLElement) => setTitle(el.scrollWidth > el.clientWidth ? el.textContent ?? undefined : undefined);
  return (
    <Tag className={`truncate ${className}`} title={title} onMouseEnter={(e) => check(e.currentTarget)} onFocus={(e) => check(e.currentTarget)}>
      {children}
    </Tag>
  );
}
