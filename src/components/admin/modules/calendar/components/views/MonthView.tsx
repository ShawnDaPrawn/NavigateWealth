import React, { useMemo, useRef, useEffect } from 'react';
import { 
  format, 
  isToday, 
  startOfDay, 
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from 'date-fns';
import type { CalendarEvent, CalendarView } from '../../types';
import { EVENT_TYPE_COLORS } from '../../constants';
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
  onViewEvent
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
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid - Using gap-px for perfect borders */}
      <div 
        ref={scrollContainerRef}
        className="grid grid-cols-7 gap-px bg-gray-200 flex-1 overflow-y-auto"
      >
        {days.map((day, idx) => {
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
              className={`min-h-[120px] p-2 bg-white transition-colors relative group hover:bg-gray-50 cursor-pointer ${
                !isCurrentMonth ? 'bg-gray-50/50' : ''
              }`}
              onClick={() => {
                 onDateChange(day);
                 onViewChange('agenda');
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`h-7 w-7 flex items-center justify-center rounded-full text-sm font-medium ${
                  isTodayDate 
                    ? 'bg-purple-600 text-white shadow-sm' 
                    : !isCurrentMonth ? 'text-gray-400' : 'text-gray-700'
                }`}>
                  {format(day, 'd')}
                </span>
                {dayItems.length > 0 && (
                  <span className="text-[10px] font-medium text-gray-400 hidden group-hover:inline-block">
                    {dayItems.length} events
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {visibleItems.map((event, i) => {
                  return (
                    <div 
                      key={`evt-${event.id}`}
                      onClick={(e) => { e.stopPropagation(); onViewEvent(event); }}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer transition-colors border-l-2 hover:brightness-95 ${
                        EVENT_TYPE_COLORS[event.event_type]?.replace('bg-', 'bg-opacity-20 bg-').replace('text-', 'border-') || 'bg-blue-50 border-blue-500 text-blue-700'
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
