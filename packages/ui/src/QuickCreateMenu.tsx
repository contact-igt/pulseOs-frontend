"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

export interface QuickCreateItem {
  key: string;
  label: string;
  onClick: () => void;
}

export function QuickCreateMenu({ items }: { items: QuickCreateItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-primary-700"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="quick-create-button"
      >
        <Plus size={14} />
        Create
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg" role="menu" data-testid="quick-create-menu">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-100"
              data-testid={`quick-create-${item.key}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
