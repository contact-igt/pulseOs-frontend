/** Set/delete only the given params (undefined or "" deletes), keeping everything else (view, date, range...). */
export function patchSearch(params: URLSearchParams, patch: Record<string, string | undefined>): string {
  const next = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, value);
  }
  return next.toString();
}
