/**
 * Appointment Manage Page
 * Standalone public page for clients to view, reschedule, or cancel an
 * appointment. Access via unique token link sent in appointment emails:
 * /appointment?token=... (&action=cancel deep-links the cancel dialog)
 *
 * Flow: loading → view → reschedule form → request sent
 *       loading → view → cancel confirm → cancelled
 *       loading → invalid (unknown/expired token)
 */

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  AlertCircle,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Video,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  appointmentManageService,
  type PublicAppointment,
  type ProposedTime,
} from './services/appointmentManageService';

type PageStep =
  | 'loading'
  | 'invalid'
  | 'view'
  | 'reschedule'
  | 'reschedule_done'
  | 'cancel'
  | 'cancel_done';

const SAST_TZ = 'Africa/Johannesburg';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: SAST_TZ,
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SAST_TZ,
  });
}

/** datetime-local value (browser-local) → ISO string */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function MeetingKindLine({ appointment }: { appointment: PublicAppointment }) {
  if (appointment.meeting_kind === 'virtual') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Video className="h-4 w-4 shrink-0" />
        <span>Online meeting{appointment.join_url ? '' : ' — link to follow'}</span>
      </div>
    );
  }
  if (appointment.meeting_kind === 'in_person') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 shrink-0" />
        <span>{appointment.location || 'Our offices'}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Phone className="h-4 w-4 shrink-0" />
      <span>Phone call — we will call you at the scheduled time</span>
    </div>
  );
}

