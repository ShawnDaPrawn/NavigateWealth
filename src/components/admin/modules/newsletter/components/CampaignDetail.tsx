/**
 * Newsletter Studio — campaign drill-down.
 *
 * The lifecycle hub: test sends, scheduling, send-now, pause/resume/cancel,
 * live delivery progress while the processor works, and engagement stats
 * (click-derived opens, per-link clicks) once delivery is underway.
 */
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  Copy,
  FlaskConical,
  Loader2,
  Pause,
  Pencil,
  Play,
  Send,
  Trash2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../../../ui/alert-dialog';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Progress } from '../../../../ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  useCancelCampaign,
  useStudioDashboard,
  useDeleteCampaign,
  useDuplicateCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useScheduleCampaign,
  useSendCampaignNow,
  useSendTest,
  useStudioCampaign,
  useStudioCampaignStats,
  useStudioRecipients,
} from '../hooks/useNewsletterStudio';
import { CampaignStatusBadge, DeliveryStatusBadge } from './StatusBadge';
import type { NewsletterCaps } from './CampaignsTab';
import type { NewsletterCampaign } from '../types';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

interface CampaignDetailProps {
  campaignId: string;
  caps: NewsletterCaps;
  onBack: () => void;
  onEdit: (campaign: NewsletterCampaign) => void;
  onDeleted: () => void;
}

