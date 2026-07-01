/**
 * Appointment Form Modal
 * Navigate Wealth Admin Dashboard
 *
 * Books a client-facing appointment (Calendly-style): the client receives a
 * confirmation email with an ICS invite, Google Calendar link, join/directions
 * button and a public reschedule/cancel link, followed by automatic reminders
 * (1 day before, morning of, 5 minutes before).
 *
 * Separate from EventFormModal on purpose: an appointment requires exactly one
 * client (with an email), branches on meeting kind, disallows recurrence, and
 * submits to /appointments rather than /calendar/events.
 *
 * Two modes:
 *   create — book a new appointment
 *   manage — opened from an existing appointment-type calendar event:
 *            reschedule, cancel, or re-send the confirmation
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Badge } from '../../../../ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../../../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../ui/popover';
import { cn } from '../../../../ui/utils';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronsUpDown,
  Clock,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Send,
  Type,
  User,
  Video,
  X,
} from 'lucide-react';
import { format, addHours } from 'date-fns';
import { useClients } from '../../../../../hooks/useClients';
import {
  useAppointmentByEvent,
  useCreateAppointment,
  useRescheduleAppointment,
  useCancelAppointment,
  useResendAppointmentConfirmation,
} from '../hooks/useAppointments';
import type { CalendarEvent, MeetingKind } from '../types';

const MEETING_KIND_OPTIONS: Array<{ value: MeetingKind; label: string; icon: React.ReactNode }> = [
  { value: 'virtual', label: 'Virtual (online meeting)', icon: <Video className="h-4 w-4" /> },
  { value: 'in_person', label: 'In person', icon: <MapPin className="h-4 w-4" /> },
  { value: 'phone', label: 'Phone call', icon: <Phone className="h-4 w-4" /> },
];

function toLocalInput(iso: string): string {
  try {
    return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

function toIso(local: string): string {
  return new Date(local).toISOString();
}

/** Human preview of which emails the client will receive for a start time. */
function cadencePreview(startLocal: string): string[] {
  const lines = ['Booking confirmation (immediately, with calendar invite)'];
  if (!startLocal) return lines;
  const startMs = new Date(startLocal).getTime();
  if (Number.isNaN(startMs)) return lines;
  const now = Date.now();

  if (startMs - 24 * 60 * 60 * 1000 > now) lines.push('Reminder — 1 day before');
  // Morning-of is approximate in the preview; exact SAST maths happens server-side
  if (startMs - 24 * 60 * 60 * 1000 <= now && startMs > now) {
    lines.push('Earlier reminders skipped (booking is less than a day away)');
  } else {
    lines.push('Reminder — morning of the appointment (07:00)');
  }
  if (startMs - 5 * 60 * 1000 > now) lines.push('Starting soon — 5 minutes before');
  return lines;
}

interface AppointmentFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When set (an appointment-type calendar event), the modal opens in manage mode. */
  event?: CalendarEvent | null;
}

