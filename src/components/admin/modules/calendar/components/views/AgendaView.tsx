import React, { useState } from 'react';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { 
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  Edit,
  ChevronUp,
  ChevronDown,
  Users,
  Video,
  MapPin,
  Link as LinkIcon,
  Eye,
  RefreshCw,
  Cake,
  CheckSquare
} from 'lucide-react';
import { 
  format, 
  isToday, 
  startOfDay, 
  addDays,
  eachDayOfInterval
} from 'date-fns';
import type { CalendarEvent, CalendarView } from '../../types';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '../../constants';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';

// Helper to check if an event is system-generated
function isSystemEvent(event: CalendarEvent): boolean {
  return (
    event.id.startsWith('renewal-') ||
    event.id.startsWith('birthday-') ||
    event.id.startsWith('task-')
  );
}

// Get the appropriate icon for system event types
function getSystemEventIcon(event: CalendarEvent) {
  if (event.id.startsWith('renewal-')) return <RefreshCw className="h-3.5 w-3.5" />;
  if (event.id.startsWith('birthday-')) return <Cake className="h-3.5 w-3.5" />;
  if (event.id.startsWith('task-')) return <CheckSquare className="h-3.5 w-3.5" />;
  return null;
}

interface AgendaViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onViewChange: (view: CalendarView) => void;
  onEdit: (event: CalendarEvent) => void;
  onNewEvent: () => void;
}

