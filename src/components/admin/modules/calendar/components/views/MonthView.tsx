import { useRef, useEffect } from 'react';
import {
  format,
  isToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from 'date-fns';
import type { CalendarEvent, CalendarView } from '../../types';
import { cn } from '../../../../../ui/utils';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';

interface MonthViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onViewEvent: (event: CalendarEvent) => void;
}

export function MonthView({
  events,
  currentDate,
  onDateChange,
  onViewChange,
  onViewEvent,
}: MonthViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Use cached lookup for better performance
  const { getEventsOnDate } = useCalendarEvents(events);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Auto-scroll based on day of month
  useEffect(() => {
    if (scrollContainerRef.current) {
      const day = currentDate.getDate();
      if (day > 21) {
        // Scroll to bottom for end of month
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      } else {
        // Scroll to top for beginning/middle of month
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [currentDate]);

  return (
    <section className="ds-card overflow-hidden">
      <div ref={scrollContainerRef} className="ds-cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="dh">
            <span className="sm:hidden">{day.charAt(0)}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
        {days.map((day) => {
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const dayItems = getEventsOnDate(day);
          const maxVisible = 3;
          const visibleItems = dayItems.slice(0, maxVisible);
          const hiddenCount = dayItems.length - maxVisible;

          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              aria-label={`${format(day, 'EEEE d MMMM')}: ${dayItems.length} ${dayItems.length === 1 ? 'item' : 'items'}`}
              className={cn('d', !isCurrentMonth && 'out', isToday(day) && 'today')}
              onClick={() => {
                onDateChange(day);
                onViewChange('day');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onDateChange(day);
                  onViewChange('day');
                }
              }}
            >
              <span className="n">{format(day, 'd')}</span>

              {/* On a phone a day cell is ~50px wide: a dot per item. */}
              {dayItems.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 sm:hidden" aria-hidden="true">
                  {dayItems.slice(0, 3).map((event) => (
                    <span
                      key={`dot-${event.id}`}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: DOT_COLOUR[eventKind(event)] }}
                    />
                  ))}
                </div>
              )}

              {visibleItems.map((event) => (
                <button
                  type="button"
                  key={`evt-${event.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewEvent(event);
                  }}
                  className={cn('ds-ev max-sm:hidden', eventKind(event))}
                >
                  {eventLabel(event)}
                </button>
              ))}
              {hiddenCount > 0 && (
                <span className="ds-meta max-sm:hidden" style={{ fontSize: 11.5 }}>
                  +{hiddenCount} more
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** The board's four colours: e event, t task due, b birthday, r policy renewal. */
function eventKind(event: CalendarEvent): 'e' | 't' | 'b' | 'r' {
  if (event.id.startsWith('task-')) return 't';
  if (event.event_type === 'birthday') return 'b';
  if (event.event_type === 'renewal') return 'r';
  return 'e';
}

const DOT_COLOUR: Record<'e' | 't' | 'b' | 'r', string> = {
  e: '#6d28d9',
  t: '#1d4ed8',
  b: '#d97706',
  r: '#047857',
};

function eventLabel(event: CalendarEvent): string {
  const title = event.title.replace(/^Task: /, '');
  if (event.id.startsWith('task-') || event.event_type === 'birthday') return title;
  return `${format(new Date(event.start_at), 'HH:mm')} ${title}`;
}
