/**
 * Reschedule Requests Panel
 * Navigate Wealth Admin Dashboard
 *
 * Header popover listing open client reschedule requests (submitted from the
 * public appointment manage page). "Rebook" applies a proposed time via the
 * reschedule endpoint — the client automatically receives a fresh
 * confirmation; "Dismiss" resolves the request without changing anything.
 */

import { useState } from 'react';
import { BellRing, CalendarClock, Check, Loader2, X } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../ui/popover';
import { Separator } from '../../../../ui/separator';
import {
  useRescheduleRequests,
  useRescheduleAppointment,
  useDismissRescheduleRequest,
} from '../hooks/useAppointments';
import type { ProposedTime, RescheduleRequest } from '../types';

const SAST_TZ = 'Africa/Johannesburg';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SAST_TZ,
  });
}

function RequestCard({ request }: { request: RescheduleRequest }) {
  const rescheduleMutation = useRescheduleAppointment();
  const dismissMutation = useDismissRescheduleRequest();
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);

  const busy = rescheduleMutation.isPending || dismissMutation.isPending;

  const handleRebook = async (time: ProposedTime, index: number) => {
    setApplyingIndex(index);
    try {
      await rescheduleMutation.mutateAsync({
        id: request.appointment.id,
        start_at: time.start_at,
        end_at: time.end_at,
      });
    } finally {
      setApplyingIndex(null);
    }
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{request.appointment.client_name}</p>
          <p className="text-xs text-muted-foreground">
            {request.appointment.event?.title || 'Appointment'}
            {request.appointment.event &&
              ` — currently ${formatDateTime(request.appointment.event.start_at)}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground"
          onClick={() => dismissMutation.mutate(request.id)}
          disabled={busy}
          title="Dismiss request (keeps the current time)"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {request.note && <p className="text-xs text-muted-foreground italic">“{request.note}”</p>}

      {request.proposed_times.length > 0 ? (
        <div className="space-y-1.5">
          {request.proposed_times.map((time, index) => (
            <div
              key={`${time.start_at}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50/60 px-2 py-1.5"
            >
              <span className="text-xs">{formatDateTime(time.start_at)} (SAST)</span>
              <Button
                size="sm"
                className="h-7 px-2 bg-purple-600 hover:bg-purple-700"
                onClick={() => handleRebook(time, index)}
                disabled={busy}
              >
                {applyingIndex === index ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Rebook
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No specific times proposed — contact the client to agree on a new time, then reschedule
          from the calendar.
        </p>
      )}
    </div>
  );
}

export function RescheduleRequestsPanel() {
  const { data: requests = [] } = useRescheduleRequests('open');

  if (requests.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 px-4 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
        >
          <BellRing className="h-4 w-4 mr-2" />
          Reschedule requests
          <Badge className="ml-2 bg-amber-600 hover:bg-amber-600">{requests.length}</Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="p-3 border-b flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-medium">Clients asking to reschedule</p>
        </div>
        <div className="max-h-[360px] overflow-auto divide-y">
          {requests.map((request, index) => (
            <div key={request.id}>
              {index > 0 && <Separator />}
              <RequestCard request={request} />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
