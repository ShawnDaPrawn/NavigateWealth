/**
 * Newsletter Studio — lifecycle dialogs: test send, schedule, send-now.
 * Each dialog validates locally and hands a clean payload to its mutation.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, FlaskConical, Loader2, Send, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../../ui/alert-dialog';
import { Button } from '../../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { cn } from '../../../../../ui/utils';
import type { NewsletterCampaign, NewsletterListView } from '../../types';
import {
  formatDateTime,
  formatNumber,
  parseEmailList,
  pluralize,
  toDatetimeLocalValue,
} from '../../utils/format';
import { Notice } from '../shared';

const MAX_TEST_ADDRESSES = 5;

// ── Test send ────────────────────────────────────────────────────────────────

export function TestSendDialog({
  open,
  onOpenChange,
  defaultEmail,
  pending,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
  pending: boolean;
  onSend: (emails: string[]) => Promise<unknown>;
}) {
  const [raw, setRaw] = useState('');
  useEffect(() => {
    if (open) setRaw(defaultEmail ?? '');
  }, [open, defaultEmail]);

  const parsed = useMemo(() => parseEmailList(raw), [raw]);
  const tooMany = parsed.valid.length > MAX_TEST_ADDRESSES;
  const canSend = parsed.valid.length > 0 && parsed.invalid.length === 0 && !tooMany && !pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-purple-600" aria-hidden /> Send a test
          </DialogTitle>
          <DialogDescription>
            Up to {MAX_TEST_ADDRESSES} addresses, separated by commas. The subject is prefixed with
            [TEST] and links keep their real destinations.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="nl-test-emails">Send to</Label>
          <Input
            id="nl-test-emails"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="you@navigatewealth.co, colleague@navigatewealth.co"
            autoFocus
          />
          {parsed.valid.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {parsed.valid.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {email}
                  <button
                    type="button"
                    aria-label={`Remove ${email}`}
                    className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setRaw(
                        parsed.valid
                          .filter((e) => e !== email)
                          .concat(parsed.invalid)
                          .join(', '),
                      )
                    }
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {parsed.invalid.length > 0 ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              Not a valid address: {parsed.invalid.join(', ')}
            </p>
          ) : null}
          {tooMany ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              Please send to at most {MAX_TEST_ADDRESSES} addresses at a time.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await onSend(parsed.valid);
              onOpenChange(false);
            }}
            disabled={!canSend}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Send test{parsed.valid.length > 1 ? ` to ${parsed.valid.length}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Schedule ─────────────────────────────────────────────────────────────────

function nextOccurrence(hour: number, dayOffset: number, weekday?: number): Date {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(0);
  date.setHours(hour);
  if (weekday !== undefined) {
    const delta = (weekday - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + delta);
  } else {
    date.setDate(date.getDate() + dayOffset);
    if (dayOffset === 0 && date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  }
  return date;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  schedulerLive,
  pending,
  onSchedule,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedulerLive: boolean;
  pending: boolean;
  onSchedule: (iso: string) => Promise<unknown>;
  current?: string | null;
}) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (open) setValue(current ? toDatetimeLocalValue(new Date(current)) : '');
  }, [open, current]);

  const chosen = value ? new Date(value) : null;
  const inFuture = Boolean(chosen && chosen.getTime() > Date.now() + 60_000);
  const presets = [
    { label: 'Tomorrow 08:00', date: nextOccurrence(8, 1) },
    { label: 'Monday 08:00', date: nextOccurrence(8, 0, 1) },
    { label: 'Friday 16:00', date: nextOccurrence(16, 0, 5) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-purple-600" aria-hidden /> Schedule delivery
          </DialogTitle>
          <DialogDescription>
            The audience is resolved at send time, so late sign-ups are included and opt-outs are
            respected. Times are in your local time zone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setValue(toDatetimeLocalValue(preset.date))}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  value === toDatetimeLocalValue(preset.date)
                    ? 'border-purple-600 bg-purple-600 text-white'
                    : 'border-border hover:border-purple-300',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nl-schedule-at">Send at</Label>
            <Input
              id="nl-schedule-at"
              type="datetime-local"
              value={value}
              min={toDatetimeLocalValue(new Date())}
              onChange={(e) => setValue(e.target.value)}
            />
            {chosen && !inFuture ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Choose a time at least a minute from now.
              </p>
            ) : chosen ? (
              <p className="text-xs text-muted-foreground">
                Sends {formatDateTime(chosen.toISOString())}.
              </p>
            ) : null}
          </div>
          {!schedulerLive ? (
            <Notice tone="warn" icon={AlertTriangle} title="Scheduled sends need the delivery job">
              The background job has not checked in, so this send will only start while an admin has
              the studio open. Ask an operator to install it for unattended delivery.
            </Notice>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!chosen) return;
              await onSchedule(chosen.toISOString());
              onOpenChange(false);
            }}
            disabled={!inFuture || pending}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Send now (pre-flight) ────────────────────────────────────────────────────

export function SendNowDialog({
  open,
  onOpenChange,
  campaign,
  lists,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: NewsletterCampaign;
  lists: NewsletterListView[];
  pending: boolean;
  onConfirm: () => void;
}) {
  const reach = lists
    .filter((list) => campaign.listIds.includes(list.id))
    .reduce((sum, list) => sum + list.memberCount, 0);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-purple-600" aria-hidden /> Send this campaign now?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Delivery starts in the background and cannot be edited once it begins. You can pause
                or cancel it while it runs.
              </p>
              <dl className="divide-y divide-border/60 rounded-xl border border-border/60 text-foreground">
                <PreflightRow label="Subject">{campaign.subject}</PreflightRow>
                <PreflightRow label="From">{campaign.fromName}</PreflightRow>
                <PreflightRow label="Audience">{campaign.listNames.join(', ') || '—'}</PreflightRow>
                <PreflightRow label="Estimated recipients">
                  ≈ {formatNumber(reach)} before de-duplication and opt-outs
                </PreflightRow>
              </dl>
              <p className="text-xs">
                Opted-out addresses are excluded automatically and every email carries a personal
                unsubscribe link.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not yet</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Send to {pluralize(reach, 'recipient')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PreflightRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <dt className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}