export function CampaignDetail({
  campaignId,
  caps,
  onBack,
  onEdit,
  onDeleted,
}: CampaignDetailProps) {
  const { data: campaign } = useStudioCampaign(campaignId);
  const { data: dashboard } = useStudioDashboard();
  // Null means the pg_cron job has never run: scheduling then only advances
  // while an admin has the studio open. Say so before they rely on it.
  const cronInstalled = Boolean(dashboard?.processor?.lastCronRunAt);
  const isActive = campaign?.status === 'queued' || campaign?.status === 'sending';
  const hasDelivery = Boolean(campaign && campaign.recipientCount > 0);
  const { data: stats } = useStudioCampaignStats(campaignId, hasDelivery);

  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientStatus, setRecipientStatus] = useState('all');
  const recipientsQuery = useStudioRecipients(hasDelivery ? campaignId : null, {
    page: recipientPage,
    status: recipientStatus,
  });

  const sendTest = useSendTest();
  const schedule = useScheduleCampaign();
  const sendNow = useSendCampaignNow();
  const pause = usePauseCampaign();
  const resume = useResumeCampaign();
  const cancel = useCancelCampaign();
  const duplicate = useDuplicateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const [testOpen, setTestOpen] = useState(false);
  const [testEmails, setTestEmails] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');

  const editable = campaign?.status === 'draft' || campaign?.status === 'scheduled';
  const deletable = campaign && ['draft', 'finished', 'cancelled'].includes(campaign.status);

  const recipientTotalPages = useMemo(() => {
    const total = recipientsQuery.data?.total ?? 0;
    const limit = recipientsQuery.data?.limit ?? 50;
    return Math.max(1, Math.ceil(total / limit));
  }, [recipientsQuery.data]);

  if (!campaign) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading campaign…</p>;
  }

  const handleTestSend = async () => {
    const emails = testEmails
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (emails.length === 0) return;
    await sendTest.mutateAsync({ id: campaign.id, emails });
    setTestOpen(false);
  };

  const handleSchedule = async () => {
    if (!scheduleAt) return;
    await schedule.mutateAsync({
      id: campaign.id,
      scheduledAt: new Date(scheduleAt).toISOString(),
    });
    setScheduleOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Back
          </Button>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold">{campaign.name}</h3>
            <p className="truncate text-sm text-muted-foreground">{campaign.subject}</p>
          </div>
          <CampaignStatusBadge status={campaign.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <>
              {caps.create ? (
                <Button variant="outline" size="sm" onClick={() => onEdit(campaign)}>
                  <Pencil className="mr-1 h-4 w-4" aria-hidden /> Edit
                </Button>
              ) : null}
              {caps.send ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
                    <FlaskConical className="mr-1 h-4 w-4" aria-hidden /> Send test
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
                    <CalendarClock className="mr-1 h-4 w-4" aria-hidden /> Schedule
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" disabled={sendNow.isPending}>
                        {sendNow.isPending ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Send className="mr-1 h-4 w-4" aria-hidden />
                        )}
                        Send now
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Send this campaign now?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{campaign.subject}" will be queued for delivery to{' '}
                          {campaign.listNames.join(', ')}. Opted-out subscribers are excluded
                          automatically. This cannot be edited once delivery starts.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Not yet</AlertDialogCancel>
                        <AlertDialogAction onClick={() => sendNow.mutate(campaign.id)}>
                          Queue delivery
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : null}
            </>
          ) : null}

          {isActive && caps.send ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => pause.mutate(campaign.id)}
              disabled={pause.isPending}
            >
              <Pause className="mr-1 h-4 w-4" aria-hidden /> Pause
            </Button>
          ) : null}
          {campaign.status === 'paused' && caps.send ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resume.mutate(campaign.id)}
              disabled={resume.isPending}
            >
              <Play className="mr-1 h-4 w-4" aria-hidden /> Resume
            </Button>
          ) : null}
          {['scheduled', 'queued', 'sending', 'paused'].includes(campaign.status) && caps.send ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Ban className="mr-1 h-4 w-4" aria-hidden /> Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this campaign?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remaining recipients will not receive it. Already-delivered emails are
                    unaffected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cancel.mutate(campaign.id)}>
                    Cancel campaign
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}

          {caps.create ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => duplicate.mutate(campaign.id)}
              disabled={duplicate.isPending}
            >
              <Copy className="mr-1 h-4 w-4" aria-hidden /> Duplicate
            </Button>
          ) : null}
          {deletable && caps.delete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="mr-1 h-4 w-4" aria-hidden /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{campaign.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The campaign and its delivery records are removed permanently.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await deleteCampaign.mutateAsync(campaign.id);
                      onDeleted();
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      {campaign.status === 'scheduled' ? (
        <p className="text-sm text-muted-foreground">
          Scheduled for <span className="font-medium">{formatDateTime(campaign.scheduledAt)}</span>.
        </p>
      ) : null}
      {campaign.lastError && campaign.status !== 'finished' ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{campaign.lastError}</p>
      ) : null}

      {hasDelivery ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Progress value={campaign.progressPercent} className="h-2 flex-1" />
              <span className="text-sm tabular-nums text-muted-foreground">
                {campaign.progressPercent}%
              </span>
            </div>
            <div className="grid gap-3 text-center sm:grid-cols-4">
              <div>
                <p className="text-xl font-semibold tabular-nums">{campaign.recipientCount}</p>
                <p className="text-xs text-muted-foreground">Recipients</p>
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums">{campaign.sentCount}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums">{campaign.pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums">{campaign.failedCount}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
            {stats ? (
              <div className="grid gap-3 border-t pt-3 text-center sm:grid-cols-3">
                <div>
                  <p className="text-xl font-semibold tabular-nums">{stats.openCount}</p>
                  <p className="text-xs text-muted-foreground">Opens ({stats.openRate}%)</p>
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums">{stats.clickCount}</p>
                  <p className="text-xs text-muted-foreground">
                    Clicks ({stats.clickRate}% of delivered)
                  </p>
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums">
                    {stats.clickedRecipientCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Unique clickers</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {stats && stats.links.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Link performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destination</TableHead>
                    <TableHead className="w-24 text-right">Clicks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.links.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="max-w-md truncate font-mono text-xs">
                        {link.url}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{link.clickCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasDelivery ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recipients</CardTitle>
            <Select
              value={recipientStatus}
              onValueChange={(value) => {
                setRecipientStatus(value);
                setRecipientPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Delivered</SelectItem>
                <SelectItem value="failed_retryable">Retrying</SelectItem>
                <SelectItem value="failed_terminal">Failed</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>Engaged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recipientsQuery.data?.recipients ?? []).map((recipient) => (
                    <TableRow key={recipient.token}>
                      <TableCell>
                        <span className="block max-w-56 truncate text-sm">{recipient.email}</span>
                        {recipient.deliveryError ? (
                          <span className="block max-w-56 truncate text-xs text-rose-600 dark:text-rose-400">
                            {recipient.deliveryError}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <DeliveryStatusBadge status={recipient.deliveryStatus} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(recipient.sentAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {recipient.clicks.length > 0
                          ? `${recipient.clicks.length} click(s)`
                          : recipient.openedAt
                            ? 'opened'
                            : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {recipientPage} of {recipientTotalPages} · {recipientsQuery.data?.total ?? 0}{' '}
                recipient(s)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={recipientPage <= 1}
                  onClick={() => setRecipientPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={recipientPage >= recipientTotalPages}
                  onClick={() => setRecipientPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a test</DialogTitle>
            <DialogDescription>
              Up to 5 addresses, separated by commas. Subject is prefixed with [TEST]; links keep
              their real destinations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="nl-test-emails">Test addresses</Label>
            <Input
              id="nl-test-emails"
              value={testEmails}
              onChange={(e) => setTestEmails(e.target.value)}
              placeholder="you@directfp.co.za, colleague@navigatewealth.co"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              Close
            </Button>
            <Button onClick={handleTestSend} disabled={sendTest.isPending || !testEmails.trim()}>
              {sendTest.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule delivery</DialogTitle>
            <DialogDescription>
              The audience is resolved at send time, so late sign-ups are included and opt-outs
              respected.
            </DialogDescription>
          </DialogHeader>
          {!cronInstalled ? (
            <p className="rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
              The scheduled delivery job has not checked in yet, so a scheduled send will only start
              while an admin has the Newsletter Studio open. Ask an operator to install it
              (supabase/cron/newsletter-studio-jobs.sql) for unattended sending.
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="nl-schedule-at">Send at</Label>
            <Input
              id="nl-schedule-at"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Close
            </Button>
            <Button onClick={handleSchedule} disabled={schedule.isPending || !scheduleAt}>
              {schedule.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
