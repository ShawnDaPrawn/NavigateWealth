/** Two-digit position label: 1 → "01". */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "1 Oct 2026", as the Navigator boards write dates on cards (the en-ZA locale
 * would say "01 Sept"). Empty for a missing or unreadable date.
 */
export function formatCardDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
