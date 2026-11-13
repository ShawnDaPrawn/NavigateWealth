import { useState } from 'react';
import { Button } from '../../../../../ui/button';
import { Calendar as CalendarIcon, ChevronDown, ChevronUp, Link as LinkIcon } from 'lucide-react';
import { addDays, eachDayOfInterval, format, isToday, startOfDay, startOfWeek } from 'date-fns';
import type { CalendarEvent } from '../../types';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS, LOCATION_TYPE_LABELS } from '../../constants';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';

/** The list views: one week, one day, or the next two weeks. */
export type ListRange = 'week' | 'day' | 'agenda';

// Helper to check if an event is system-generated
function isSystemEvent(event: CalendarEvent): boolean {
  return (
    event.id.startsWith('renewal-') ||
    event.id.startsWith('birthday-') ||
    event.id.startsWith('task-')
  );
}

function metaLine(event: CalendarEvent): string {
  if (event.id.startsWith('task-')) return 'Task due · To-Do';
  const parts = [EVENT_TYPE_LABELS[event.event_type] || 'Event'];
  if (!isSystemEvent(event) && event.location_type) {
    parts.push(LOCATION_TYPE_LABELS[event.location_type] ?? event.location_type);
  }
  if (event.client?.full_name) parts.push(event.client.full_name);
  return parts.join(' · ');
}

interface AgendaViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  range: ListRange;
  /** Details: the event's page. */
  onOpen: (event: CalendarEvent) => void;
  onOpenTask?: (taskId: string) => void;
  onOpenClient?: (clientId: string) => void;
  onNewEvent: () => void;
  canCreate?: boolean;
}

