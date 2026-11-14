import type { ReactNode } from 'react';
import type { CalendarEvent, CalendarView } from '../types';
import { CalendarHeader } from './views/CalendarHeader';
import { MonthView } from './views/MonthView';
import { AgendaView } from './views/AgendaView';
import { Button } from '../../../../ui/button';
import { Skeleton } from '../../../../ui/skeleton';

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
  /** Search or chips set: an empty result is "no match", not "nothing scheduled". */
  filtersActive?: boolean;
  onClearFilters?: () => void;
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
  filtersActive = false,
  onClearFilters,
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
        {isLoading ? (
          <div role="status" aria-label="Loading events" className="h-full">
            <span className="sr-only">Loading events…</span>
            {view === 'month' ? (
              <div className="grid h-full grid-cols-7 gap-px overflow-hidden rounded-lg border border-nw-line bg-nw-line">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="space-y-2 bg-white p-2">
                    <Skeleton className="h-3 w-5" />
                    {i % 3 === 0 && <Skeleton className="h-4 w-full rounded" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            )}
          </div>
        ) : view === 'month' ? (
          <>
            {filtersActive && events.length === 0 && (
              <div
                role="status"
                className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-nw-line bg-white px-4 py-3 text-sm text-nw-text-2"
              >
                <span className="flex-1">No events match your filters.</span>
                {onClearFilters && (
                  <Button variant="outline" size="sm" onClick={onClearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}
            <MonthView
              events={events}
              currentDate={currentDate}
              onDateChange={onDateChange}
              onViewChange={onViewChange}
              onViewEvent={onView}
            />
          </>
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
            filtersActive={filtersActive}
            onClearFilters={onClearFilters}
          />
        )}
      </div>
    </div>
  );
}
