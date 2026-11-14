import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Plus, Download, X, Search, FileText } from 'lucide-react';
import { EventsCalendar } from './components/EventsCalendar';
import { EventPage } from './components/EventPage';
import { CalendarPDFExportModal } from './components/CalendarPDFExportModal';
import { useClients } from '../../../../hooks/useClients';
import { EVENT_TYPE_LABELS } from './constants';
import type { CalendarView, EventStatus, EventType } from './types';
import { moduleSearchParams } from '../../layout/moduleSearchParams';
import { taskAddress } from '../tasks/taskLink';
import { ClearFiltersButton, FilterChip } from '../../layout/page/FilterControls';
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useClientBirthdays,
} from './hooks';
import { usePolicyRenewals } from './hooks/usePolicyRenewals';
import { useTasks } from '../tasks';
import type { CalendarEvent, CalendarFilters, CreateEventInput } from './types';
import type { Task } from '../tasks';
import { toast } from 'sonner';
import { format, isToday, isValid, parse } from 'date-fns';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { useCurrentUserPermissions } from '../personnel';
import {
  ErrorState,
  PageHeader,
  useBreadcrumbTrail,
  useConfirm,
  useRecordInUrl,
} from '../../layout/page';

const CALENDAR_VIEWS = ['month', 'week', 'day', 'agenda'] as const;

/** ?date=2026-11-09 → that day; missing or invalid → today. */
function parseDateParam(raw: string | null): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = parse(raw, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}
/** The address names a new event with this id. */
const NEW_EVENT = 'new';
const FILTER_TYPES: EventType[] = [
  'meeting',
  'call',
  'review',
  'consultation',
  'webinar',
  'internal',
  'deadline',
  'other',
  'birthday',
  'renewal',
];
const FILTER_STATUSES: { value: EventStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rescheduled', label: 'Rescheduled' },
];

