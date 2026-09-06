/**
 * EventFormModal
 *
 * One dialog for creating and editing calendar events, plus a read-only view
 * for system-generated ones (birthdays, policy renewals, tasks).
 *
 * The form is deliberately short: title, type, when, where, clients, repeat,
 * notes. "When" is a date + start time + duration instead of two raw
 * datetime-local inputs, so the adviser never has to reason about end times.
 * Warnings (outside business hours, in the past, clashes) are inline hints,
 * not blocking dialogs.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { format, isBefore } from 'date-fns';
import {
  AlertTriangle,
  Cake,
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Clock,
  Info,
  MapPin,
  Phone,
  RefreshCw,
  Users,
  Video,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import { Calendar } from '../../../../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../../../ui/command';
import { cn } from '../../../../ui/utils';
import { useClients } from '../../../../../hooks/useClients';
import { useSearchInputAutofillGuard } from '@/shared/forms/useSearchInputAutofillGuard';

import type { CalendarEvent, CreateEventInput, EventType } from '../types';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '../constants';
import {
  buildDurationOptions,
  buildRecurrenceRule,
  buildTimeOptions,
  combineDateAndTime,
  computeEndAt,
  DEFAULT_RECURRENCE,
  defaultStart,
  findConflict,
  formatDuration,
  formatTimeLabel,
  FREQUENCY_UNIT,
  isOutsideBusinessHours,
  isValidMeetingLink,
  normaliseLocationType,
  parseRecurrenceRule,
  recurrenceError,
  splitEventTimes,
  type FormLocationType,
  type RecurrenceFrequency,
  type RecurrenceState,
} from './eventFormHelpers';

// ============================================================================
// OPTIONS
// ============================================================================

/** Event types an adviser can create by hand (birthday / renewal are system). */
const EVENT_TYPE_OPTIONS: { value: EventType; label: string; dot: string }[] = [
  { value: 'meeting', label: 'Meeting', dot: 'bg-blue-500' },
  { value: 'call', label: 'Call', dot: 'bg-green-500' },
  { value: 'review', label: 'Review', dot: 'bg-purple-500' },
  { value: 'consultation', label: 'Consultation', dot: 'bg-teal-500' },
  { value: 'webinar', label: 'Webinar', dot: 'bg-indigo-500' },
  { value: 'internal', label: 'Internal', dot: 'bg-gray-500' },
  { value: 'deadline', label: 'Deadline', dot: 'bg-rose-500' },
  { value: 'other', label: 'Other', dot: 'bg-slate-400' },
];

const LOCATION_OPTIONS: { value: FormLocationType; label: string; icon: React.ElementType }[] = [
  { value: 'in_person', label: 'In person', icon: MapPin },
  { value: 'video', label: 'Video call', icon: Video },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'other', label: 'Other', icon: Info },
];

const REPEAT_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

function isSystemEvent(event: CalendarEvent | null | undefined): boolean {
  if (!event) return false;
  return (
    event.id.startsWith('renewal-') ||
    event.id.startsWith('birthday-') ||
    event.id.startsWith('task-')
  );
}

// ============================================================================
// SMALL BUILDING BLOCKS
// ============================================================================

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-gray-800">
          {label}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

interface PillOption<T extends string> {
  value: T;
  label: string;
  dot?: string;
  icon?: React.ElementType;
}