export function AgendaView({
  events,
  currentDate,
  onViewChange,
  onEdit,
  onNewEvent
}: AgendaViewProps) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  
  // Use cached lookup for better performance
  const { getEventsOnDate } = useCalendarEvents(events);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Agenda shows next 14 days or selected day if it has items
  const start = startOfDay(currentDate);
  const end = addDays(start, 14); // Next 2 weeks
  
  // Get all dates in range and find those with events
  const dates = eachDayOfInterval({ start, end });
  const sortedDates: string[] = [];
  const grouped: Record<string, CalendarEvent[]> = {};
  
  dates.forEach(date => {
     const dayEvents = getEventsOnDate(date);
     if (dayEvents.length > 0) {
        const dateKey = format(date, 'yyyy-MM-dd');
        sortedDates.push(dateKey);
        grouped[dateKey] = dayEvents;
     }
  });

  return (
    <div className="space-y-6 p-4 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-6">
        <Button variant="ghost" size="sm" onClick={() => onViewChange('month')} className="self-start gap-1 pl-0 text-gray-500 hover:text-purple-600 hover:bg-transparent">
          <ArrowLeft className="h-4 w-4" />
          Back to Month
        </Button>
        <div className="flex items-center gap-2 mt-1">
           <div className="h-6 w-1 bg-purple-600 rounded-full" />
           <h3 className="font-bold text-xl text-gray-900">
              Schedule details
           </h3>
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-dashed text-center">
          <div className="bg-gray-50 p-4 rounded-full mb-4">
            <CalendarIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No upcoming events</h3>
          <p className="text-muted-foreground mt-1 mb-4 max-w-sm">
            There are no events scheduled for the next 14 days from {format(currentDate, 'MMM d')}.
          </p>
          <Button onClick={onNewEvent}>Schedule Event</Button>
        </div>
      ) : (
        sortedDates.map(dateKey => {
          const date = new Date(dateKey);
          const dayItems = grouped[dateKey];
          const isTodayDate = isToday(date);

          return (
            <div key={dateKey} className="flex gap-4">
              {/* Date Column */}
              <div className="flex flex-col items-center min-w-[60px] pt-1">
                <span className={`text-sm font-bold uppercase ${isTodayDate ? 'text-purple-600' : 'text-gray-500'}`}>
                  {format(date, 'EEE')}
                </span>
                <div className={`h-8 w-8 flex items-center justify-center rounded-full text-lg font-bold mt-1 ${
                  isTodayDate ? 'bg-purple-600 text-white' : 'bg-white text-gray-900 border border-gray-100'
                }`}>
                  {format(date, 'd')}
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 space-y-3 pb-6 border-l border-gray-100 pl-6 relative">
                {/* Timeline dot */}
                <div className={`absolute left-[-5px] top-2 h-2.5 w-2.5 rounded-full border-2 border-white ${isTodayDate ? 'bg-purple-600' : 'bg-gray-300'}`} />

                {dayItems.map((event) => {
                  const isCompleted = event.status === 'completed';
                  const isExpanded = expandedItems[`event-${event.id}`];
                  const isSystem = isSystemEvent(event);

                  return (
                    <div key={`event-${event.id}`} className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:border-purple-200 overflow-hidden">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${EVENT_TYPE_COLORS[event.event_type]?.split(' ')[0].replace('bg-', 'bg-') || 'bg-blue-500'}`} />
                      
                      <div className="p-4 pl-5">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded-md">
                                <Clock className="h-3 w-3" />
                                {format(new Date(event.start_at), 'HH:mm')} - {format(new Date(event.end_at), 'HH:mm')}
                              </span>
                              <Badge variant="secondary" className={`text-[10px] h-5 px-1.5 font-normal ${
                                isSystem ? EVENT_TYPE_COLORS[event.event_type] : ''
                              }`}>
                                {isSystem && getSystemEventIcon(event)}
                                {isSystem && <span className="ml-1">{EVENT_TYPE_LABELS[event.event_type]}</span>}
                                {!isSystem && EVENT_TYPE_LABELS[event.event_type]}
                              </Badge>
                            </div>
                            <h4 className={`font-semibold text-gray-900 text-base ${isCompleted ? 'line-through text-gray-500' : ''}`}>
                              {event.title}
                            </h4>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {isSystem ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-gray-400 hover:text-gray-600"
                                onClick={() => onEdit(event)}
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-gray-400 hover:text-gray-600"
                                onClick={() => onEdit(event)}
                                title="Edit event"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-gray-600" onClick={() => toggleExpand(`event-${event.id}`)}>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        
                        {/* Expanded Details */}
                        {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm animate-in fade-in slide-in-from-top-2">
                              <div className="col-span-full">
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Description</span>
                                <p className="text-gray-600 whitespace-pre-wrap">
                                  {event.description || <span className="text-gray-400 italic">No description provided</span>}
                                </p>
                              </div>
                              
                              {event.client && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Client</span>
                                  <div className="flex items-center gap-2 text-gray-700">
                                    <Users className="h-4 w-4 text-gray-400" />
                                    {event.client.full_name}
                                  </div>
                                </div>
                              )}
                              
                              {!isSystem && (event.location || event.location_type) && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Location</span>
                                  <div className="flex items-center gap-2 text-gray-700">
                                    {event.location_type === 'video' ? <Video className="h-4 w-4 text-gray-400" /> : <MapPin className="h-4 w-4 text-gray-400" />}
                                    {event.location || event.location_type}
                                  </div>
                                </div>
                              )}

                              {event.video_link && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                    {event.location_type === 'video' ? 'Meeting Link' : 'Related Link'}
                                  </span>
                                  <div className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
                                    <LinkIcon className="h-4 w-4 text-gray-400" />
                                    <a href={event.video_link} target="_blank" rel="noopener noreferrer" className="underline truncate max-w-[200px] md:max-w-xs block">
                                      {event.video_link}
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* System event source indicator */}
                              {isSystem && (
                                <div className="col-span-full">
                                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Source</span>
                                  <p className="text-xs text-gray-500 italic">
                                    {event.event_type === 'renewal'
                                      ? 'Auto-generated from policy inception dates'
                                      : event.event_type === 'birthday'
                                      ? 'Auto-generated from client date of birth'
                                      : 'Linked from Tasks module'}
                                  </p>
                                </div>
                              )}
                            </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
