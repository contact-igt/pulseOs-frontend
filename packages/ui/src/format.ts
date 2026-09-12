export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatMoneyOrDash(amount: number | null): string {
  return amount === null ? "—" : formatInr(amount);
}

export function formatRoas(roas: number | null): string {
  return roas === null ? "—" : `${roas.toFixed(1)}x`;
}