export function AppointmentFormModal({ open, onClose, event }: AppointmentFormModalProps) {
  const isManageMode = !!event;

  const { data: clients = [], isLoading: isLoadingClients } = useClients();
  const { data: appointment, isLoading: isLoadingAppointment } = useAppointmentByEvent(
    isManageMode && open ? (event?.id ?? null) : null,
  );

  const createMutation = useCreateAppointment();
  const rescheduleMutation = useRescheduleAppointment();
  const cancelMutation = useCancelAppointment();
  const resendMutation = useResendAppointmentConfirmation();

  const isSubmitting =
    createMutation.isPending || rescheduleMutation.isPending || cancelMutation.isPending;

  const [openClientSelect, setOpenClientSelect] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_kind: 'virtual' as MeetingKind,
    join_url: '',
    location: '',
    start_at: '',
    end_at: '',
  });

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId],
  );

  // Initialise form on open
  useEffect(() => {
    if (!open) return;
    setErrorMessage(null);
    setShowCancelConfirm(false);
    setTitleTouched(false);

    if (event) {
      setFormData({
        title: event.title,
        description: event.description || '',
        meeting_kind: 'virtual', // refined below once the appointment loads
        join_url: event.video_link || '',
        location: event.location || '',
        start_at: toLocalInput(event.start_at),
        end_at: toLocalInput(event.end_at),
      });
    } else {
      const start = addHours(new Date(), 24);
      start.setMinutes(0, 0, 0);
      setFormData({
        title: '',
        description: '',
        meeting_kind: 'virtual',
        join_url: '',
        location: '',
        start_at: format(start, "yyyy-MM-dd'T'HH:mm"),
        end_at: format(addHours(start, 1), "yyyy-MM-dd'T'HH:mm"),
      });
      setSelectedClientId('');
    }
  }, [open, event]);

  // Manage mode: fold in appointment details once loaded
  useEffect(() => {
    if (!appointment) return;
    setFormData((prev) => ({
      ...prev,
      meeting_kind: appointment.meeting_kind,
      join_url: appointment.join_url || prev.join_url,
      location: appointment.location || prev.location,
    }));
  }, [appointment]);

  // Auto-suggest a title from the selected client until the advisor edits it
  useEffect(() => {
    if (isManageMode || titleTouched || !selectedClient) return;
    setFormData((prev) => ({ ...prev, title: `Consultation — ${selectedClient.full_name}` }));
  }, [selectedClient, titleTouched, isManageMode]);

  const validate = (): string | null => {
    if (!isManageMode) {
      if (!selectedClient) return 'Select a client for this appointment.';
      if (!selectedClient.email) {
        return 'The selected client has no email address on file — appointment emails cannot be sent.';
      }
      if (!formData.title.trim()) return 'Title is required.';
    }
    if (!formData.start_at || !formData.end_at) return 'Start and end times are required.';
    const startMs = new Date(formData.start_at).getTime();
    const endMs = new Date(formData.end_at).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 'Invalid date or time.';
    if (endMs <= startMs) return 'End time must be after the start time.';
    if (startMs <= Date.now()) return 'Appointments must be scheduled in the future.';
    if (formData.meeting_kind === 'in_person' && !formData.location.trim()) {
      return 'Location is required for in-person appointments.';
    }
    if (
      formData.meeting_kind === 'virtual' &&
      formData.join_url.trim() &&
      !/^https?:\/\/.+/i.test(formData.join_url.trim())
    ) {
      return 'The meeting link must start with http:// or https://';
    }
    return null;
  };

  const handleBook = async () => {
    const error = validate();
    if (error) {
      setErrorMessage(error);
      return;
    }
    setErrorMessage(null);

    try {
      await createMutation.mutateAsync({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        start_at: toIso(formData.start_at),
        end_at: toIso(formData.end_at),
        meeting_kind: formData.meeting_kind,
        join_url: formData.meeting_kind === 'virtual' ? formData.join_url.trim() || null : null,
        location: formData.location.trim() || null,
        client: {
          id: selectedClient!.id,
          name: selectedClient!.full_name,
          email: selectedClient!.email,
        },
      });
      onClose();
    } catch {
      // toast handled in the mutation
    }
  };

  const handleReschedule = async () => {
    if (!appointment) return;
    const error = validate();
    if (error) {
      setErrorMessage(error);
      return;
    }
    setErrorMessage(null);

    try {
      await rescheduleMutation.mutateAsync({
        id: appointment.id,
        start_at: toIso(formData.start_at),
        end_at: toIso(formData.end_at),
        join_url: formData.meeting_kind === 'virtual' ? formData.join_url.trim() || null : null,
        location: formData.location.trim() || null,
      });
      onClose();
    } catch {
      // toast handled in the mutation
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointment) return;
    try {
      await cancelMutation.mutateAsync({ id: appointment.id });
      onClose();
    } catch {
      // toast handled in the mutation
    }
  };

  const isCancelled = appointment?.status === 'cancelled' || event?.status === 'cancelled';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-purple-600" />
            {isManageMode ? 'Manage Appointment' : 'Book Appointment'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Client */}
          {isManageMode ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-400" />
                {isLoadingAppointment ? (
                  <span className="text-muted-foreground">Loading appointment…</span>
                ) : (
                  <div>
                    <div className="font-medium">{appointment?.client_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {appointment?.client_email}
                    </div>
                  </div>
                )}
              </div>
              {appointment &&
                (appointment.status === 'cancelled' ? (
                  <Badge variant="destructive">Cancelled</Badge>
                ) : appointment.status === 'reschedule_requested' ? (
                  <Badge variant="secondary">Reschedule requested</Badge>
                ) : (
                  <Badge>Confirmed</Badge>
                ))}
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Client *</Label>
              <Popover open={openClientSelect} onOpenChange={setOpenClientSelect} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openClientSelect}
                    className="w-full justify-between h-11 bg-gray-50/50 hover:bg-white border-gray-200"
                  >
                    <div className="flex items-center text-left">
                      <User className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                      {selectedClient ? (
                        <span>
                          {selectedClient.full_name}
                          <span className="text-muted-foreground text-xs ml-2">
                            {selectedClient.email || 'no email'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">Select a client…</span>
                      )}
                    </div>
                    {selectedClient ? (
                      <div
                        className="rounded-full hover:bg-gray-200 p-0.5 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClientId('');
                        }}
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </div>
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    )}
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
                              setSelectedClientId(client.id);
                              setOpenClientSelect(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedClientId === client.id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{client.full_name}</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {client.email || 'No email on file'}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedClient && !selectedClient.email && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This client has no email address on file, so booking emails cannot be sent.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Title */}
          {!isManageMode && (
            <div className="space-y-2">
              <Label htmlFor="appointment-title" className="text-sm font-medium text-gray-700">
                Title *
              </Label>
              <div className="relative">
                <Type className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="appointment-title"
                  className="pl-10"
                  placeholder="e.g. Consultation — Investment Review"
                  value={formData.title}
                  onChange={(e) => {
                    setTitleTouched(true);
                    setFormData((prev) => ({ ...prev, title: e.target.value }));
                  }}
                />
              </div>
            </div>
          )}

          {/* Meeting kind */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Meeting type</Label>
            <Select
              value={formData.meeting_kind}
              onValueChange={(value: MeetingKind) =>
                setFormData((prev) => ({ ...prev, meeting_kind: value }))
              }
              disabled={isManageMode}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEETING_KIND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meeting link (virtual) */}
          {formData.meeting_kind === 'virtual' && (
            <div className="space-y-2">
              <Label htmlFor="appointment-link" className="text-sm font-medium text-gray-700">
                Meeting link
              </Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="appointment-link"
                  className="pl-10"
                  placeholder="Paste a Teams, Google Meet or Zoom link"
                  value={formData.join_url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, join_url: e.target.value }))}
                />
              </div>
              {!formData.join_url.trim() && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Without a link, the reminder emails won't have a "Join meeting" button.
                </p>
              )}
            </div>
          )}

          {/* Location (in person) */}
          {formData.meeting_kind === 'in_person' && (
            <div className="space-y-2">
              <Label htmlFor="appointment-location" className="text-sm font-medium text-gray-700">
                Location *
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="appointment-location"
                  className="pl-10"
                  placeholder="Street address or office name"
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Date & time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointment-start" className="text-sm font-medium text-gray-700">
                Starts *
              </Label>
              <Input
                id="appointment-start"
                type="datetime-local"
                value={formData.start_at}
                onChange={(e) => {
                  const start = e.target.value;
                  setFormData((prev) => {
                    // Keep the same duration when the start moves
                    const prevStart = new Date(prev.start_at).getTime();
                    const prevEnd = new Date(prev.end_at).getTime();
                    const duration =
                      !Number.isNaN(prevStart) && !Number.isNaN(prevEnd) && prevEnd > prevStart
                        ? prevEnd - prevStart
                        : 60 * 60 * 1000;
                    const newStart = new Date(start);
                    return {
                      ...prev,
                      start_at: start,
                      end_at: Number.isNaN(newStart.getTime())
                        ? prev.end_at
                        : format(new Date(newStart.getTime() + duration), "yyyy-MM-dd'T'HH:mm"),
                    };
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment-end" className="text-sm font-medium text-gray-700">
                Ends *
              </Label>
              <Input
                id="appointment-end"
                type="datetime-local"
                value={formData.end_at}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_at: e.target.value }))}
              />
            </div>
          </div>

          {/* Notes */}
          {!isManageMode && (
            <div className="space-y-2">
              <Label htmlFor="appointment-notes" className="text-sm font-medium text-gray-700">
                Notes (included in the invite)
              </Label>
              <Textarea
                id="appointment-notes"
                placeholder="Agenda or anything the client should prepare"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          )}

          {/* Email cadence preview */}
          {!isCancelled && (
            <div className="p-3 rounded-lg border border-purple-100 bg-purple-50/50 space-y-1">
              <p className="text-sm font-medium text-purple-900 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                The client will receive:
              </p>
              <ul className="text-xs text-purple-800 space-y-0.5 pl-6 list-disc">
                {cadencePreview(formData.start_at).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="text-xs text-purple-700 pl-6 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Every email includes reschedule and cancel links for the client.
              </p>
            </div>
          )}

          {errorMessage && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          {isManageMode ? (
            isCancelled ? (
              <Button variant="outline" className="w-full" onClick={onClose}>
                Close
              </Button>
            ) : showCancelConfirm ? (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Cancel this appointment? The client will be emailed a cancellation notice and
                    all pending reminders will stop.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={isSubmitting}
                  >
                    Keep appointment
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancelAppointment}
                    disabled={isSubmitting}
                  >
                    {cancelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Cancel appointment
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={handleReschedule}
                  disabled={isSubmitting || isLoadingAppointment || !appointment}
                >
                  {rescheduleMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Reschedule &amp; notify client
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => appointment && resendMutation.mutate(appointment.id)}
                    disabled={resendMutation.isPending || !appointment}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Re-send confirmation
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={isSubmitting || !appointment}
                  >
                    Cancel appointment
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Close
              </Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                onClick={handleBook}
                disabled={isSubmitting}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Book &amp; send confirmation
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
