/** "today", "yesterday", "3 days ago" (whole calendar days). */
export function sentAgo(iso: string, now: Date = new Date()): string {
  const sent = new Date(iso);
  if (Number.isNaN(sent.getTime())) return 'recently';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(sent)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
