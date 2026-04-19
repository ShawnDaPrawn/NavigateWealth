import React, { useState, useMemo } from 'react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Plus, Download, Filter, X, Search, FileText } from 'lucide-react';
import { EventsCalendar } from './components/EventsCalendar';
import { EventFormModal } from './components/EventFormModal';
import { FiltersDrawer } from './components/FiltersDrawer';
import { CalendarPDFExportModal } from './components/CalendarPDFExportModal';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, useClientBirthdays } from './hooks';
import { usePolicyRenewals } from './hooks/usePolicyRenewals';
import { useTasks } from '../tasks/hooks/useTaskQueries';
import type { CalendarEvent, CalendarFilters, CreateEventInput } from './types';
import type { Task } from '../tasks/types';
import { toast } from 'sonner@2.0.3';
import { format } from 'date-fns';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu";
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';

export function CalendarModule() {
  const [filters, setFilters] = useState<Partial<CalendarFilters>>({
    search: '',
    dateRange: { start: null, end: null },
    eventTypes: [],
    eventStatuses: [],
    clientId: null,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [searchDebounce, setSearchDebounce] = useState<number | null>(null);
  
  // Lifted state for date navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  const { canDo } = useCurrentUserPermissions();

  const canCreateEvent = canDo('calendar', 'create');
  const canExport = canDo('calendar', 'export');
  const canEditEvent = canDo('calendar', 'edit');
  const canDeleteEvent = canDo('calendar', 'delete');

  // Fetch data
  const { data: events = [], isLoading: isLoadingEvents } = useEvents(filters);
  const { data: birthdayEvents = [] } = useClientBirthdays(currentDate);
  const { data: policyRenewals = [] } = usePolicyRenewals(currentDate);
  const { data: tasks = [] } = useTasks();

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
          if (!task.title.toLowerCase().includes(searchLower) && 
              !(task.description || '').toLowerCase().includes(searchLower)) {
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
      filteredBirthdays = filteredBirthdays.filter(e => e.client_id === filters.clientId);
      filteredRenewals = filteredRenewals.filter(e => e.client_id === filters.clientId);
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
      filteredBirthdays = filteredBirthdays.filter(e => 
        e.title.toLowerCase().includes(searchLower) || 
        (e.description && e.description.toLowerCase().includes(searchLower))
      );
      filteredRenewals = filteredRenewals.filter(e =>
        e.title.toLowerCase().includes(searchLower) ||
        (e.description && e.description.toLowerCase().includes(searchLower))
      );
    }

    return [...events, ...filteredBirthdays, ...filteredRenewals, ...taskEvents];
  }, [events, birthdayEvents, policyRenewals, tasks, filters]);

  // Mutations
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Debounce search
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    
    const timeout = setTimeout(() => {
      handleSearch(value);
    }, 300);
    
    setSearchDebounce(timeout);
  };

  // Event handlers
  const handleCreateEvent = async (data: CreateEventInput) => {
    try {
      await createEventMutation.mutateAsync(data);
      setShowEventModal(false);
      setSelectedEvent(null);
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
      setShowEventModal(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Failed to update event:', error);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (id.startsWith('task-')) {
      toast.info('Please delete tasks in the Tasks module');
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
    if (!confirm('Are you sure you want to delete this event?')) return false;
    
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
      
      allEvents.forEach(event => {
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

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.eventTypes && filters.eventTypes.length > 0) count++;
    if (filters.eventStatuses && filters.eventStatuses.length > 0) count++;
    if (filters.clientId) count++;
    if (filters.dateRange?.start || filters.dateRange?.end) count++;
    return count;
  }, [filters]);

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        
        {/* Simplified Header with Search */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Calendar</h1>
              <p className="text-muted-foreground mt-1 text-lg">
                Your schedule for events and meetings
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                className="h-10 px-4 bg-purple-600 hover:bg-purple-700 shadow-sm transition-all hover:shadow-md"
                onClick={() => {
                  setSelectedEvent(null);
                  setShowEventModal(true);
                }}
                disabled={!canCreateEvent}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </div>
          </div>

          <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-2">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Search events..."
                defaultValue={filters.search}
                onChange={handleSearchChange}
                className="pl-10 h-12 border-0 bg-transparent focus-visible:ring-0 text-lg placeholder:text-gray-400"
              />
              {filters.search && (
                <button
                  onClick={() => {
                    setFilters(prev => ({ ...prev, search: '' }));
                    const input = document.querySelector('input[placeholder="Search events..."]') as HTMLInputElement;
                    if (input) input.value = '';
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            
            <div className="flex gap-2 w-full md:w-auto px-2">
              <Button
                variant="ghost"
                onClick={() => setShowFilters(true)}
                className={`flex-1 md:flex-none h-10 px-4 ${
                  activeFiltersCount > 0 
                    ? 'bg-purple-50 text-purple-700 hover:bg-purple-100' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="ml-2 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex-1 md:flex-none h-10 px-4 text-gray-600 hover:bg-gray-50"
                    disabled={events.length === 0 || !canExport}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <Download className="mr-2 h-4 w-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowPDFModal(true)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Unified Calendar View */}
        <div className="h-[calc(100vh-250px)] min-h-[600px] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <EventsCalendar
            events={allEvents}
            isLoading={isLoadingEvents}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onEdit={(event) => {
              // Prevent editing tasks in event modal — redirect to Tasks module
              if (event.id.startsWith('task-')) {
                toast.info('Please manage tasks in the Tasks module');
                return;
              }
              if (!canEditEvent) {
                toast.error('You do not have permission to edit events');
                return;
              }
              // System events (renewals, birthdays) open in read-only mode
              // Regular events open in edit mode
              setSelectedEvent(event);
              setShowEventModal(true);
            }}
            onDelete={canDeleteEvent ? handleDeleteEvent : undefined}
            onUpdateStatus={handleUpdateEventStatus}
            onView={(event) => {
              if (event.id.startsWith('task-')) {
                toast.info('Please manage tasks in the Tasks module');
                return;
              }
              // All non-task events open in the modal (system events render read-only)
              setSelectedEvent(event);
              setShowEventModal(true);
            }}
            onNewEvent={() => {
              setSelectedEvent(null);
              setShowEventModal(true);
            }}
          />
        </div>
      </div>

      {/* Modals */}
      <EventFormModal
        open={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setSelectedEvent(null);
        }}
        onSubmit={selectedEvent ? handleUpdateEvent : handleCreateEvent}
        onDelete={canDeleteEvent ? async (id) => {
          const success = await handleDeleteEvent(id);
          if (success) {
            setShowEventModal(false);
            setSelectedEvent(null);
          }
        } : undefined}
        event={selectedEvent}
        events={events}
        isSubmitting={createEventMutation.isPending || updateEventMutation.isPending}
      />

      <CalendarPDFExportModal
        open={showPDFModal}
        onClose={() => setShowPDFModal(false)}
        events={allEvents}
      />

      <FiltersDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApplyFilters={setFilters}
      />
    </div>
  );
}