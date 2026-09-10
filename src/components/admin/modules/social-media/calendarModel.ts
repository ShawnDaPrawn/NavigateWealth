/**
 * Calendar — pure date-window helpers (Guidelines §7.1).
 *
 * The posts query has to cover whatever the calendar is showing, otherwise
 * navigating to an older month or far ahead renders an empty grid while
 * Buffer has posts there. `visibleWindow` says what a view shows; the tab
 * unions it into the query range so the range only ever grows.
 */

export type CalendarViewMode = 'month' | 'week' | 'day';

export interface DateRange {
  start: Date;
  end: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 of the week containing `date`, without mutating the input. */
export function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day + (day === 0 ? -6 : 1));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** The span a calendar view renders, with a week of margin on the month grid's edges. */
export function visibleWindow(selectedDate: Date, viewMode: CalendarViewMode): DateRange {
  if (viewMode === 'month') {
    const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const last = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    return {
      start: new Date(first.getTime() - 7 * DAY_MS),
      end: new Date(last.getTime() + 8 * DAY_MS),
    };
  }
  if (viewMode === 'week') {
    const start = startOfWeek(selectedDate);
    return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
  }
  const start = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  );
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function unionRange(a: DateRange, b: DateRange): DateRange {
  return {
    start: a.start.getTime() <= b.start.getTime() ? a.start : b.start,
    end: a.end.getTime() >= b.end.getTime() ? a.end : b.end,
  };
}

export function sameRange(a: DateRange, b: DateRange): boolean {
  return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
}

/** Whether `range` already covers `window` (so no refetch is needed). */
export function covers(range: DateRange, window: DateRange): boolean {
  return (
    range.start.getTime() <= window.start.getTime() && range.end.getTime() >= window.end.getTime()
  );
}