export function AgendaView({
  events,
  currentDate,
  range,
  onOpen,
  onOpenTask,
  onOpenClient,
  onNewEvent,
  canCreate = true,
}: AgendaViewProps) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const { getEventsOnDate } = useCalendarEvents(events);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const start =
    range === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfDay(currentDate);
  const end = range === 'week' ? addDays(start, 6) : range === 'day' ? start : addDays(start, 14);
  const dates = eachDayOfInterval({ start, end });

  const days = dates
    .map((date) => ({ date, items: getEventsOnDate(date) }))
    .filter((d) => d.items.length > 0);

  const renderItem = (event: CalendarEvent) => {
    const key = `event-${event.id}`;
    const isExpanded = expandedItems[key];
    const system = isSystemEvent(event);
    const isTask = event.id.startsWith('task-');
    const allDay = system;
    const clientId = system && !isTask ? event.client_id : null;
    const action = isTask ? (
      onOpenTask ? (
        <Button size="sm" variant="ghost" onClick={() => onOpenTask(event.id.slice(5))}>
          Open task
        </Button>
      ) : null
    ) : clientId && onOpenClient ? (
      <Button size="sm" variant="ghost" onClick={() => onOpenClient(clientId)}>
        Open client
      </Button>
    ) : (
      <Button size="sm" variant="ghost" onClick={() => onOpen(event)}>
        Details
      </Button>
    );

    return (
      <li key={key} className="rounded-lg border border-nw-line bg-white">
        <div className="flex items-start gap-3 px-4 py-3">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${EVENT_TYPE_COLORS[event.event_type]?.split(' ')[0] ?? 'bg-blue-100'}`}
            aria-hidden="true"
          />
          <span className="w-24 shrink-0 text-xs font-medium tabular-nums text-nw-text-2 pt-0.5">
            {allDay
              ? 'All day'
              : `${format(new Date(event.start_at), 'HH:mm')}–${format(new Date(event.end_at), 'HH:mm')}`}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-medium text-nw-ink ${event.status === 'completed' ? 'text-nw-text-3 line-through' : ''}`}
            >
              {isTask ? event.title.replace(/^Task: /, '') : event.title}
            </p>
            <p className="mt-0.5 text-xs text-nw-text-3">{metaLine(event)}</p>
          </div>
          <div className="flex items-center gap-1">
            {action}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-nw-text-3"
              aria-label={isExpanded ? 'Hide details' : 'Show details'}
              aria-expanded={!!isExpanded}
              onClick={() => toggleExpand(key)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        {isExpanded && (
          <div className="grid grid-cols-1 gap-3 border-t border-nw-line-2 px-4 py-3 text-sm md:grid-cols-2">
            <div className="col-span-full">
              <span className="mb-1 block text-xs font-medium text-nw-text-3">Description</span>
              <p className="whitespace-pre-wrap text-nw-text-2">
                {event.description || <span className="text-nw-text-3">No description</span>}
              </p>
            </div>
            {!system && event.location && (
              <div>
                <span className="mb-1 block text-xs font-medium text-nw-text-3">Location</span>
                <p className="text-nw-text-2">{event.location}</p>
              </div>
            )}
            {event.video_link && (
              <div>
                <span className="mb-1 block text-xs font-medium text-nw-text-3">Meeting link</span>
                <a
                  href={event.video_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-xs items-center gap-1 truncate text-nw-violet-600 underline"
                >
                  <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {event.video_link}
                </a>
              </div>
            )}
            {system && (
              <div className="col-span-full">
                <span className="mb-1 block text-xs font-medium text-nw-text-3">Source</span>
                <p className="text-xs text-nw-text-3">
                  {event.event_type === 'renewal'
                    ? 'Auto-generated from policy inception dates'
                    : event.event_type === 'birthday'
                      ? 'Auto-generated from client date of birth'
                      : 'Linked from To-Do'}
                </p>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  if (days.length === 0) {
    const title =
      range === 'agenda'
        ? 'No upcoming events'
        : range === 'week'
          ? 'Nothing scheduled this week'
          : 'Nothing scheduled on this day';
    const text =
      range === 'agenda'
        ? `There are no events scheduled for the next 14 days from ${format(currentDate, 'd MMM')}.`
        : range === 'week'
          ? `No events, tasks, birthdays or renewals from ${format(start, 'd MMM')} to ${format(end, 'd MMM')}.`
          : `No events, tasks, birthdays or renewals on ${format(start, 'EEEE, d MMMM')}.`;
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-nw-line bg-white px-6 py-16 text-center">
        <CalendarIcon className="mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
        <h3 className="text-base font-semibold text-nw-ink">{title}</h3>
        <p className="mt-1 mb-4 max-w-sm text-sm text-nw-text-3">{text}</p>
        {canCreate && (
          <Button size="sm" onClick={onNewEvent}>
            Schedule event
          </Button>
        )}
      </div>
    );
  }

  if (range === 'day') {
    const items = days[0].items;
    return (
      <div className="h-full space-y-3 overflow-y-auto">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-semibold text-nw-ink">
            {format(start, 'EEEE, d MMMM yyyy')}
          </h3>
          <span className="text-sm text-nw-text-3">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <ul className="space-y-2">{items.map(renderItem)}</ul>
      </div>
    );
  }

  return (
    <div className="h-full space-y-5 overflow-y-auto">
      {days.map(({ date, items }) => {
        const today = isToday(date);
        return (
          <section key={format(date, 'yyyy-MM-dd')} className="flex gap-4">
            <div className="w-14 shrink-0 pt-2 text-center">
              <p
                className={`text-xs font-semibold ${today ? 'text-nw-violet-600' : 'text-nw-text-3'}`}
              >
                {format(date, 'EEE')}
              </p>
              <p className="text-sm font-semibold text-nw-ink">{format(date, 'd MMM')}</p>
              {today && <p className="text-[11px] font-medium text-nw-violet-600">Today</p>}
            </div>
            <ul className="min-w-0 flex-1 space-y-2">{items.map(renderItem)}</ul>
          </section>
        );
      })}
    </div>
  );
}
