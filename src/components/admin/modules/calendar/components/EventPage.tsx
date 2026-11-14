/**
 * EventPage
 *
 * A calendar event as a page of its own (design system: records and long
 * forms are pages). An existing event opens in view; Edit turns the same page
 * into the form. A new event opens straight in the form. System-generated
 * entries (birthdays, policy renewals, tasks) are view only.
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
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Clock,
  Info,
  MapPin,
  Phone,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { FormErrorBanner } from '../../../layout/page';
import { BackLink } from '../../../layout/page/FilterControls';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { NumberInputField } from '../../../../ui/number-input';
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
// VIEW (the page before Edit; the only view for system entries)
// ============================================================================

function systemNote(event: CalendarEvent): string {
  if (event.event_type === 'renewal')
    return 'Policy renewal reminders come from policy inception dates. Update the policy in the client profile to change this date.';
  if (event.event_type === 'birthday')
    return 'Birthday reminders come from the client date of birth. Update the client profile to change this date.';
  return 'Task due dates are managed in To-Do.';
}

const LOCATION_LABEL: Record<string, string> = {
  video: 'Video call',
  virtual: 'Video call',
  in_person: 'In person',
  phone: 'Phone',
  other: 'Other',
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-xs font-medium text-nw-text-3 sm:pt-0.5">{label}</dt>
      <dd className="text-sm text-nw-ink">{children}</dd>
    </div>
  );
}

function EventDetails({ event }: { event: CalendarEvent }) {
  const system = isSystemEvent(event);
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const recurrence = parseRecurrenceRule(event.recurrence_rule);
  const attendees =
    event.attendees && !Array.isArray(event.attendees)
      ? Object.values(event.attendees as Record<string, { name?: string }>)
          .map((a) => a?.name)
          .filter(Boolean)
      : [];
  return (
    <dl className="divide-y divide-nw-line-2 rounded-xl border border-nw-line bg-white">
      <DetailRow label="Type">
        <Badge className={cn(EVENT_TYPE_COLORS[event.event_type], 'border-0 font-medium')}>
          {EVENT_TYPE_LABELS[event.event_type] || 'Event'}
        </Badge>
      </DetailRow>
      <DetailRow label="When">
        {format(start, 'EEEE, d MMMM yyyy')}
        {!system && (
          <span className="text-nw-text-2">
            {' '}
            · {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
          </span>
        )}
      </DetailRow>
      {!system && (
        <DetailRow label="Where">
          {LOCATION_LABEL[event.location_type] ?? event.location_type}
          {event.location ? ` · ${event.location}` : ''}
          {event.video_link && (
            <>
              {' · '}
              <a
                href={event.video_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-nw-violet-600 underline"
              >
                Join meeting
              </a>
            </>
          )}
        </DetailRow>
      )}
      {!system && (
        <DetailRow label="Repeats">
          {recurrence.frequency === 'none'
            ? 'Does not repeat'
            : `${REPEAT_OPTIONS.find((o) => o.value === recurrence.frequency)?.label ?? recurrence.frequency}${
                recurrence.interval > 1 ? `, every ${recurrence.interval}` : ''
              }${recurrence.endDate ? ` until ${recurrence.endDate}` : ''}`}
        </DetailRow>
      )}
      {(event.client || attendees.length > 0) && (
        <DetailRow label="Clients">
          {attendees.length > 0 ? attendees.join(', ') : event.client?.full_name}
        </DetailRow>
      )}
      {!system && (
        <DetailRow label="Status">
          <span className="capitalize">{event.status}</span>
        </DetailRow>
      )}
      <DetailRow label="Notes">
        {event.description ? (
          <span className="whitespace-pre-wrap">{event.description}</span>
        ) : (
          <span className="text-nw-text-3">No notes</span>
        )}
      </DetailRow>
    </dl>
  );
}

// ============================================================================
// FORM
// ============================================================================

interface EventPageProps {
  /** Leaves the page, back to the calendar. */
  onClose: () => void;
  onSubmit: (data: CreateEventInput) => void;
  onDelete?: (id: string) => void;
  /** null / undefined for a new event. */
  event?: CalendarEvent | null;
  events?: CalendarEvent[];
  isSubmitting?: boolean;
  /** An existing event opens in 'view' unless told otherwise. */
  initialMode?: 'view' | 'edit';
  /** Without edit rights the page stays in view. */
  canEdit?: boolean;
  /** A task's due date: open the task in To-Do. */
  onOpenTask?: (taskId: string) => void;
  /** A birthday or renewal: open the client. */
  onOpenClient?: (clientId: string) => void;
  /** Mark a scheduled event completed or cancelled (under ⋯). */
  onUpdateStatus?: (id: string, status: 'completed' | 'cancelled') => void;
}