/** A row of single-select pills. Plain buttons, keyboard and screen-reader friendly. */
function PillGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40',
              selected
                ? 'border-purple-600 bg-purple-600 text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
            )}
          >
            {option.dot && (
              <span className={cn('h-2 w-2 rounded-full', selected ? 'bg-white/80' : option.dot)} />
            )}
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Hint({
  tone,
  children,
}: {
  tone: 'warning' | 'info' | 'error';
  children: React.ReactNode;
}) {
  const styles = {
    warning: 'text-amber-700',
    info: 'text-blue-700',
    error: 'text-red-600',
  }[tone];
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <p className={cn('flex items-start gap-1.5 text-xs', styles)}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// ============================================================================
// READ-ONLY VIEW FOR SYSTEM EVENTS
// ============================================================================

function SystemEventView({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const isRenewal = event.event_type === 'renewal';
  const isBirthday = event.event_type === 'birthday';
  const Icon = isRenewal ? RefreshCw : isBirthday ? Cake : CalendarIcon;
  const iconStyle = isRenewal
    ? 'bg-amber-100 text-amber-600'
    : isBirthday
      ? 'bg-pink-100 text-pink-600'
      : 'bg-blue-100 text-blue-600';
  const note = isRenewal
    ? 'Policy renewal reminders come from policy inception dates. Update the policy in the client profile to change this date.'
    : isBirthday
      ? 'Birthday reminders come from the client date of birth. Update the client profile to change this date.'
      : 'Task events are managed in the Tasks module.';

  return (
    <div className="contents">
      <DialogHeader className="px-6 pt-6 pb-4 text-left">
        <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
          <span className={cn('rounded-lg p-2', iconStyle)}>
            <Icon className="h-5 w-5" />
          </span>
          {EVENT_TYPE_LABELS[event.event_type] || 'Event'}
        </DialogTitle>
        <DialogDescription>
          This event is generated automatically and cannot be edited.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-6 pb-6">
        <Badge className={cn(EVENT_TYPE_COLORS[event.event_type], 'border-0 font-medium')}>
          {EVENT_TYPE_LABELS[event.event_type]}
        </Badge>
        <p className="text-base font-semibold text-gray-900">{event.title}</p>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-800">
          <p className="font-medium">{format(new Date(event.start_at), 'EEEE, d MMMM yyyy')}</p>
          <p className="text-gray-600">
            {format(new Date(event.start_at), 'HH:mm')} – {format(new Date(event.end_at), 'HH:mm')}
          </p>
        </div>
        {event.client && (
          <p className="flex items-center gap-2 text-sm text-gray-700">
            <Users className="h-4 w-4 text-gray-400" />
            {event.client.full_name}
          </p>
        )}
        {event.description && (
          <p className="whitespace-pre-wrap text-sm text-gray-700">{event.description}</p>
        )}
        <Hint tone="info">{note}</Hint>
      </div>

      <DialogFooter className="border-t border-gray-100 px-6 py-4">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </div>
  );
}

// ============================================================================
// FORM
// ============================================================================

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEventInput) => void;
  onDelete?: (id: string) => void;
  event?: CalendarEvent | null;
  events?: CalendarEvent[];
  isSubmitting?: boolean;
}

interface FormState {
  title: string;
  eventType: EventType;
  date: Date;
  time: string;
  durationMinutes: number;
  locationType: FormLocationType;
  location: string;
  videoLink: string;
  clientIds: string[];
  recurrence: RecurrenceState;
  notes: string;
}

function emptyForm(): FormState {
  const start = defaultStart();
  return {
    title: '',
    eventType: 'meeting',
    date: start.date,
    time: start.time,
    durationMinutes: 60,
    locationType: 'in_person',
    location: '',
    videoLink: '',
    clientIds: [],
    recurrence: DEFAULT_RECURRENCE,
    notes: '',
  };
}

