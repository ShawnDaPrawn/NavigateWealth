/** Non-component helpers for the shared profile sections (kept apart for fast refresh). */

export type Audience = 'client' | 'adviser';

/** Pick the client's wording ("you") or the adviser's ("the client"). */
export function says(audience: Audience, client: string, adviser: string): string {
  return audience === 'client' ? client : adviser;
}

/** Today as YYYY-MM-DD in the browser's time zone. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A short random id for a new list row. */
export function newRowId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
