import type { AnalyticsBucket } from "@pulseos/types";

/**
 * The bucket containing `today` is still collecting data, so its count is not
 * comparable to finished buckets. Split a series so that bucket sits on its own
 * "open" segment (drawn dashed, joined to the last complete point) instead of
 * reading as a real drop.
 */
export function splitInProgress(buckets: Pick<AnalyticsBucket, "key" | "to">[], values: number[], today: string) {
  const openIndex = buckets.findIndex((b) => b.key <= today && today <= b.to);
  return {
    openIndex,
    closed: values.map((v, i) => (openIndex !== -1 && i >= openIndex ? null : v)),
    open: values.map((v, i) => (openIndex !== -1 && (i === openIndex || i === openIndex - 1) ? v : null)),
  };
}
