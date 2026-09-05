/**
 * Newsletter Studio — campaign drill-down.
 *
 * The lifecycle hub: one obvious next action for the campaign's current
 * state, a status banner that explains what is happening, live delivery
 * progress while the processor works, the content as recipients will see it,
 * and the per-recipient log.
 */
import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FlaskConical,
  Info,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
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
} from '../../../../ui/alert-dialog';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader } from '../../../../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { Skeleton } from '../../../../ui/skeleton';
import { useAuth } from '../../../../auth/AuthContext';
import { NEWSLETTER_FROM_EMAIL, NEWSLETTER_REPLY_TO_EMAIL } from '../constants';
import {
  useCancelCampaign,
  useDeleteCampaign,
  useDuplicateCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useRunProcessorNow,
  useScheduleCampaign,
  useSendCampaignNow,
  useSendTest,
  useStudioCampaign,
  useStudioCampaignStats,
  useStudioDashboard,
  useStudioLists,
} from '../hooks/useNewsletterStudio';
import type { NewsletterCampaign, NewsletterCaps } from '../types';
import { formatDateTime, formatNumber, formatRelative, pluralize } from '../utils/format';
import { schedulerHealth } from '../utils/scheduler';
import { isCampaignDeletable } from '../utils/campaign';
import { EmailPreview } from './EmailPreview';
import { CampaignStatusBadge } from './StatusBadge';
import { DeliveryPanel, LinkPerformance } from './campaign-detail/DeliveryPanel';
import { RecipientsPanel } from './campaign-detail/RecipientsPanel';
import { ScheduleDialog, SendNowDialog, TestSendDialog } from './campaign-detail/CampaignDialogs';
import { DetailRow, ErrorState, Notice, SectionHeader } from './shared';

interface CampaignDetailProps {
  campaignId: string;
  caps: NewsletterCaps;
  onBack: () => void;
  onEdit: (campaign: NewsletterCampaign) => void;
  onOpenCampaign: (campaignId: string) => void;
  onDeleted: () => void;
}

const EDITABLE: NewsletterCampaign['status'][] = ['draft', 'scheduled'];
const CANCELLABLE: NewsletterCampaign['status'][] = ['scheduled', 'queued', 'sending', 'paused'];

