import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Switch } from '../../../../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { 
  Calendar, 
  MapPin, 
  User, 
  Video, 
  Phone, 
  AlignLeft, 
  Clock, 
  Type,
  Link,
  Repeat,
  AlertTriangle,
  Check,
  ChevronsUpDown,
  X,
  Info,
  RefreshCw,
  Cake,
  ShieldCheck
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert';
import { Badge } from '../../../../ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../../ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../ui/popover";
import { cn } from "../../../../ui/utils";
import type { CalendarEvent, EventType, LocationType, CreateEventInput } from '../types';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, LOCATION_TYPE_LABELS } from '../constants';
import { useClients } from '../../../../../hooks/useClients';
import { format, addHours } from 'date-fns';
import { toast } from 'sonner@2.0.3';

// System-generated event types that cannot be manually created
const SYSTEM_EVENT_TYPES: EventType[] = ['birthday', 'renewal'];

// Event types available for manual creation (excludes system types)
const MANUAL_EVENT_TYPE_ENTRIES = Object.entries(EVENT_TYPE_LABELS).filter(
  ([value]) => !SYSTEM_EVENT_TYPES.includes(value as EventType)
);

// Helper to check if an event is system-generated
function isSystemEvent(event: CalendarEvent | null | undefined): boolean {
  if (!event) return false;
  return (
    event.id.startsWith('renewal-') ||
    event.id.startsWith('birthday-') ||
    event.id.startsWith('task-')
  );
}

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEventInput) => void;
  onDelete?: (id: string) => void;
  event?: CalendarEvent | null;
  events?: CalendarEvent[];
  isSubmitting?: boolean;
}