interface FormErrors {
  title?: string;
  videoLink?: string;
  repeat?: string;
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

export function EventPage({
  onClose,
  onSubmit,
  onDelete,
  event,
  events = [],
  isSubmitting = false,
  initialMode,
  canEdit = true,
  onOpenTask,
  onOpenClient,
  onUpdateStatus,
}: EventPageProps) {
  const open = true;
  const system = isSystemEvent(event);
  const [mode, setMode] = useState<'view' | 'edit'>(
    !event ? 'edit' : system || !canEdit ? 'view' : (initialMode ?? 'view'),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const clientSearchInputGuard = useSearchInputAutofillGuard({
    id: 'calendar-event-client-search',
  });
  const { data: clients = [], isLoading: isLoadingClients, isError: clientsFailed } = useClients();

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
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, open, mode]);

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
    const next: FormErrors = {};
    if (!title) next.title = 'Give the event a title';
    if (form.locationType === 'video' && form.videoLink && !isValidMeetingLink(form.videoLink)) {
      next.videoLink = 'The meeting link must start with http:// or https://';
    }
    if (repeatError) next.repeat = repeatError;
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = next.title ? 'event-title' : next.videoLink ? 'event-link' : 'event-repeat';
      document.getElementById(first)?.focus();
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

  const errorCount = Object.values(errors).filter(Boolean).length;
  const taskId = event?.id.startsWith('task-') ? event.id.slice('task-'.length) : null;
  const clientId = event && system ? event.client_id : null;
  const subtitle = !event
    ? 'New event'
    : mode === 'edit'
      ? 'Edit event'
      : `${EVENT_TYPE_LABELS[event.event_type] || 'Event'} · ${format(new Date(event.start_at), 'EEE, d MMM yyyy')}${
          system
            ? ''
            : ` · ${format(new Date(event.start_at), 'HH:mm')}–${format(new Date(event.end_at), 'HH:mm')}`
        }`;
  const cancelEdit = () => {
    if (event) setMode('view');
    else onClose();
  };
  const canMark = !!event && !system && !!onUpdateStatus && canEdit && event.status === 'scheduled';
  const deleteMenu =
    event && !system && (onDelete || canMark) ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="More event actions">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canMark && (
            <>
              <DropdownMenuItem onSelect={() => onUpdateStatus!(event.id, 'completed')}>
                Mark as completed
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onUpdateStatus!(event.id, 'cancelled')}>
                Mark as cancelled
              </DropdownMenuItem>
            </>
          )}
          {onDelete && (
            <DropdownMenuItem
              onSelect={() => onDelete(event.id)}
              className="text-red-600 focus:bg-red-50 focus:text-red-700"
            >
              Delete…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-6 lg:p-8">
      <BackLink label="Back to calendar" onClick={onClose} />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight break-words text-nw-ink">
              {event ? event.title : form.title.trim() || 'New event'}
            </h1>
            <p className="mt-1 text-sm text-nw-text-3">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {mode === 'view' ? (
              <>
                {taskId && onOpenTask && (
                  <Button type="button" variant="outline" onClick={() => onOpenTask(taskId)}>
                    Open task
                  </Button>
                )}
                {clientId && onOpenClient && (
                  <Button type="button" variant="outline" onClick={() => onOpenClient(clientId)}>
                    Open client
                  </Button>
                )}
                {deleteMenu}
                {!system && canEdit && (
                  <Button type="button" onClick={() => setMode('edit')}>
                    Edit
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEdit}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                {deleteMenu}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create event'}
                </Button>
              </>
            )}
          </div>
        </div>

        {mode === 'view' && event ? (
          <div className="flex max-w-[880px] flex-col gap-3">
            {system && <Hint tone="info">{systemNote(event)}</Hint>}
            <EventDetails event={event} />
          </div>
        ) : (
          <div className="flex max-w-[880px] flex-col gap-4 rounded-xl border border-nw-line bg-white p-6">
            <FormErrorBanner
              count={errorCount}
              action={isEditing ? 'save the event' : 'create the event'}
            />
            <div className="space-y-6">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="event-title" className="text-sm font-medium text-gray-800">
                  Title <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="event-title"
                  aria-label="Event title"
                  value={form.title}
                  onChange={(e) => {
                    patch({ title: e.target.value });
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  placeholder="Add a title"
                  autoFocus={!event}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? 'event-title-error' : undefined}
                  className="h-11 border-gray-200 text-base font-medium placeholder:font-normal"
                />
                {errors.title && (
                  <p id="event-title-error" className="text-xs text-red-600">
                    {errors.title}
                  </p>
                )}
              </div>

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
                  <>
                    <Input
                      id="event-link"
                      aria-label="Meeting link"
                      type="url"
                      inputMode="url"
                      value={form.videoLink}
                      onChange={(e) => {
                        patch({ videoLink: e.target.value });
                        if (errors.videoLink)
                          setErrors((prev) => ({ ...prev, videoLink: undefined }));
                      }}
                      placeholder="Paste the meeting link (optional)"
                      aria-invalid={!!errors.videoLink}
                      className="h-10 border-gray-200"
                    />
                    {errors.videoLink && <Hint tone="error">{errors.videoLink}</Hint>}
                  </>
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
                          {isLoadingClients
                            ? 'Loading clients…'
                            : clientsFailed
                              ? "Couldn't load clients. Close and reopen the list to try again."
                              : 'No client found.'}
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
                    <SelectTrigger
                      id="event-repeat"
                      aria-label="Repeat"
                      className="h-10 w-full sm:w-[150px]"
                    >
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
                      <NumberInputField
                        aria-label="Repeat interval"
                        value={form.recurrence.interval}
                        onValueChange={(v) =>
                          patch({
                            recurrence: {
                              ...form.recurrence,
                              interval: Math.min(99, Math.max(1, v || 1)),
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
          </div>
        )}
      </form>
    </div>
  );
}
