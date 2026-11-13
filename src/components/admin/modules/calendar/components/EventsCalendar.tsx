import type { ReactNode } from 'react';
import type { CalendarEvent, CalendarView } from '../types';
import { CalendarHeader } from './views/CalendarHeader';
import { MonthView } from './views/MonthView';
import { AgendaView } from './views/AgendaView';

interface EventsCalendarProps {
  events: CalendarEvent[];
  isLoading: boolean;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  /** Month · Week · Day · Agenda, kept in the address by the module. */
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  /** Search and filter chips, shown under the date controls. */
  toolbar?: ReactNode;

  /** Opens an event's page. */
  onView: (event: CalendarEvent) => void;
  onOpenTask?: (taskId: string) => void;
  onOpenClient?: (clientId: string) => void;
  onNewEvent: () => void;
  canCreate?: boolean;
}

const KEY = [
  { label: 'Event', dot: 'bg-blue-500' },
  { label: 'Task due', dot: 'bg-rose-500' },
  { label: 'Birthday', dot: 'bg-pink-500' },
  { label: 'Policy renewal', dot: 'bg-amber-500' },
];

export function EventsCalendar({
  events,
  isLoading,
  currentDate,
  onDateChange,
  view,
  onViewChange,
  toolbar,
  onView,
  onOpenTask,
  onOpenClient,
  onNewEvent,
  canCreate = true,
}: EventsCalendarProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      <CalendarHeader
        view={view}
        currentDate={currentDate}
        onDateChange={onDateChange}
        onViewChange={onViewChange}
        onToday={() => onDateChange(new Date())}
      />

      {toolbar}

      {view === 'month' && (
        <ul
          className="flex flex-wrap items-center gap-4 text-xs text-nw-text-2"
          aria-label="Colour key"
        >
          {KEY.map((k) => (
            <li key={k.label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${k.dot}`} aria-hidden="true" />
              {k.label}
            </li>
          ))}
        </ul>
      )}

      <div className="relative min-h-0 flex-1">
        {isLoading && (
          <div
            role="status"
            aria-label="Loading events"
            className="absolute inset-0 z-50 flex items-center justify-center bg-white/50"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
          </div>
        )}

        {view === 'month' ? (
          <MonthView
            events={events}
            currentDate={currentDate}
            onDateChange={onDateChange}
            onViewChange={onViewChange}
            onViewEvent={onView}
          />
        ) : (
          <AgendaView
            events={events}
            currentDate={currentDate}
            range={view}
            onOpen={onView}
            onOpenTask={onOpenTask}
            onOpenClient={onOpenClient}
            onNewEvent={onNewEvent}
            canCreate={canCreate}
          />
        )}
      </div>
    </div>
  );
}
