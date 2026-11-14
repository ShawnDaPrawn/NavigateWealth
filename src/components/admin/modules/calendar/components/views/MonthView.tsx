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
import { EVENT_TYPE_COLORS } from '../../constants';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';

/** Solid dot colours for the phone month grid (literal classes so Tailwind keeps them). */
const EVENT_DOT_COLORS: Record<string, string> = {
  meeting: 'bg-blue-600',
  review: 'bg-purple-600',
  call: 'bg-green-600',
  webinar: 'bg-indigo-600',
  internal: 'bg-gray-500',
  consultation: 'bg-teal-600',
  deadline: 'bg-rose-600',
  birthday: 'bg-pink-500',
  renewal: 'bg-amber-500',
  other: 'bg-slate-500',
};

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
    <div className="h-full flex flex-col bg-white rounded-lg border shadow-sm overflow-hidden">
      {/* Days Header */}
      <div className="grid grid-cols-7 border-b bg-gray-50 flex-none">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div
            key={day}
            className="py-2 text-center text-[11px] font-semibold tracking-wider text-gray-500 uppercase sm:py-3 sm:text-xs"
          >
            <span className="sm:hidden">{day.charAt(0)}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid - Using gap-px for perfect borders */}
      <div
        ref={scrollContainerRef}
        className="grid grid-cols-7 gap-px bg-gray-200 flex-1 overflow-y-auto"
      >
        {days.map((day, _idx) => {
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isTodayDate = isToday(day);

          // O(1) lookup instead of O(N) filter
          const dayItems = getEventsOnDate(day);

          // Limit visible items
          const maxVisible = 4;
          const visibleItems = dayItems.slice(0, maxVisible);
          const hiddenCount = dayItems.length - maxVisible;

          return (
            <div
              key={day.toISOString()}
              className={`relative group min-h-[64px] cursor-pointer bg-white p-1 transition-colors hover:bg-gray-50 sm:min-h-[120px] sm:p-2 ${
                !isCurrentMonth ? 'bg-gray-50/50' : ''
              }`}
              onClick={() => {
                onDateChange(day);
                onViewChange('day');
              }}
            >
              <div className="mb-1 flex items-center justify-center sm:mb-2 sm:justify-between">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                    isTodayDate
                      ? 'bg-purple-600 text-white shadow-sm'
                      : !isCurrentMonth
                        ? 'text-gray-400'
                        : 'text-gray-700'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {dayItems.length > 0 && (
                  <span className="text-[10px] font-medium text-gray-400 hidden group-hover:inline-block">
                    {dayItems.length} events
                  </span>
                )}
              </div>

              {/* On a phone a day cell is ~50px wide: show a dot per event and
                  open the day's agenda on tap, instead of unreadable chips. */}
              {dayItems.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 sm:hidden" aria-hidden="true">
                  {dayItems.slice(0, 3).map((event) => (
                    <span
                      key={`dot-${event.id}`}
                      className={`h-1.5 w-1.5 rounded-full ${EVENT_DOT_COLORS[event.event_type] ?? 'bg-blue-600'}`}
                    />
                  ))}
                  {dayItems.length > 3 && (
                    <span className="text-[9px] leading-none font-medium text-gray-500">
                      +{dayItems.length - 3}
                    </span>
                  )}
                </div>
              )}
              {dayItems.length > 0 && (
                <span className="sr-only sm:hidden">
                  {dayItems.length} {dayItems.length === 1 ? 'event' : 'events'}
                </span>
              )}

              <div className="hidden space-y-1 sm:block">
                {visibleItems.map((event, _i) => {
                  return (
                    <div
                      key={`evt-${event.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewEvent(event);
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer transition-colors border-l-2 hover:brightness-95 ${
                        EVENT_TYPE_COLORS[event.event_type]
                          ?.replace('bg-', 'bg-opacity-20 bg-')
                          .replace('text-', 'border-') || 'bg-blue-50 border-blue-500 text-blue-700'
                      }`}
                    >
                      {format(new Date(event.start_at), 'HH:mm')} {event.title}
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <div className="text-[10px] text-gray-500 font-medium pl-1 hover:text-purple-600">
                    + {hiddenCount} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
