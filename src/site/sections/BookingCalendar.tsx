/**
 * BookingCalendar — the booking's month grid, drawn as the board draws it.
 *
 * Which days can be booked is decided by the rules the live booking flow uses
 * (isBookingDateDisabled: no weekends, and at least one full business day's
 * notice), so the two designs offer exactly the same dates. Like the live
 * calendar it looks forward without limit; it does not go back before the
 * current month, where nothing can be booked.
 *
 * The days take one tab stop between them. The arrow keys move a day or a
 * week, Home and End to the start and end of the week, Page Up and Page Down
 * a month, skipping days that cannot be booked; Enter or Space picks the day.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { addDays, addMonths, format, isSameDay, startOfDay } from 'date-fns';
import {
  getCurrentSASTTime,
  isBookingDateDisabled,
  isPastCalendarDay,
} from '../../components/modals/consultationBooking';
import { BookingIcon } from './BookingIcons';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

interface BookingCalendarProps {
  /** Months after the current one that the grid shows (0 = this month). */
  offset: number;
  onOffset: (offset: number) => void;
  selected?: Date;
  onSelect: (date: Date) => void;
  /** The id of the message saying a date is needed, while it shows. */
  errorId?: string;
  /** Receives the day button that holds the grid's tab stop. */
  focusRef?: (el: HTMLButtonElement | null) => void;
}

export function BookingCalendar({
  offset,
  onOffset,
  selected,
  onSelect,
  errorId,
  focusRef,
}: BookingCalendarProps) {
  const today = startOfDay(getCurrentSASTTime());
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const days = Array.from(
    { length: daysIn },
    (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1),
  );
  const monthLabel = format(first, 'MMMM yyyy');
  const labelId = 'nwbk-month';

  // The day keyboard focus last moved to, so the tab stop follows it.
  const [cursor, setCursor] = useState<Date | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!pendingFocus) return;
    buttons.current.get(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, offset]);

  const inView = (d?: Date | null): d is Date =>
    !!d && d.getMonth() === first.getMonth() && d.getFullYear() === first.getFullYear();
  const bookable = (d: Date) => !isBookingDateDisabled(d);
  const stop =
    (inView(cursor) && bookable(cursor) && cursor) ||
    (inView(selected) && bookable(selected) && selected) ||
    days.find(bookable);

  /** The nearest bookable day from `from`, stepping by `dir` days, within reach. */
  const seek = (from: Date, dir: 1 | -1): Date | null => {
    let d = from;
    for (let i = 0; i < 31; i++) {
      if (monthIndex(d) < monthIndex(today)) return null;
      if (bookable(d)) return d;
      d = addDays(d, dir);
    }
    return null;
  };

  /** Where a key moves focus from `day`: undefined for other keys, null for nowhere. */
  const moveFor = (key: string, day: Date): Date | null | undefined => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (key in steps) {
      const n = steps[key];
      return seek(addDays(day, n), n > 0 ? 1 : -1);
    }
    if (key === 'Home') return seek(addDays(day, -day.getDay()), 1);
    if (key === 'End') return seek(addDays(day, 6 - day.getDay()), -1);
    if (key === 'PageUp' || key === 'PageDown') {
      const up = key === 'PageUp';
      const moved = addMonths(day, up ? -1 : 1);
      return seek(moved, up ? -1 : 1) ?? seek(moved, 1);
    }
    return undefined;
  };

  const onKeyDown = (day: Date) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const target = moveFor(e.key, day);
    if (target === undefined) return;
    e.preventDefault();
    if (!target) return;
    const nextOffset = monthIndex(target) - monthIndex(today);
    if (nextOffset !== offset) onOffset(nextOffset);
    setCursor(target);
    setPendingFocus(dayKey(target));
  };

  return (
    <div className="nwbk-cal">
      <div className="nwbk-cal-head">
        <button
          type="button"
          className={offset <= 0 ? 'nwbk-navbtn nwbk-navbtn--off' : 'nwbk-navbtn'}
          aria-label="Previous month"
          disabled={offset <= 0}
          onClick={() => {
            if (offset > 0) onOffset(offset - 1);
          }}
        >
          <BookingIcon name="chevronLeft" size={18} />
        </button>
        <span id={labelId} className="nwbk-cal-month" aria-live="polite">
          {monthLabel}
        </span>
        <button
          type="button"
          className="nwbk-navbtn"
          aria-label="Next month"
          onClick={() => onOffset(offset + 1)}
        >
          <BookingIcon name="chevronRight" size={18} />
        </button>
      </div>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={errorId}
        className="nwbk-cal-grid"
      >
        {WEEKDAYS.map((w) => (
          <span key={w} className="nw-mono nwbk-cal-wd" aria-hidden="true">
            {w}
          </span>
        ))}
        {Array.from({ length: first.getDay() }, (_, i) => (
          <div key={`pad-${i}`} className="nwbk-cal-cell" />
        ))}
        {days.map((d) => {
          const key = dayKey(d);
          const off = isBookingDateDisabled(d);
          const isSel = !!selected && isSameDay(d, selected);
          const classes = ['nwbk-day'];
          if (off) classes.push('nwbk-day--off');
          else if (isSel) classes.push('nwbk-day--sel');
          if (isPastCalendarDay(d)) classes.push('nwbk-day--past');
          if (isSameDay(d, today) && !isSel) classes.push('nwbk-day--today');
          const isStop = !!stop && isSameDay(d, stop);
          return (
            <div key={key} className="nwbk-cal-cell">
              <button
                ref={(el) => {
                  if (el) buttons.current.set(key, el);
                  else buttons.current.delete(key);
                  if (isStop) focusRef?.(el);
                }}
                type="button"
                className={classes.join(' ')}
                aria-label={`${format(d, 'EEEE, d MMMM yyyy')}${off ? ' (unavailable)' : ''}`}
                aria-pressed={isSel}
                disabled={off}
                tabIndex={isStop ? 0 : -1}
                onClick={() => {
                  setCursor(d);
                  onSelect(d);
                }}
                onKeyDown={onKeyDown(d)}
              >
                {d.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
