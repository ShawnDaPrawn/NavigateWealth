/**
 * The admin dashboard's "Practice at a glance" period: This month, Last 30
 * days or This year. Each period is compared with the one before it of the
 * same kind (last month; the 30 days before; last year to the same date).
 */

export const DASHBOARD_PERIODS = ['month', '30d', 'year'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export interface PeriodWindow {
  start: Date;
  previousStart: Date;
  /** Exclusive. */
  previousEnd: Date;
}

const DAY_MS = 86_400_000;

export function periodWindow(period: DashboardPeriod, now: Date = new Date()): PeriodWindow {
  if (period === '30d') {
    const start = new Date(now.getTime() - 30 * DAY_MS);
    return { start, previousStart: new Date(now.getTime() - 60 * DAY_MS), previousEnd: start };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const previousEnd = new Date(now);
    previousEnd.setFullYear(now.getFullYear() - 1);
    return { start, previousStart: new Date(now.getFullYear() - 1, 0, 1), previousEnd };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start,
    previousStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    previousEnd: start,
  };
}

/** How many dates fall in the period, and in the period before it. */
export function countInPeriod(
  dates: Array<string | undefined | null>,
  window: PeriodWindow,
): { current: number; previous: number } {
  let current = 0;
  let previous = 0;
  for (const raw of dates) {
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    if (d >= window.start) current += 1;
    else if (d >= window.previousStart && d < window.previousEnd) previous += 1;
  }
  return { current, previous };
}

export function parseDashboardPeriod(raw: string | undefined): DashboardPeriod | null {
  if (raw === undefined || raw === '') return 'month';
  return (DASHBOARD_PERIODS as readonly string[]).includes(raw) ? (raw as DashboardPeriod) : null;
}
