import React, { useState } from 'react';
import type { CalendarEvent, CalendarView } from '../types';
import { CalendarHeader } from './views/CalendarHeader';
import { MonthView } from './views/MonthView';
import { AgendaView } from './views/AgendaView';

interface EventsCalendarProps {
  events: CalendarEvent[];
  isLoading: boolean;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  
  // Event callbacks
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: 'completed' | 'cancelled') => void;
  onView: (event: CalendarEvent) => void;
  onNewEvent: () => void;
}

export function EventsCalendar({
  events,
  isLoading,
  currentDate,
  onDateChange,
  onEdit,
  onView,
  onNewEvent,
}: EventsCalendarProps) {
  const [view, setView] = useState<CalendarView>('month');

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Enhanced Calendar Controls */}
      <CalendarHeader 
        view={view}
        currentDate={currentDate}
        onDateChange={onDateChange}
        onViewChange={setView}
        onToday={() => onDateChange(new Date())}
      />

      {/* Main View Area */}
      <div className="flex-1 min-h-0 relative">
        {isLoading && (
          <div className="absolute inset-0 z-50 bg-white/50 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
          </div>
        )}
        
        {/* Render views */}
        {view === 'month' && (
          <MonthView 
            events={events}
            currentDate={currentDate}
            onDateChange={onDateChange}
            onViewChange={setView}
            onViewEvent={onView}
          />
        )}
        
        {(view === 'agenda' || view === 'day' || view === 'week') && (
          <AgendaView 
            events={events}
            currentDate={currentDate}
            onViewChange={setView}
            onEdit={onEdit}
            onNewEvent={onNewEvent}
          />
        )}
      </div>
    </div>
  );
}