export function CampaignDetail({
  campaignId,
  caps,
  onBack,
  onEdit,
  onOpenCampaign,
  onDeleted,
}: CampaignDetailProps) {
  const {
    data: campaign,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useStudioCampaign(campaignId);
  const { data: dashboard } = useStudioDashboard();
  const { data: lists = [] } = useStudioLists();
  const { user } = useAuth();
  const scheduler = schedulerHealth(dashboard?.processor);

  const hasDelivery = Boolean(campaign && campaign.recipientCount > 0);
  const { data: stats } = useStudioCampaignStats(campaignId, hasDelivery);

  const sendTest = useSendTest();
  const schedule = useScheduleCampaign();
  const sendNow = useSendCampaignNow();
  const pause = usePauseCampaign();
  const resume = useResumeCampaign();
  const cancel = useCancelCampaign();
  const duplicate = useDuplicateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const runNow = useRunProcessorNow();

  const [testOpen, setTestOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sendNowOpen, setSendNowOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <DetailSkeleton />;
  if (isError && !campaign) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to campaigns
        </Button>
        <ErrorState
          title="This campaign could not be loaded"
          description={
            error instanceof Error ? error.message : 'It may have been deleted by someone else.'
          }
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      </div>
    );
  }
  if (!campaign) return <DetailSkeleton />;

  const status = campaign.status;
  const editable = EDITABLE.includes(status);
  const isActive = status === 'queued' || status === 'sending';
  const canDelete = caps.delete && isCampaignDeletable(campaign);
  const busy =
    pause.isPending ||
    resume.isPending ||
    cancel.isPending ||
    sendNow.isPending ||
    runNow.isPending;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="mt-0.5 shrink-0">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Campaigns
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight">{campaign.name}</h2>
              <CampaignStatusBadge status={status} />
              {campaign.stuck ? (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> stalled
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{campaign.subject}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              To {campaign.listNames.join(', ') || '—'} · created{' '}
              {formatRelative(campaign.createdAt)}
              {campaign.completedAt ? ` · completed ${formatRelative(campaign.completedAt)}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable && caps.send ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
                <FlaskConical className="h-4 w-4" aria-hidden /> Send test
              </Button>
              <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
                <CalendarClock className="h-4 w-4" aria-hidden />
                {status === 'scheduled' ? 'Reschedule' : 'Schedule'}
              </Button>
              <Button size="sm" onClick={() => setSendNowOpen(true)} disabled={busy}>
                {sendNow.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
                Send now
              </Button>
            </>
          ) : null}
          {editable && !caps.send && caps.create ? (
            <Button variant="outline" size="sm" onClick={() => onEdit(campaign)}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </Button>
          ) : null}
          {isActive && caps.send ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => pause.mutate(campaign.id)}
              disabled={busy}
            >
              {pause.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Pause className="h-4 w-4" aria-hidden />
              )}
              Pause
            </Button>
          ) : null}
          {status === 'paused' && caps.send ? (
            <Button size="sm" onClick={() => resume.mutate(campaign.id)} disabled={busy}>
              {resume.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              Resume delivery
            </Button>
          ) : null}
          {(status === 'finished' || status === 'cancelled') && caps.create ? (
            <Button
              size="sm"
              onClick={() =>
                duplicate.mutate(campaign.id, { onSuccess: (copy) => onOpenCampaign(copy.id) })
              }
              disabled={duplicate.isPending}
            >
              {duplicate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              Duplicate
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {editable && caps.create ? (
                <DropdownMenuItem onSelect={() => onEdit(campaign)}>
                  <Pencil className="h-4 w-4" aria-hidden /> Edit content
                </DropdownMenuItem>
              ) : null}
              {caps.create && !(status === 'finished' || status === 'cancelled') ? (
                <DropdownMenuItem
                  disabled={duplicate.isPending}
                  onSelect={() =>
                    duplicate.mutate(campaign.id, { onSuccess: (copy) => onOpenCampaign(copy.id) })
                  }
                >
                  <Copy className="h-4 w-4" aria-hidden /> Duplicate
                </DropdownMenuItem>
              ) : null}
              {caps.send && (isActive || status === 'paused') ? (
                <DropdownMenuItem disabled={runNow.isPending} onSelect={() => runNow.mutate()}>
                  <RefreshCw className="h-4 w-4" aria-hidden /> Run a delivery pass
                </DropdownMenuItem>
              ) : null}
              {CANCELLABLE.includes(status) && caps.send ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setCancelOpen(true)}>
                    <Ban className="h-4 w-4" aria-hidden />
                    {status === 'scheduled' ? 'Cancel schedule' : 'Cancel campaign'}
                  </DropdownMenuItem>
                </>
              ) : null}
              {canDelete ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4" aria-hidden /> Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <StatusBanner
        campaign={campaign}
        schedulerLive={scheduler.level === 'live'}
        canSend={caps.send}
        onRunNow={() => runNow.mutate()}
        runningNow={runNow.isPending}
        onEdit={() => onEdit(campaign)}
        canEdit={caps.create}
        onSendTest={() => setTestOpen(true)}
      />

      {hasDelivery ? <DeliveryPanel campaign={campaign} stats={stats} /> : null}
      {stats && stats.links.length > 0 && campaign.sentCount > 0 ? (
        <LinkPerformance stats={stats} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="gap-0">
          <CardHeader className="pb-4">
            <SectionHeader
              icon={Eye}
              title="Email"
              description="Exactly what recipients see, with sample merge values"
              action={
                editable && caps.create ? (
                  <Button variant="outline" size="sm" onClick={() => onEdit(campaign)}>
                    <Pencil className="h-4 w-4" aria-hidden /> Edit
                  </Button>
                ) : null
              }
            />
          </CardHeader>
          <CardContent>
            <EmailPreview
              allowDeviceToggle
              bodyHtml={campaign.bodyHtml}
              subject={campaign.subject}
              preheader={campaign.preheader}
              fromName={campaign.fromName}
            />
          </CardContent>
        </Card>

        <Card className="gap-0 self-start">
          <CardHeader className="pb-2">
            <SectionHeader icon={Info} title="Details" />
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border/60">
              <DetailRow label="From">
                {campaign.fromName}
                <span className="block text-xs font-normal text-muted-foreground">
                  {NEWSLETTER_FROM_EMAIL}
                </span>
              </DetailRow>
              <DetailRow label="Reply-to">{NEWSLETTER_REPLY_TO_EMAIL}</DetailRow>
              <DetailRow label="Audience">
                <span className="block max-w-48 truncate" title={campaign.listNames.join(', ')}>
                  {campaign.listNames.join(', ') || '—'}
                </span>
              </DetailRow>
              <DetailRow label="Click tracking">{campaign.trackClicks ? 'On' : 'Off'}</DetailRow>
              <DetailRow label="Tracked links">{formatNumber(campaign.links.length)}</DetailRow>
              {campaign.scheduledAt && status === 'scheduled' ? (
                <DetailRow label="Scheduled for">{formatDateTime(campaign.scheduledAt)}</DetailRow>
              ) : null}
              {campaign.startedAt ? (
                <DetailRow label="Started">{formatDateTime(campaign.startedAt)}</DetailRow>
              ) : null}
              {campaign.completedAt ? (
                <DetailRow label="Completed">{formatDateTime(campaign.completedAt)}</DetailRow>
              ) : null}
              <DetailRow label="Last updated">{formatDateTime(campaign.updatedAt)}</DetailRow>
            </dl>
          </CardContent>
        </Card>
      </div>

      {hasDelivery ? <RecipientsPanel campaign={campaign} stats={stats} /> : null}

      {/* Dialogs */}
      <TestSendDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        defaultEmail={user?.email}
        pending={sendTest.isPending}
        onSend={(emails) => sendTest.mutateAsync({ id: campaign.id, emails })}
      />
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        schedulerLive={scheduler.level === 'live'}
        pending={schedule.isPending}
        current={campaign.scheduledAt}
        onSchedule={(iso) => schedule.mutateAsync({ id: campaign.id, scheduledAt: iso })}
      />
      <SendNowDialog
        open={sendNowOpen}
        onOpenChange={setSendNowOpen}
        campaign={campaign}
        lists={lists}
        pending={sendNow.isPending}
        onConfirm={() => {
          setSendNowOpen(false);
          sendNow.mutate(campaign.id);
        }}
      />
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {status === 'scheduled' ? 'Cancel the scheduled send?' : 'Cancel this campaign?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {status === 'scheduled'
                ? 'The campaign returns to a cancelled state and will not send. You can duplicate it later.'
                : 'Remaining recipients will not receive it. Emails already delivered are unaffected.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => cancel.mutate(campaign.id)}
            >
              {status === 'scheduled' ? 'Cancel send' : 'Cancel campaign'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{campaign.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The campaign and its delivery records are removed permanently. Emails already
              delivered are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={async () => {
                await deleteCampaign.mutateAsync(campaign.id);
                onDeleted();
              }}
            >
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Status banner ────────────────────────────────────────────────────────────

function StatusBanner({
  campaign,
  schedulerLive,
  canSend,
  canEdit,
  onRunNow,
  runningNow,
  onEdit,
  onSendTest,
}: {
  campaign: NewsletterCampaign;
  schedulerLive: boolean;
  canSend: boolean;
  canEdit: boolean;
  onRunNow: () => void;
  runningNow: boolean;
  onEdit: () => void;
  onSendTest: () => void;
}) {
  const runNowButton = canSend ? (
    <Button variant="outline" size="sm" onClick={onRunNow} disabled={runningNow}>
      {runningNow ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="h-4 w-4" aria-hidden />
      )}
      Run a delivery pass
    </Button>
  ) : null;

  switch (campaign.status) {
    case 'draft':
      return (
        <Notice
          tone="info"
          icon={Info}
          title="Draft — nothing has been sent"
          action={
            <div className="flex gap-2">
              {canSend ? (
                <Button variant="outline" size="sm" onClick={onSendTest}>
                  <FlaskConical className="h-4 w-4" aria-hidden /> Send yourself a test
                </Button>
              ) : null}
              {canEdit ? (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Pencil className="h-4 w-4" aria-hidden /> Edit
                </Button>
              ) : null}
            </div>
          }
        >
          Review the preview below, send a test to your own inbox, then send now or schedule it.
        </Notice>
      );
    case 'scheduled':
      return (
        <Notice
          tone={schedulerLive ? 'info' : 'warn'}
          icon={schedulerLive ? CalendarClock : AlertTriangle}
          title={`Scheduled for ${formatDateTime(campaign.scheduledAt)} (${formatRelative(campaign.scheduledAt)})`}
        >
          {schedulerLive
            ? 'The audience is resolved at send time, so late sign-ups are included and opt-outs are respected. You can still edit the content until then.'
            : 'The background delivery job has not checked in, so this send will only start while an admin has the studio open.'}
        </Notice>
      );
    case 'queued':
    case 'sending':
      return (
        <Notice
          tone={campaign.stuck ? 'warn' : 'progress'}
          icon={campaign.stuck ? AlertTriangle : Clock}
          title={
            campaign.stuck
              ? 'Delivery looks stalled'
              : `Delivering — ${formatNumber(campaign.sentCount)} of ${formatNumber(campaign.recipientCount)} sent`
          }
          action={campaign.stuck ? runNowButton : null}
        >
          {campaign.stuck
            ? `No progress since ${formatRelative(campaign.lastProgressAt)}. A delivery pass will pick it up; you can also trigger one now.`
            : `Sending in batches of 20 every few seconds. ${pluralize(campaign.pendingCount, 'recipient')} still to go.`}
        </Notice>
      );
    case 'paused':
      return (
        <Notice tone="warn" icon={Pause} title="Delivery is paused" action={runNowButton}>
          {campaign.lastError ? (
            <span className="break-words">{campaign.lastError}</span>
          ) : (
            `Paused with ${pluralize(campaign.pendingCount, 'recipient')} remaining. Resume to continue where it left off.`
          )}
        </Notice>
      );
    case 'finished':
      return (
        <Notice
          tone={campaign.failedCount > 0 ? 'warn' : 'success'}
          icon={campaign.failedCount > 0 ? AlertTriangle : CheckCircle2}
          title={
            campaign.recipientCount === 0
              ? 'Finished — nobody was eligible to receive it'
              : `Sent to ${formatNumber(campaign.sentCount)} of ${formatNumber(campaign.recipientCount)} recipients`
          }
        >
          {campaign.recipientCount === 0
            ? campaign.lastError || 'The selected lists had no eligible recipients.'
            : campaign.failedCount > 0
              ? `${pluralize(campaign.failedCount, 'address', 'addresses')} failed permanently — see the recipient log below. Completed ${formatRelative(campaign.completedAt)}.`
              : `Every recipient was delivered. Completed ${formatRelative(campaign.completedAt)}.`}
        </Notice>
      );
    case 'cancelled':
      return (
        <Notice tone="error" icon={XCircle} title="Cancelled">
          {campaign.sentCount > 0
            ? `${formatNumber(campaign.sentCount)} emails had already been delivered before it was cancelled. Duplicate it to send again.`
            : 'Stopped before anything was sent. Duplicate it to start again.'}
        </Notice>
      );
    default:
      return null;
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-5" data-testid="campaign-detail-skeleton">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}
