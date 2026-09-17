/**
 * The issue month an admin sees and edits, as `YYYY-MM` — the same shape the
 * server stores and the `<input type="month">` control uses.
 */

/** This month, the default for a new newsletter. */
export function currentIssueMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** `2026-09` → `September 2026`; anything unparseable comes back unchanged. */
export function formatIssueMonth(issueMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(issueMonth ?? '');
  if (!match) return issueMonth ?? '';
  const monthIndex = Number(match[2]) - 1;
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${names[monthIndex] ?? match[2]} ${match[1]}`;
}