export function EventFormModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  event,
  events = [],
  isSubmitting = false,
}: EventFormModalProps) {
  const { data: clients = [], isLoading: isLoadingClients } = useClients();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'meeting' as EventType,
    start_at: '',
    end_at: '',
    location_type: 'in_person' as LocationType,
    location: '',
    video_link: '',
    client_id: '',
  });

  // Derived state for business hours check
  const isOutsideBusinessHours = React.useMemo(() => {
    if (!formData.start_at || !formData.end_at) return false;
    const start = new Date(formData.start_at);
    const end = new Date(formData.end_at);
    
    // Check weekends (0 = Sunday, 6 = Saturday)
    const day = start.getDay();
    if (day === 0 || day === 6) return true;

    // Check hours (Standard: 08:00 - 18:00)
    const startHour = start.getHours();
    const endHour = end.getHours();
    const endMinutes = end.getMinutes();

    // Start before 8am
    if (startHour < 8) return true;

    // End after 6pm
    if (endHour > 18 || (endHour === 18 && endMinutes > 0)) return true;

    return false;
  }, [formData.start_at, formData.end_at]);

  const isPastEvent = React.useMemo(() => {
    if (!formData.start_at) return false;
    return new Date(formData.start_at) < new Date();
  }, [formData.start_at]);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  // Reminder state
  const [sendReminders, setSendReminders] = useState(false);
  
  // Multi-select state
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [openClientSelect, setOpenClientSelect] = useState(false);

  // Initialize form when event changes
  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || '',
        event_type: event.event_type,
        start_at: format(new Date(event.start_at), "yyyy-MM-dd'T'HH:mm"),
        end_at: format(new Date(event.end_at), "yyyy-MM-dd'T'HH:mm"),
        location_type: event.location_type,
        location: event.location || '',
        video_link: event.video_link || '',
        client_id: event.client_id || '',
      });
      // Reset reminder toggle on edit (or could fetch if stored)
      setSendReminders(false);

      // Initialize selected clients from event
      const initialClientIds = new Set<string>();
      if (event.client_id) initialClientIds.add(event.client_id);
      
      if (event.attendees && typeof event.attendees === 'object') {
         Object.keys(event.attendees).forEach(key => {
           // We assume keys in attendees that match client IDs are clients
           if (clients.some(c => c.id === key)) {
             initialClientIds.add(key);
           }
         });
      }
      setSelectedClientIds(Array.from(initialClientIds));

      // Parse recurrence rule if exists
      if (event.recurrence_rule) {
        try {
          const rule = JSON.parse(event.recurrence_rule);
          setIsRecurring(true);
          setRecurrenceFrequency(rule.frequency || 'weekly');
          setRecurrenceInterval(rule.interval || 1);
          setRecurrenceEndDate(rule.endDate || '');
        } catch (e) {
          // If not JSON, maybe ignore or try to handle legacy format if any (none expected for events yet)
          console.log('Failed to parse recurrence rule', e);
          setIsRecurring(false);
        }
      } else {
        setIsRecurring(false);
        setRecurrenceFrequency('weekly');
        setRecurrenceInterval(1);
        setRecurrenceEndDate('');
      }
    } else {
      // Reset form for new event
      const now = new Date();
      now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15); // Round to next 15 min
      const endTime = addHours(now, 1);
      
      setFormData({
        title: '',
        description: '',
        event_type: 'meeting',
        start_at: format(now, "yyyy-MM-dd'T'HH:mm"),
        end_at: format(endTime, "yyyy-MM-dd'T'HH:mm"),
        location_type: 'in_person',
        location: '',
        video_link: '',
        client_id: '',
      });

      setSelectedClientIds([]);
      setIsRecurring(false);
      setRecurrenceFrequency('weekly');
      setRecurrenceInterval(1);
      setRecurrenceEndDate('');
      setSendReminders(false);
    }
  }, [event, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.start_at || !formData.end_at) {
      return;
    }

    // Validate Title
    if (!formData.title.trim()) {
      toast.error('Event title is required');
      return;
    }

    // Validate end time is after start time
    if (new Date(formData.end_at) <= new Date(formData.start_at)) {
      toast.error('End time must be after start time');
      return;
    }

    // Validate Minimum Duration (15 minutes)
    const durationMs = new Date(formData.end_at).getTime() - new Date(formData.start_at).getTime();
    if (durationMs < 15 * 60 * 1000) {
      toast.error('Event must be at least 15 minutes long');
      return;
    }

    // Warn if duration is very long (> 12 hours)
    if (durationMs > 12 * 60 * 60 * 1000) {
      if (!window.confirm(`This event is scheduled for ${(durationMs / (60 * 60 * 1000)).toFixed(1)} hours. Is this correct?`)) {
        return;
      }
    }

    // Validate Location Fields
    if (formData.location_type === 'in_person' && !formData.location.trim()) {
      toast.error('Please specify the location address or details');
      return;
    }

    // Validate Reminder Window & Client Email
    if (sendReminders) {
      const startMs = new Date(formData.start_at).getTime();
      const nowMs = new Date().getTime();
      
      // 35 minutes buffer
      if (startMs < nowMs + 35 * 60 * 1000) {
        toast.error('To send automatic email reminders, the event must start at least 35 minutes in the future.');
        return;
      }

      // Check Client Email
      if (selectedClientIds.length === 0) {
         toast.error('Please select at least one client to enable email reminders.');
         return;
      }

      const primaryClientId = selectedClientIds[0];
      const client = clients.find(c => c.id === primaryClientId);
      if (!client?.email) {
        toast.error('The primary selected client does not have an email address on file. Cannot send reminders.');
        return;
      }
    }

    // Validate Video URL
    if (formData.location_type === 'video' && formData.video_link) {
      try {
        const url = new URL(formData.video_link);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('Invalid protocol');
        }
      } catch (_) {
        toast.error('Please enter a valid video meeting URL (starting with http:// or https://)');
        return;
      }
    }

    // Conflict Detection
    if (events && events.length > 0) {
      const newStart = new Date(formData.start_at).getTime();
      const newEnd = new Date(formData.end_at).getTime();

      const conflictingEvent = events.find(e => {
        if (event && e.id === event.id) return false; // Skip self
        if (e.status === 'cancelled') return false; // Skip cancelled

        const eStart = new Date(e.start_at).getTime();
        const eEnd = new Date(e.end_at).getTime();

        return (newStart < eEnd && newEnd > eStart);
      });

      if (conflictingEvent) {
        if (!window.confirm(`Time conflict detected with event: "${conflictingEvent.title}".\n\nDo you want to proceed anyway?`)) {
          return;
        }
      }
    }

    // Construct recurrence rule
    let recurrenceRule = null;
    if (isRecurring) {
      if (recurrenceEndDate) {
        const start = new Date(formData.start_at);
        const endRecur = new Date(recurrenceEndDate);
        
        // Ensure end date is after start date
        if (endRecur <= start) {
          toast.error('Recurrence end date must be after the event start date.');
          return;
        }

        const twoYearsLater = new Date(start);
        twoYearsLater.setFullYear(start.getFullYear() + 2);
        
        if (endRecur > twoYearsLater) {
          toast.error('Recurring events cannot extend beyond 2 years from the start date.');
          return;
        }
      }

      recurrenceRule = JSON.stringify({
        frequency: recurrenceFrequency,
        interval: recurrenceInterval,
        endDate: recurrenceEndDate || null
      });
    }

    // Construct attendees map
    const attendees: Record<string, unknown> = {};
    selectedClientIds.forEach(id => {
       const client = clients.find(c => c.id === id);
       if (client) {
          attendees[id] = {
             name: client.full_name,
             email: client.email,
             type: 'client'
          };
       }
    });

    onSubmit({
      title: formData.title,
      description: formData.description || null,
      event_type: formData.event_type,
      start_at: new Date(formData.start_at).toISOString(),
      end_at: new Date(formData.end_at).toISOString(),
      location_type: formData.location_type,
      location: formData.location || null,
      video_link: formData.video_link || null,
      client_id: selectedClientIds.length > 0 ? selectedClientIds[0] : null,
      attendees: attendees,
      recurrence_rule: recurrenceRule,
      create_reminder: sendReminders,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-xl">
        {/* System Event Read-Only View */}
        {event && isSystemEvent(event) ? (
          <div className="contents">
            <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-gray-50/50">
              <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <div className={`p-2 rounded-lg ${
                  event.event_type === 'renewal' ? 'bg-amber-100' :
                  event.event_type === 'birthday' ? 'bg-pink-100' : 'bg-blue-100'
                }`}>
                  {event.event_type === 'renewal' ? (
                    <RefreshCw className={`h-5 w-5 ${event.event_type === 'renewal' ? 'text-amber-600' : 'text-blue-600'}`} />
                  ) : event.event_type === 'birthday' ? (
                    <Cake className="h-5 w-5 text-pink-600" />
                  ) : (
                    <Calendar className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                {EVENT_TYPE_LABELS[event.event_type] || 'Event'} Details
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1.5 ml-11">
                This is a system-generated event and cannot be edited.
              </p>
            </DialogHeader>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* System badge */}
              <div className="flex items-center gap-2">
                <Badge className={`${EVENT_TYPE_COLORS[event.event_type]} border-0 font-medium`}>
                  {EVENT_TYPE_LABELS[event.event_type]}
                </Badge>
                <Badge variant="outline" className="text-gray-500 border-gray-200 font-normal">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  System Generated
                </Badge>
              </div>

              {/* Title */}
              <div>
                <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Title</Label>
                <p className="text-base font-semibold text-gray-900">{event.title}</p>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Date
                  </Label>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(event.start_at), 'EEEE, d MMMM yyyy')}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Time</Label>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(event.start_at), 'HH:mm')} – {format(new Date(event.end_at), 'HH:mm')}
                  </p>
                </div>
              </div>

              {/* Client */}
              {event.client && (
                <div>
                  <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                    <User className="h-3 w-3 inline mr-1" />
                    Client
                  </Label>
                  <p className="text-sm text-gray-700">{event.client.full_name}</p>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <div>
                  <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                    <AlignLeft className="h-3 w-3 inline mr-1" />
                    Details
                  </Label>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-100">
                    {event.description}
                  </div>
                </div>
              )}

              {/* Info notice */}
              <Alert className="bg-blue-50 border-blue-200 py-3">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-xs text-blue-800 ml-2">
                  {event.event_type === 'renewal'
                    ? 'Policy renewal reminders are automatically generated from policy inception dates. To change the date, update the policy details in the client profile.'
                    : event.event_type === 'birthday'
                    ? 'Birthday reminders are automatically generated from client date of birth. To change the date, update the client profile.'
                    : 'Task events are managed through the Tasks module.'}
                </AlertDescription>
              </Alert>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          /* Regular Event Form */
          <div className="contents">
            <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-gray-50/50">
              <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                {event ? (
                  <div className="contents">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-purple-600" />
                    </div>
                    Edit Event
                  </div>
                ) : (
                  <div className="contents">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-purple-600" />
                    </div>
                    New Event
                  </div>
                )}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1.5 ml-11">
                {event ? 'Update the details of your scheduled event.' : 'Schedule a new meeting, task, or reminder.'}
              </p>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh]">
              <div className="p-6 space-y-6 overflow-y-auto">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium text-gray-700">Event Title <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g. Client Meeting – Investment Review"
                      required
                      className="pl-9 h-11 bg-gray-50/50 focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Event Type */}
                  <div className="space-y-2">
                    <Label htmlFor="event_type" className="text-sm font-medium text-gray-700">Event Type</Label>
                    <Select
                      value={formData.event_type}
                      onValueChange={(value: EventType) => 
                        setFormData(prev => ({ ...prev, event_type: value }))
                      }
                    >
                      <SelectTrigger className="h-11 bg-gray-50/50 focus:bg-white transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUAL_EVENT_TYPE_ENTRIES.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                value === 'meeting' ? 'bg-blue-500' :
                                value === 'call' ? 'bg-green-500' :
                                value === 'task' ? 'bg-purple-500' :
                                value === 'deadline' ? 'bg-red-500' :
                                value === 'review' ? 'bg-orange-500' :
                                value === 'renewal' ? 'bg-amber-500' :
                                value === 'birthday' ? 'bg-pink-500' : 'bg-gray-500'
                              }`} />
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Location Type */}
                  <div className="space-y-2">
                    <Label htmlFor="location_type" className="text-sm font-medium text-gray-700">Location Type</Label>
                    <Select
                      value={formData.location_type}
                      onValueChange={(value: LocationType) => 
                        setFormData(prev => ({ ...prev, location_type: value }))
                      }
                    >
                      <SelectTrigger className="h-11 bg-gray-50/50 focus:bg-white transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                             <div className="flex items-center gap-2">
                              {value === 'in_person' && <MapPin className="h-3.5 w-3.5" />}
                              {value === 'video' && <Video className="h-3.5 w-3.5" />}
                              {value === 'phone' && <Phone className="h-3.5 w-3.5" />}
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="space-y-2">
                    <Label htmlFor="start_at" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-blue-600" />
                      Starts
                    </Label>
                    <Input
                      id="start_at"
                      type="datetime-local"
                      value={formData.start_at}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_at: e.target.value }))}
                      required
                      className="bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_at" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      Ends
                    </Label>
                    <Input
                      id="end_at"
                      type="datetime-local"
                      value={formData.end_at}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_at: e.target.value }))}
                      required
                      className="bg-white"
                    />
                  </div>

                  {isPastEvent && formData.event_type === 'meeting' && (
                    <div className="col-span-1 md:col-span-2">
                       <Alert className="bg-blue-50 border-blue-200 text-blue-900 py-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-xs text-blue-800 ml-2">
                          You are scheduling a meeting in the past. It will be saved as a historical record.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {isOutsideBusinessHours && (
                    <div className="col-span-1 md:col-span-2">
                      <Alert className="bg-amber-50 border-amber-200 text-amber-900 py-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-xs text-amber-800 ml-2">
                          This event is scheduled outside of standard business hours (Mon-Fri, 08:00 - 18:00).
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>

                {/* Recurrence Section */}
                <div className="space-y-4 p-4 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white rounded-md border border-gray-200 shadow-sm">
                        <Repeat className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <Label htmlFor="is_recurring" className="text-sm font-medium text-gray-900 cursor-pointer">
                          Recurring Event
                        </Label>
                        <p className="text-xs text-muted-foreground">Repeat this event regularly</p>
                      </div>
                    </div>
                    <Switch
                      id="is_recurring"
                      checked={isRecurring}
                      onCheckedChange={setIsRecurring}
                    />
                  </div>

                  {isRecurring && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 fade-in pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500">Frequency</Label>
                        <Select
                          value={recurrenceFrequency}
                          onValueChange={(v: string) => setRecurrenceFrequency(v)}
                        >
                          <SelectTrigger className="h-9 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500">Interval</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Every</span>
                          <Input
                            type="number"
                            min={1}
                            max={99}
                            value={recurrenceInterval}
                            onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                            className="h-9 bg-white"
                          />
                          <span className="text-sm text-gray-500">
                            {recurrenceFrequency === 'daily' ? 'day(s)' : 
                             recurrenceFrequency === 'weekly' ? 'week(s)' : 
                             recurrenceFrequency === 'monthly' ? 'month(s)' : 'year(s)'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500">End Date (Optional)</Label>
                        <Input
                          type="date"
                          value={recurrenceEndDate}
                          onChange={(e) => setRecurrenceEndDate(e.target.value)}
                          className="h-9 bg-white"
                          min={formData.start_at ? formData.start_at.split('T')[0] : undefined}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Client Selection (Multi-Select) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Associated Clients</Label>
                  <Popover open={openClientSelect} onOpenChange={setOpenClientSelect} modal={true}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openClientSelect}
                        className="w-full justify-between h-auto min-h-[44px] bg-gray-50/50 hover:bg-white border-gray-200"
                      >
                        <div className="flex flex-wrap gap-1 items-center text-left py-1">
                          <User className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                          {selectedClientIds.length > 0 ? (
                            selectedClientIds.map((id) => {
                              const client = clients.find((c) => c.id === id);
                              return client ? (
                                <Badge variant="secondary" key={id} className="mr-1 hover:bg-gray-200 pl-2 pr-1 py-0.5 h-6 flex items-center gap-1">
                                  {client.full_name}
                                  <div
                                    className="rounded-full hover:bg-gray-300 p-0.5 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedClientIds(prev => prev.filter(p => p !== id));
                                    }}
                                  >
                                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                  </div>
                                </Badge>
                              ) : null;
                            })
                          ) : (
                            <span className="text-muted-foreground font-normal">Select clients...</span>
                          )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search clients..." />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingClients ? 'Loading clients...' : 'No client found.'}
                          </CommandEmpty>
                          <CommandGroup className="max-h-[200px] overflow-auto">
                            {clients.map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.full_name}
                                keywords={[client.email]}
                                onSelect={() => {
                                  setSelectedClientIds((prev) => 
                                    prev.includes(client.id) 
                                      ? prev.filter((id) => id !== client.id)
                                      : [...prev, client.id]
                                  );
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedClientIds.includes(client.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{client.full_name}</span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      {client.email}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Email Reminders Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="send_reminders" className="text-sm font-medium text-gray-900 cursor-pointer">
                      Send Email Reminders
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Send reminders to all selected clients 1 day and 30 mins before
                    </p>
                  </div>
                  <Switch
                    id="send_reminders"
                    checked={sendReminders}
                    onCheckedChange={setSendReminders}
                    disabled={selectedClientIds.length === 0}
                  />
                </div>
                {sendReminders && selectedClientIds.length === 0 && (
                   <p className="text-xs text-amber-600 mt-1 pl-4">
                     Please select at least one client to enable reminders.
                   </p>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <AlignLeft className="h-3.5 w-3.5 text-gray-400" />
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Add notes or an agenda..."
                    className="min-h-[100px] bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center mt-auto">
                {event && onDelete ? (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => onDelete(event.id)}
                    disabled={isSubmitting}
                    className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-100"
                  >
                    Delete Event
                  </Button>
                ) : (
                  <div /> // Spacer
                )}
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
                    {isSubmitting ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}