export function CalendarModule() {
  const { confirm: askConfirm, confirmDialog } = useConfirm();
  const [filters, setFilters] = useState<Partial<CalendarFilters>>({
    search: '',
    dateRange: { start: null, end: null },
    eventTypes: [],
    eventStatuses: [],
    clientId: null,
  });

  const [showEventModal, setShowEventModal] = useState(false);
  // Month · Week · Day · Agenda and the date shown live in the address
  // (?view=week&date=2026-11-09; month and today are left out), so reload and
  // Back return to the same place.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const view: CalendarView = (CALENDAR_VIEWS as readonly string[]).includes(rawView ?? '')
    ? (rawView as CalendarView)
    : 'month';
  const currentDate = useMemo(() => parseDateParam(searchParams.get('date')), [searchParams]);
  // A day click sets the date and the view in one go: collect changes made
  // in the same tick and write the address once (router updates don't chain).
  const pendingParams = useRef<Record<string, string | null> | null>(null);
  const writeParams = useCallback(
    (changes: Record<string, string | null>) => {
      if (!pendingParams.current) {
        pendingParams.current = {};
        queueMicrotask(() => {
          const all = pendingParams.current ?? {};
          pendingParams.current = null;
          setSearchParams(
            (current) => {
              const next = new URLSearchParams(current);
              for (const [key, value] of Object.entries(all)) {
                if (value === null) next.delete(key);
                else next.set(key, value);
              }
              return next;
            },
            { replace: true },
          );
        });
      }
      Object.assign(pendingParams.current, changes);
    },
    [setSearchParams],
  );
  const setView = useCallback(
    (next: CalendarView) => writeParams({ view: next === 'month' ? null : next }),
    [writeParams],
  );
  const setCurrentDate = useCallback(
    (next: Date) => writeParams({ date: isToday(next) ? null : format(next, 'yyyy-MM-dd') }),
    [writeParams],
  );
  const { data: clientList = [] } = useClients();
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [searchDebounce, setSearchDebounce] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');

  // Lifted state for date navigation
  const { canDo } = useCurrentUserPermissions();

  const canCreateEvent = canDo('calendar', 'create');
  const canExport = canDo('calendar', 'export');
  const canEditEvent = canDo('calendar', 'edit');
  const canDeleteEvent = canDo('calendar', 'delete');

  // Fetch data
  const {
    data: events = [],
    isLoading: isLoadingEvents,
    error: eventsError,
    refetch: refetchEvents,
  } = useEvents(filters);
  const { data: birthdayEvents = [], isError: birthdaysFailed } = useClientBirthdays(currentDate);
  const { data: policyRenewals = [], isError: renewalsFailed } = usePolicyRenewals(currentDate);
  const { data: tasks = [], isError: tasksFailed } = useTasks();
  // Birthdays, renewals and task due dates are secondary: the calendar still
  // works without them, so a failure is a toast, not the error state.
  useEffect(() => {
    if (birthdaysFailed) toast.error("Couldn't load client birthdays");
  }, [birthdaysFailed]);
  useEffect(() => {
    if (renewalsFailed) toast.error("Couldn't load policy renewals");
  }, [renewalsFailed]);
  useEffect(() => {
    if (tasksFailed) toast.error("Couldn't load task due dates");
  }, [tasksFailed]);

  // Combine and filter events
  const allEvents = useMemo(() => {
    let filteredBirthdays = birthdayEvents;
    let filteredRenewals = policyRenewals;
    const taskEvents: CalendarEvent[] = [];

    // Map tasks to calendar events
    if (tasks && tasks.length > 0) {
      tasks.forEach((task: Task) => {
        if (!task.due_date) return;

        // Skip if task doesn't match filters
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          if (
            !task.title.toLowerCase().includes(searchLower) &&
            !(task.description || '').toLowerCase().includes(searchLower)
          ) {
            return;
          }
        }

        // Skip if filtering by client (tasks don't explicitly link to clients in the same way events do,
        // but we could check category if it's 'client' or if description mentions client)
        if (filters.clientId) {
          // For now, exclude tasks when filtering by client unless we can link them
          return;
        }

        // Map task status to event status
        let eventStatus: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' = 'scheduled';
        if (task.status === 'completed') eventStatus = 'completed';
        if (task.status === 'archived') eventStatus = 'cancelled';

        // Filter by status if needed
        if (filters.eventStatuses && filters.eventStatuses.length > 0) {
          if (!filters.eventStatuses.includes(eventStatus)) return;
        }

        taskEvents.push({
          id: `task-${task.id}`,
          user_id: task.assignee_id || 'system',
          title: `Task: ${task.title}`,
          description: task.description || '',
          event_type: 'deadline',
          start_at: task.due_date,
          end_at: task.due_date,
          location_type: 'other',
          location: 'Task Manager',
          video_link: null,
          status: eventStatus,
          client_id: null,
          created_by: task.created_by,
          created_at: task.created_at,
          updated_at: task.updated_at,
          recurrence_rule: null,
        } as CalendarEvent);
      });
    }

    // Apply filters to birthdays
    if (filters.clientId) {
      filteredBirthdays = filteredBirthdays.filter((e) => e.client_id === filters.clientId);
      filteredRenewals = filteredRenewals.filter((e) => e.client_id === filters.clientId);
    }

    if (filters.eventTypes && filters.eventTypes.length > 0) {
      // Keep birthdays if 'birthday' type is selected
      if (!filters.eventTypes.includes('birthday')) {
        filteredBirthdays = [];
      }

      // Keep renewals if 'renewal' type is selected
      if (!filters.eventTypes.includes('renewal')) {
        filteredRenewals = [];
      }

      // Filter tasks if 'deadline' is not selected
      if (!filters.eventTypes.includes('deadline')) {
        if (taskEvents.length > 0) {
          taskEvents.length = 0;
        }
      }
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredBirthdays = filteredBirthdays.filter(
        (e) =>
          e.title.toLowerCase().includes(searchLower) ||
          (e.description && e.description.toLowerCase().includes(searchLower)),
      );
      filteredRenewals = filteredRenewals.filter(
        (e) =>
          e.title.toLowerCase().includes(searchLower) ||
          (e.description && e.description.toLowerCase().includes(searchLower)),
      );
    }

    return [...events, ...filteredBirthdays, ...filteredRenewals, ...taskEvents];
  }, [events, birthdayEvents, policyRenewals, tasks, filters]);

  // Mutations
  const openEventPage = useCallback((event: CalendarEvent | null) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  }, []);
  const createEventMutation = useCreateEvent({ onView: (created) => openEventPage(created) });
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);

    // Debounce search
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }

    const timeout = setTimeout(() => {
      handleSearch(value);
    }, 300);

    setSearchDebounce(timeout as unknown as number);
  };

  // Event handlers
  const handleCreateEvent = async (data: CreateEventInput) => {
    try {
      await createEventMutation.mutateAsync(data);
      closeEventPage();
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  };

  const handleUpdateEvent = async (data: CreateEventInput) => {
    if (!selectedEvent) return;

    try {
      await updateEventMutation.mutateAsync({
        id: selectedEvent.id,
        ...data,
      });
      closeEventPage();
    } catch (error) {
      console.error('Failed to update event:', error);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (id.startsWith('task-')) {
      toast.info('Please delete tasks in To-Do');
      return false;
    }
    if (id.startsWith('renewal-')) {
      toast.info('Policy renewal reminders are auto-generated from policy inception dates');
      return false;
    }
    if (id.startsWith('birthday-')) {
      toast.info('Birthday reminders are auto-generated from client profiles');
      return false;
    }
    const ok = await askConfirm({
      title: 'Delete event',
      description: 'Delete this event from the calendar? This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return false;

    try {
      await deleteEventMutation.mutateAsync(id);
      return true;
    } catch (error) {
      console.error('Failed to delete event:', error);
      return false;
    }
  };

  const handleUpdateEventStatus = async (id: string, status: 'completed' | 'cancelled') => {
    if (id.startsWith('task-') || id.startsWith('renewal-') || id.startsWith('birthday-')) return;
    try {
      await updateEventMutation.mutateAsync({ id, status });
    } catch (error) {
      console.error('Failed to update event status:', error);
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    try {
      const csvRows = [];
      csvRows.push(['Type', 'Title', 'Date/Time', 'Status', 'Client', 'Description'].join(','));

      allEvents.forEach((event) => {
        const row = [
          'Event',
          `"${event.title}"`,
          event.start_at,
          event.status,
          event.client?.full_name || '',
          `"${event.description || ''}"`,
        ].join(',');
        csvRows.push(row);
      });

      const csv = csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `calendar-events_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Calendar events exported successfully');
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Failed to export calendar');
    }
  };

  // ── Open in another module ──
  const openTask = useCallback(
    (taskId: string) => {
      setSearchParams(taskAddress(taskId));
    },
    [setSearchParams],
  );
  const openClient = useCallback(
    (clientId: string) => {
      const next = moduleSearchParams('clients');
      next.set('clientId', clientId);
      setSearchParams(next);
    },
    [setSearchParams],
  );

  const closeEventPage = useCallback(() => {
    setShowEventModal(false);
    setSelectedEvent(null);
  }, []);

  // ── The open event lives in the address (?event=<id>, ?event=new) ──
  const openEventId = showEventModal ? (selectedEvent ? selectedEvent.id : NEW_EVENT) : null;
  useRecordInUrl('event', openEventId, {
    ready: !isLoadingEvents && !eventsError,
    openFromUrl: (id) => {
      if (id === NEW_EVENT) {
        if (!canCreateEvent) return 'missing';
        openEventPage(null);
        return 'opened';
      }
      const found = allEvents.find((e) => e.id === id);
      if (found) {
        openEventPage(found);
        return 'opened';
      }
      if (isLoadingEvents || eventsError) return 'waiting';
      toast.error('Event not found', {
        description: 'It may have been deleted, or it falls outside the dates loaded.',
      });
      return 'missing';
    },
    closeFromUrl: () => closeEventPage(),
  });

  // Top-bar breadcrumb: Work / Calendar / November 2026 (/ the open event).
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - ((currentDate.getDay() + 6) % 7));
  const periodLabel =
    view === 'month'
      ? format(currentDate, 'MMMM yyyy')
      : view === 'week'
        ? `Week of ${format(weekStart, 'd MMM')}`
        : view === 'day'
          ? format(currentDate, 'EEE d MMM')
          : 'Agenda';
  useBreadcrumbTrail(
    showEventModal
      ? [{ label: selectedEvent ? selectedEvent.title.replace(/^Task: /, '') : 'New event' }]
      : [{ label: periodLabel }],
  );

  // Filter chips (single choice each; the old Filters dialog allowed lists,
  // which the chips still honour when a saved state carries several).
  const typeValue = (filters.eventTypes?.length === 1 ? filters.eventTypes[0] : 'all') as
    EventType | 'all';
  const statusValue = (filters.eventStatuses?.length === 1 ? filters.eventStatuses[0] : 'all') as
    EventStatus | 'all';
  const clientValue = filters.clientId ?? 'all';
  const filtersActive =
    typeValue !== 'all' || statusValue !== 'all' || clientValue !== 'all' || !!filters.search;
  const clientOptions = useMemo(
    () =>
      (Array.isArray(clientList) ? clientList : [])
        .filter((c) => c.id && c.full_name)
        .map((c) => ({ value: c.id, label: c.full_name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [clientList],
  );
  const clearFilters = () => {
    setFilters((prev) => ({
      ...prev,
      search: '',
      eventTypes: [],
      eventStatuses: [],
      clientId: null,
    }));
    setSearchText('');
  };

  if (showEventModal) {
    const current = selectedEvent
      ? (allEvents.find((e) => e.id === selectedEvent.id) ?? selectedEvent)
      : null;
    return (
      <>
        <EventPage
          key={current?.id ?? NEW_EVENT}
          onClose={closeEventPage}
          onSubmit={current ? handleUpdateEvent : handleCreateEvent}
          onDelete={
            canDeleteEvent
              ? async (id) => {
                  const success = await handleDeleteEvent(id);
                  if (success) closeEventPage();
                }
              : undefined
          }
          event={current}
          events={events}
          isSubmitting={createEventMutation.isPending || updateEventMutation.isPending}
          canEdit={canEditEvent}
          onOpenTask={openTask}
          onOpenClient={openClient}
          onUpdateStatus={handleUpdateEventStatus}
        />
        {confirmDialog}
      </>
    );
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <Input
          aria-label="Search events"
          placeholder="Search events…"
          value={searchText}
          onChange={handleSearchChange}
          className="h-9 bg-white pl-9"
        />
        {searchText && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setSearchText('');
              setFilters((prev) => ({ ...prev, search: '' }));
            }}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <FilterChip
        label="Event type"
        value={typeValue}
        allValue="all"
        allLabel="All types"
        onChange={(v) =>
          setFilters((prev) => ({ ...prev, eventTypes: v === 'all' ? [] : [v as EventType] }))
        }
        options={FILTER_TYPES.map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t] }))}
      />
      <FilterChip
        label="Status"
        value={statusValue}
        allValue="all"
        allLabel="Any status"
        onChange={(v) =>
          setFilters((prev) => ({
            ...prev,
            eventStatuses: v === 'all' ? [] : [v as EventStatus],
          }))
        }
        options={FILTER_STATUSES}
      />
      <FilterChip
        label="Client"
        value={clientValue}
        allValue="all"
        allLabel="All clients"
        onChange={(v) => setFilters((prev) => ({ ...prev, clientId: v === 'all' ? null : v }))}
        options={clientOptions}
      />
      {filtersActive && <ClearFiltersButton onClick={clearFilters} />}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6 lg:p-8">
        <PageHeader
          title="Calendar"
          description="Your schedule: events, reminders, task due dates, client birthdays and policy renewals."
          actions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={!canExport}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Export</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleExportCSV} disabled={allEvents.length === 0}>
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setShowPDFModal(true)}>
                    <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canCreateEvent && (
                <Button onClick={() => openEventPage(null)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add event
                </Button>
              )}
            </>
          }
        />

        {eventsError ? (
          <ErrorState
            title="Unable to load your calendar"
            description="Something went wrong while loading events. Nothing you entered was lost."
            onRetry={() => void refetchEvents()}
            details={eventsError instanceof Error ? eventsError.message : undefined}
          />
        ) : (
          <div className="h-[calc(100vh-220px)] min-h-[640px]">
            <EventsCalendar
              events={allEvents}
              isLoading={isLoadingEvents}
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              view={view}
              onViewChange={setView}
              toolbar={toolbar}
              onView={(event) => {
                if (event.id.startsWith('task-')) {
                  openTask(event.id.slice('task-'.length));
                  return;
                }
                openEventPage(event);
              }}
              onOpenTask={openTask}
              onOpenClient={openClient}
              onNewEvent={() => openEventPage(null)}
              canCreate={canCreateEvent}
              filtersActive={filtersActive}
              onClearFilters={clearFilters}
            />
          </div>
        )}
      </div>

      <CalendarPDFExportModal
        open={showPDFModal}
        onClose={() => setShowPDFModal(false)}
        events={allEvents}
      />
      {confirmDialog}
    </div>
  );
}