function formFromEvent(event: CalendarEvent, knownClientIds: Set<string>): FormState {
  const times = splitEventTimes(event.start_at, event.end_at);
  const clientIds = new Set<string>();
  if (event.client_id) clientIds.add(event.client_id);
  if (event.attendees && !Array.isArray(event.attendees)) {
    Object.keys(event.attendees).forEach((id) => {
      if (knownClientIds.has(id)) clientIds.add(id);
    });
  }
  return {
    title: event.title,
    eventType: event.event_type,
    date: times.date,
    time: times.time,
    durationMinutes: times.durationMinutes,
    locationType: normaliseLocationType(event.location_type),
    location: event.location || '',
    videoLink: event.video_link || '',
    clientIds: Array.from(clientIds),
    recurrence: parseRecurrenceRule(event.recurrence_rule),
    notes: event.description || '',
  };
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
  const clientSearchInputGuard = useSearchInputAutofillGuard({
    id: 'calendar-event-client-search',
  });
  const { data: clients = [], isLoading: isLoadingClients } = useClients();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [dateOpen, setDateOpen] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);

  const patch = (changes: Partial<FormState>) => setForm((prev) => ({ ...prev, ...changes }));

  // Reset when the dialog opens or the event being edited changes. `clients`
  // is read at open only: re-running on every refetch would wipe edits.
  useEffect(() => {
    if (!open) return;
    if (event && !isSystemEvent(event)) {
      setForm(formFromEvent(event, new Set(clients.map((c) => c.id))));
    } else {
      setForm(emptyForm());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, open]);

  // Derived timing
  const startAt = useMemo(() => combineDateAndTime(form.date, form.time), [form.date, form.time]);
  const endAt = useMemo(
    () => computeEndAt(startAt, form.durationMinutes),
    [startAt, form.durationMinutes],
  );
  const timeOptions = useMemo(() => buildTimeOptions(form.time), [form.time]);
  const durationOptions = useMemo(
    () => buildDurationOptions(form.durationMinutes),
    [form.durationMinutes],
  );

  const outsideHours = isOutsideBusinessHours(startAt, endAt);
  const inPast = !event && isBefore(startAt, new Date());
  const conflict = useMemo(
    () => findConflict(events, startAt, endAt, event?.id),
    [events, startAt, endAt, event?.id],
  );
  const repeatError = recurrenceError(form.recurrence, startAt);

  const selectedClients = form.clientIds
    .map((id) => clients.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const toggleClient = (id: string) =>
    patch({
      clientIds: form.clientIds.includes(id)
        ? form.clientIds.filter((c) => c !== id)
        : [...form.clientIds, id],
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const title = form.title.trim();
    if (!title) {
      toast.error('Give the event a title');
      return;
    }
    if (form.locationType === 'video' && form.videoLink && !isValidMeetingLink(form.videoLink)) {
      toast.error('The meeting link must start with http:// or https://');
      return;
    }
    if (repeatError) {
      toast.error(repeatError);
      return;
    }

    const attendees: Record<string, unknown> = {};
    selectedClients.forEach((client) => {
      attendees[client.id] = { name: client.full_name, email: client.email, type: 'client' };
    });

    onSubmit({
      title,
      description: form.notes.trim() || null,
      event_type: form.eventType,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      location_type: form.locationType,
      location:
        form.locationType === 'in_person' || form.locationType === 'other'
          ? form.location.trim() || null
          : null,
      video_link: form.locationType === 'video' ? form.videoLink.trim() || null : null,
      client_id: form.clientIds[0] ?? null,
      attendees: attendees as unknown as Record<string, unknown>[],
      recurrence_rule: buildRecurrenceRule(form.recurrence),
    });
  };

  const isEditing = Boolean(event);
  const repeatUnit =
    form.recurrence.frequency === 'none'
      ? null
      : FREQUENCY_UNIT[form.recurrence.frequency][form.recurrence.interval === 1 ? 0 : 1];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        {event && isSystemEvent(event) ? (
          <SystemEventView event={event} onClose={onClose} />
        ) : (
          <form onSubmit={handleSubmit} className="flex max-h-[88vh] flex-col">
            <DialogHeader className="px-6 pt-6 pb-2 text-left">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Edit Event' : 'New Event'}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? 'Change the details below and save.'
                  : 'Pick a time, add who it is with, and you are done.'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
              {/* Title */}
              <Input
                id="event-title"
                aria-label="Event title"
                value={form.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Add a title"
                autoFocus
                required
                className="h-12 border-gray-200 text-base font-medium placeholder:font-normal"
              />

              {/* Type */}
              <Field label="Type">
                <PillGroup
                  label="Event type"
                  options={EVENT_TYPE_OPTIONS}
                  value={form.eventType}
                  onChange={(eventType) => patch({ eventType })}
                />
              </Field>

              {/* When */}
              <Field label="When" hint={`Ends ${format(endAt, 'HH:mm')}`}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Date"
                        className="col-span-2 h-10 justify-start border-gray-200 font-normal sm:col-span-1"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                        {format(form.date, 'EEE, d MMM yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.date}
                        defaultMonth={form.date}
                        onSelect={(date) => {
                          if (date) patch({ date });
                          setDateOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Both selects ignore an empty change: Radix syncs a hidden native
                      <select> whose option for a non-standard value (an event at
                      09:20, a 70-minute duration) mounts a tick after the value
                      itself, and that sync reports '' in between. */}
                  <Select
                    value={form.time}
                    onValueChange={(time) => {
                      if (time) patch({ time });
                    }}
                  >
                    <SelectTrigger aria-label="Start time" className="h-10 w-full sm:w-[132px]">
                      <Clock className="mr-1 h-4 w-4 text-gray-500" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time}>
                          {formatTimeLabel(time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={String(form.durationMinutes)}
                    onValueChange={(value) => {
                      if (value) patch({ durationMinutes: Number(value) });
                    }}
                  >
                    <SelectTrigger aria-label="Duration" className="h-10 w-full sm:w-[132px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map((minutes) => (
                        <SelectItem key={minutes} value={String(minutes)}>
                          {formatDuration(minutes)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(outsideHours || inPast || conflict) && (
                  <div className="space-y-1 pt-1">
                    {conflict && (
                      <Hint tone="warning">
                        Clashes with “{conflict.title}” (
                        {format(new Date(conflict.start_at), 'HH:mm')}–
                        {format(new Date(conflict.end_at), 'HH:mm')}). You can still save it.
                      </Hint>
                    )}
                    {outsideHours && (
                      <Hint tone="warning">Outside business hours (Mon–Fri, 08:00–18:00).</Hint>
                    )}
                    {inPast && (
                      <Hint tone="info">
                        This time is in the past. It will be saved as a record.
                      </Hint>
                    )}
                  </div>
                )}
              </Field>

              {/* Where */}
              <Field label="Where">
                <PillGroup
                  label="Location type"
                  options={LOCATION_OPTIONS}
                  value={form.locationType}
                  onChange={(locationType) => patch({ locationType })}
                />
                {(form.locationType === 'in_person' || form.locationType === 'other') && (
                  <Input
                    aria-label="Location"
                    value={form.location}
                    onChange={(e) => patch({ location: e.target.value })}
                    placeholder={
                      form.locationType === 'in_person'
                        ? 'Address or meeting room (optional)'
                        : 'Where is this happening? (optional)'
                    }
                    className="h-10 border-gray-200"
                  />
                )}
                {form.locationType === 'video' && (
                  <Input
                    aria-label="Meeting link"
                    type="url"
                    inputMode="url"
                    value={form.videoLink}
                    onChange={(e) => patch({ videoLink: e.target.value })}
                    placeholder="Paste the meeting link (optional)"
                    className="h-10 border-gray-200"
                  />
                )}
              </Field>

              {/* Clients */}
              <Field label="Clients" hint="Optional">
                <Popover open={clientsOpen} onOpenChange={setClientsOpen} modal>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientsOpen}
                      aria-label="Add clients"
                      className="h-10 w-full justify-between border-gray-200 font-normal text-muted-foreground"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        {selectedClients.length === 0
                          ? 'Add a client'
                          : `${selectedClients.length} selected`}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                    <Command>
                      <CommandInput
                        {...(clientSearchInputGuard as React.ComponentProps<typeof CommandInput>)}
                        placeholder="Search by name or email"
                      />
                      <CommandList>
                        <CommandEmpty>
                          {isLoadingClients ? 'Loading clients…' : 'No client found.'}
                        </CommandEmpty>
                        <CommandGroup className="max-h-56 overflow-auto">
                          {clients.map((client) => {
                            const selected = form.clientIds.includes(client.id);
                            return (
                              <CommandItem
                                key={client.id}
                                value={client.full_name}
                                keywords={[client.email]}
                                onSelect={() => toggleClient(client.id)}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    selected ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate">{client.full_name}</span>
                                  <span className="truncate text-xs text-muted-foreground">
                                    {client.email}
                                  </span>
                                </span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedClients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedClients.map((client) => (
                      <Badge
                        key={client.id}
                        variant="secondary"
                        className="h-7 gap-1 rounded-full pl-3 pr-1 font-normal"
                      >
                        {client.full_name}
                        <button
                          type="button"
                          aria-label={`Remove ${client.full_name}`}
                          onClick={() => toggleClient(client.id)}
                          className="rounded-full p-0.5 hover:bg-gray-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </Field>

              {/* Repeat */}
              <Field label="Repeat">
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={form.recurrence.frequency}
                    onValueChange={(frequency: RecurrenceFrequency) =>
                      patch({ recurrence: { ...form.recurrence, frequency } })
                    }
                  >
                    <SelectTrigger aria-label="Repeat" className="h-10 w-full sm:w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPEAT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {repeatUnit && (
                    <div className="flex h-10 items-center gap-2 text-sm text-gray-600">
                      <span>every</span>
                      <Input
                        aria-label="Repeat interval"
                        type="number"
                        min={1}
                        max={99}
                        value={form.recurrence.interval}
                        onChange={(e) =>
                          patch({
                            recurrence: {
                              ...form.recurrence,
                              interval: Math.min(99, Math.max(1, parseInt(e.target.value) || 1)),
                            },
                          })
                        }
                        className="h-10 w-16 border-gray-200 text-center"
                      />
                      <span>{repeatUnit}</span>
                    </div>
                  )}

                  {repeatUnit && (
                    <div className="flex h-10 items-center gap-2 text-sm text-gray-600">
                      <span>until</span>
                      <Input
                        aria-label="Repeat until"
                        type="date"
                        value={form.recurrence.endDate}
                        min={format(form.date, 'yyyy-MM-dd')}
                        onChange={(e) =>
                          patch({ recurrence: { ...form.recurrence, endDate: e.target.value } })
                        }
                        className="h-10 w-[150px] border-gray-200"
                      />
                    </div>
                  )}
                </div>
                {repeatError && <Hint tone="error">{repeatError}</Hint>}
              </Field>

              {/* Notes */}
              <Field label="Notes" hint="Optional" htmlFor="event-notes">
                <Textarea
                  id="event-notes"
                  value={form.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  placeholder="Agenda, documents to bring, anything to remember"
                  rows={3}
                  className="border-gray-200"
                />
              </Field>
            </div>

            <DialogFooter className="flex-row items-center justify-between border-t border-gray-100 bg-gray-50/60 px-6 py-4 sm:justify-between">
              {event && onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onDelete(event.id)}
                  disabled={isSubmitting}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Event'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