export function ManageAppointmentPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const deepLinkCancel = searchParams.get('action') === 'cancel';

  const [step, setStep] = useState<PageStep>('loading');
  const [appointment, setAppointment] = useState<PublicAppointment | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reschedule form: up to 3 proposed start times; end = start + original duration
  const [proposedStarts, setProposedStarts] = useState<string[]>(['']);
  const [note, setNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    if (!token) {
      setStep('invalid');
      return;
    }
    const result = await appointmentManageService.getAppointment(token);
    if (!result.success || !result.data) {
      setErrorMessage(result.error || null);
      setStep('invalid');
      return;
    }
    setAppointment(result.data);
    setStep(deepLinkCancel && result.data.status !== 'cancelled' ? 'cancel' : 'view');
  }, [token, deepLinkCancel]);

  useEffect(() => {
    void load();
  }, [load]);

  const durationMs = appointment
    ? new Date(appointment.end_at).getTime() - new Date(appointment.start_at).getTime()
    : 60 * 60 * 1000;

  const handleSubmitReschedule = async () => {
    if (!token) return;
    setErrorMessage(null);

    const proposedTimes: ProposedTime[] = [];
    for (const start of proposedStarts) {
      const startIso = localInputToIso(start);
      if (!startIso) continue;
      if (new Date(startIso).getTime() <= Date.now()) {
        setErrorMessage('Proposed times must be in the future.');
        return;
      }
      proposedTimes.push({
        start_at: startIso,
        end_at: new Date(new Date(startIso).getTime() + durationMs).toISOString(),
      });
    }

    setSubmitting(true);
    const result = await appointmentManageService.requestReschedule(
      token,
      proposedTimes,
      note.trim() || undefined,
    );
    setSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Failed to submit the request. Please try again.');
      return;
    }
    setStep('reschedule_done');
  };

  const handleConfirmCancel = async () => {
    if (!token) return;
    setErrorMessage(null);
    setSubmitting(true);
    const result = await appointmentManageService.cancel(token, cancelReason.trim() || undefined);
    setSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Failed to cancel. Please try again.');
      return;
    }
    setStep('cancel_done');
  };

  const renderDetailsCard = () =>
    appointment && (
      <div className="rounded-lg bg-muted p-4 space-y-2">
        <h3 className="font-semibold text-foreground">{appointment.title}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span>{formatDate(appointment.start_at)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            {formatTime(appointment.start_at)} – {formatTime(appointment.end_at)} (SAST)
          </span>
        </div>
        <MeetingKindLine appointment={appointment} />
        {appointment.description && (
          <p className="text-sm text-muted-foreground pt-1">{appointment.description}</p>
        )}
      </div>
    );

  const renderBody = () => {
    switch (step) {
      case 'loading':
        return (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your appointment…</p>
          </div>
        );

      case 'invalid':
        return (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold">This link is invalid or has expired</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {errorMessage ||
                'Please use the link from your most recent appointment email, or contact us if you need help.'}
            </p>
          </div>
        );

      case 'view': {
        if (!appointment) return null;
        const cancelled = appointment.status === 'cancelled';
        const requestPending =
          appointment.status === 'reschedule_requested' || appointment.has_open_reschedule_request;

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Appointment with {appointment.advisor_name}
              </p>
              {cancelled ? (
                <Badge variant="destructive">Cancelled</Badge>
              ) : requestPending ? (
                <Badge variant="secondary">Reschedule requested</Badge>
              ) : (
                <Badge>Confirmed</Badge>
              )}
            </div>

            {renderDetailsCard()}

            {cancelled ? (
              <p className="text-sm text-muted-foreground">
                This appointment has been cancelled. If you would like to book a new one, please
                contact us.
              </p>
            ) : requestPending ? (
              <p className="text-sm text-muted-foreground">
                Your reschedule request has been received — your advisor will confirm a new time
                shortly.
              </p>
            ) : (
              <>
                {appointment.meeting_kind === 'virtual' && appointment.join_url && (
                  <Button className="w-full" asChild>
                    <a href={appointment.join_url} target="_blank" rel="noopener noreferrer">
                      <Video className="h-4 w-4 mr-2" />
                      Join meeting
                    </a>
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => setStep('reschedule')}>
                    <CalendarClock className="h-4 w-4 mr-2" />
                    Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setStep('cancel')}
                  >
                    <CalendarX2 className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        );
      }

      case 'reschedule':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">Propose new times</h2>
              <p className="text-sm text-muted-foreground">
                Suggest up to 3 times that suit you — your advisor will confirm one and you will
                receive a new confirmation email.
              </p>
            </div>

            {renderDetailsCard()}

            <div className="space-y-3">
              {proposedStarts.map((value, index) => (
                <div key={index} className="space-y-1">
                  <Label htmlFor={`proposed-${index}`}>Option {index + 1}</Label>
                  <Input
                    id={`proposed-${index}`}
                    type="datetime-local"
                    value={value}
                    onChange={(e) => {
                      const next = [...proposedStarts];
                      next[index] = e.target.value;
                      setProposedStarts(next);
                    }}
                  />
                </div>
              ))}
              {proposedStarts.length < 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setProposedStarts([...proposedStarts, ''])}
                >
                  + Add another option
                </Button>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="reschedule-note">Note (optional)</Label>
              <Textarea
                id="reschedule-note"
                placeholder="Anything your advisor should know?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
              />
            </div>

            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setStep('view')} disabled={submitting}>
                Back
              </Button>
              <Button onClick={handleSubmitReschedule} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send request
              </Button>
            </div>
          </div>
        );

      case 'reschedule_done':
        return (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <h2 className="text-lg font-semibold">Request sent</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your advisor has been notified and will confirm a new time. Your current appointment
              stands until then — you will receive a new confirmation email once it is rebooked.
            </p>
          </div>
        );

      case 'cancel':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">Cancel this appointment?</h2>
              <p className="text-sm text-muted-foreground">
                This cannot be undone. If you would rather move it, use Reschedule instead.
              </p>
            </div>

            {renderDetailsCard()}

            <div className="space-y-1">
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Let your advisor know why you're cancelling"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                maxLength={2000}
              />
            </div>

            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setStep('view')} disabled={submitting}>
                Keep appointment
              </Button>
              <Button variant="destructive" onClick={handleConfirmCancel} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Cancel appointment
              </Button>
            </div>
          </div>
        );

      case 'cancel_done':
        return (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <h2 className="text-lg font-semibold">Appointment cancelled</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your advisor has been notified and all reminder emails have been stopped. If you would
              like to book a new appointment, please contact us.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-6 space-y-4">
        <div className="text-center border-b pb-4">
          <h1 className="text-xl font-bold">Navigate Wealth</h1>
          <p className="text-sm text-muted-foreground">Manage your appointment</p>
        </div>
        {renderBody()}
      </Card>
    </div>
  );
}

export default ManageAppointmentPage;
