export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatMoneyOrDash(amount: number | null): string {
  return amount === null ? "—" : formatInr(amount);
}

// Compact form for dense dashboard contexts (KPI strips, Spend At Risk,
// chart axes) — ₹2.4L / ₹46.7K, never a 3-decimal rupee value. The one
// shared compact formatter; do not duplicate this logic per-page.
export function formatInrCompact(amount: number): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  if (abs >= 100_000) return `₹${(rounded / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `₹${(rounded / 1_000).toFixed(1)}K`;
  return `₹${rounded.toLocaleString("en-IN")}`;
}

export function formatRoas(roas: number | null): string {
  return roas === null ? "—" : `${roas.toFixed(1)}x`;
}
