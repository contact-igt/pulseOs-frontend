/**
 * India-first phone normalization: strips everything but digits, then drops a
 * leading "91" country code if the remainder is still a valid 10-digit
 * number, so "+91 98765 43210", "919876543210", and "9876543210" all
 * normalize to the same "9876543210" key for duplicate-patient lookup.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}
