/**
 * Newsletter — one newsletter, from draft to sent.
 *
 * Draft or scheduled: the PDF, the editable title/description/audience and
 * the send actions. While sending: live progress and a stop button. Stopped
 * on a provider fault: the reason and a retry. Finished: delivered / failed /
 * read tiles and the per-recipient log.
 */
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Eye,
  FlaskConical,
  Loader2,
  MailCheck,
  MailX,
  RotateCcw,
  Save,
  Send,
  Square,
  Trash2,
  Users,
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
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { newsletterStudioApi } from '../api';
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '../constants';
import {
  useCancelCampaign,
  useDeleteCampaign,
  useResumeCampaign,
  useScheduleCampaign,
  useSendCampaignNow,
  useSendTest,
  useStudioCampaignStats,
  useStudioDashboard,
  useStudioLists,
  useUpdateCampaign,
  useUploadCampaignPdf,
} from '../hooks/useNewsletterStudio';
import type { NewsletterCampaign, NewsletterCaps } from '../types';
import { isCampaignDeletable } from '../utils/campaign';
import { formatDateTime, formatNumber, formatRate, formatRelative } from '../utils/format';
import { schedulerHealth } from '../utils/scheduler';
import { AudiencePicker } from './AudiencePicker';
import { CampaignProgressLine } from './CampaignProgressLine';
import { PdfDropzone } from './PdfDropzone';
import { CampaignStatusBadge } from './StatusBadge';
import { ScheduleDialog, SendNowDialog, TestSendDialog } from './campaign-detail/CampaignDialogs';
import { RecipientsPanel } from './campaign-detail/RecipientsPanel';
import { DetailRow, Notice, SectionHeader, StatTile } from './shared';

const EDITABLE: NewsletterCampaign['status'][] = ['draft', 'scheduled'];
const IN_FLIGHT: NewsletterCampaign['status'][] = ['queued', 'sending'];

/** Opens the PDF in a new tab: the CSP blocks inline frames from storage, and this needs no fetch. */
function openPdf(campaignId: string) {
  const tab = window.open('', '_blank', 'noopener');
  newsletterStudioApi
    .getPdfUrl(campaignId)
    .then(({ url }) => {
      if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener');
    })
    .catch(() => tab?.close());
}

export function NewsletterDetail({
  campaign,
  caps,
  onDeleted,
}: {
  campaign: NewsletterCampaign;
  caps: NewsletterCaps;
  onDeleted: () => void;
}) {
  const editable = EDITABLE.includes(campaign.status);
  const inFlight = IN_FLIGHT.includes(campaign.status);
  const terminal = campaign.status === 'finished' || campaign.status === 'cancelled';

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        {campaign.source === 'routine' && campaign.status === 'draft' ? (
          <Notice tone="warn" icon={Bot} title="Handed over by the monthly routine">
            Check the PDF, the title and the description, then send it or schedule it. Nothing goes
            out until you do.
          </Notice>
        ) : null}

        {campaign.status === 'paused' ? (
          <Notice tone="error" icon={AlertTriangle} title="Delivery stopped">
            <span className="break-words">
              {campaign.lastError ?? 'The email provider rejected the sender.'}
            </span>
          </Notice>
        ) : null}

        {editable ? (
          <DraftEditor campaign={campaign} caps={caps} />
        ) : (
          <SentSummary campaign={campaign} />
        )}

        {campaign.recipientCount > 0 ? <RecipientsPanel campaign={campaign} /> : null}
      </div>

      <div className="space-y-6">
        <ActionsCard campaign={campaign} caps={caps} onDeleted={onDeleted} />
        {inFlight || terminal || campaign.status === 'paused' ? (
          <StatsCard campaign={campaign} />
        ) : null}
      </div>
    </div>
  );
}

// ── Draft editor ─────────────────────────────────────────────────────────────

function DraftEditor({ campaign, caps }: { campaign: NewsletterCampaign; caps: NewsletterCaps }) {
  const [title, setTitle] = useState(campaign.title);
  const [description, setDescription] = useState(campaign.description);
  const [listIds, setListIds] = useState(campaign.listIds);
  useEffect(() => {
    setTitle(campaign.title);
    setDescription(campaign.description);
    setListIds(campaign.listIds);
  }, [campaign.id, campaign.title, campaign.description, campaign.listIds]);

  const lists = useStudioLists();
  const update = useUpdateCampaign();
  const upload = useUploadCampaignPdf();

  const dirty =
    title.trim() !== campaign.title ||
    description.trim() !== campaign.description ||
    listIds.join('|') !== campaign.listIds.join('|');
  const valid =
    title.trim().length > 0 &&
    title.trim().length <= TITLE_MAX_LENGTH &&
    description.trim().length > 0 &&
    description.trim().length <= DESCRIPTION_MAX_LENGTH &&
    listIds.length > 0;

  return (
    <Card className="gap-0">
      <CardHeader className="pb-4">
        <SectionHeader
          icon={Eye}
          title="What goes out"
          description="The PDF is attached to the email and linked behind a “Read the newsletter” button."
        />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Newsletter PDF</Label>
          <PdfDropzone
            stored={campaign.pdf}
            pending={upload.isPending}
            disabled={!caps.create}
            onSelect={(file) => upload.mutate({ id: campaign.id, file })}
            onPreview={campaign.pdf ? () => openPdf(campaign.id) : undefined}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nl-detail-title">Title</Label>
          <Input
            id="nl-detail-title"
            value={title}
            maxLength={TITLE_MAX_LENGTH}
            disabled={!caps.create}
            onChange={(e) => setTitle(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Also the email subject line.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nl-detail-description">Description</Label>
          <Textarea
            id="nl-detail-description"
            value={description}
            maxLength={DESCRIPTION_MAX_LENGTH}
            disabled={!caps.create}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Shown in the email above the “Read the newsletter” button.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Audience</Label>
          <AudiencePicker
            lists={lists.data ?? []}
            loading={lists.isLoading}
            value={listIds}
            onChange={setListIds}
            disabled={!caps.create}
          />
        </div>

        {caps.create ? (
          <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
            {dirty ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setTitle(campaign.title);
                  setDescription(campaign.description);
                  setListIds(campaign.listIds);
                }}
                disabled={update.isPending}
              >
                Discard changes
              </Button>
            ) : null}
            <Button
              onClick={() =>
                update.mutate({
                  id: campaign.id,
                  patch: { title: title.trim(), description: description.trim(), listIds },
                })
              }
              disabled={!dirty || !valid || update.isPending}
            >
              {update.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              Save changes
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── Read-only summary once sending has begun ─────────────────────────────────

function SentSummary({ campaign }: { campaign: NewsletterCampaign }) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <SectionHeader icon={Eye} title="What went out" />
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border/60">
          <DetailRow label="Title">{campaign.title}</DetailRow>
          <DetailRow label="Description">
            <span className="whitespace-pre-line">{campaign.description}</span>
          </DetailRow>
          <DetailRow label="Audience">{campaign.listNames.join(', ') || '—'}</DetailRow>
          <DetailRow label="PDF">
            {campaign.pdf ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-purple-700 underline-offset-2 hover:underline dark:text-purple-300"
                onClick={() => openPdf(campaign.id)}
              >
                {campaign.pdf.fileName} <Eye className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : (
              '—'
            )}
          </DetailRow>
          {campaign.startedAt ? (
            <DetailRow label="Started">{formatDateTime(campaign.startedAt)}</DetailRow>
          ) : null}
          {campaign.completedAt ? (
            <DetailRow label={campaign.status === 'cancelled' ? 'Cancelled' : 'Finished'}>
              {formatDateTime(campaign.completedAt)}
            </DetailRow>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

// ── Actions ──────────────────────────────────────────────────────────────────

function ActionsCard({
  campaign,
  caps,
  onDeleted,
}: {
  campaign: NewsletterCampaign;
  caps: NewsletterCaps;
  onDeleted: () => void;
}) {
  const [testOpen, setTestOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const lists = useStudioLists();
  const dashboard = useStudioDashboard();
  const sendTest = useSendTest();
  const schedule = useScheduleCampaign();
  const sendNow = useSendCampaignNow();
  const resume = useResumeCampaign();
  const cancel = useCancelCampaign();
  const remove = useDeleteCampaign();

  const editable = EDITABLE.includes(campaign.status);
  const inFlight = IN_FLIGHT.includes(campaign.status);
  const hasPdf = Boolean(campaign.pdf);
  const schedulerLive = schedulerHealth(dashboard.data?.processor).level === 'live';

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <SectionHeader icon={Send} title="Send" />
          <CampaignStatusBadge status={campaign.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {campaign.status === 'scheduled' ? (
          <Notice tone="info" icon={CalendarClock} title="Scheduled">
            Sends {formatDateTime(campaign.scheduledAt)}. Edit the details until then, or cancel.
          </Notice>
        ) : null}
        {editable && !hasPdf ? (
          <Notice tone="warn" icon={AlertTriangle} title="Upload the PDF first">
            The newsletter cannot be tested, scheduled or sent until its PDF is uploaded.
          </Notice>
        ) : null}
        {inFlight ? (
          <div className="space-y-2">
            <CampaignProgressLine campaign={campaign} />
            <p className="text-xs text-muted-foreground">
              Delivery runs in the background in small batches. Last progress{' '}
              {formatRelative(campaign.lastProgressAt)}.
            </p>
          </div>
        ) : null}

        {caps.send && editable ? (
          <div className="grid gap-2">
            <Button
              variant="outline"
              onClick={() => setTestOpen(true)}
              disabled={!hasPdf || sendTest.isPending}
            >
              <FlaskConical className="h-4 w-4" aria-hidden /> Send myself a test
            </Button>
            <Button
              variant="outline"
              onClick={() => setScheduleOpen(true)}
              disabled={!hasPdf || schedule.isPending}
            >
              <CalendarClock className="h-4 w-4" aria-hidden />
              {campaign.status === 'scheduled' ? 'Change the time' : 'Schedule…'}
            </Button>
            <Button onClick={() => setSendOpen(true)} disabled={!hasPdf || sendNow.isPending}>
              {sendNow.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              Send now
            </Button>
          </div>
        ) : null}

        {caps.send && campaign.status === 'paused' ? (
          <Button onClick={() => resume.mutate(campaign.id)} disabled={resume.isPending}>
            {resume.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RotateCcw className="h-4 w-4" aria-hidden />
            )}
            Retry delivery
          </Button>
        ) : null}

        {caps.send &&
        (inFlight || campaign.status === 'scheduled' || campaign.status === 'paused') ? (
          <Button
            variant="outline"
            className="w-full text-rose-700 hover:text-rose-800 dark:text-rose-300"
            onClick={() => setCancelOpen(true)}
            disabled={cancel.isPending}
          >
            <Square className="h-4 w-4" aria-hidden />
            {inFlight ? 'Stop sending' : 'Cancel'}
          </Button>
        ) : null}

        {campaign.status === 'finished' ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Delivery finished{' '}
            {formatRelative(campaign.completedAt)}.
          </p>
        ) : null}

        {caps.delete && isCampaignDeletable(campaign) ? (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => setDeleteOpen(true)}
            disabled={remove.isPending}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete newsletter
          </Button>
        ) : null}
      </CardContent>

      <TestSendDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        pending={sendTest.isPending}
        onSend={(emails) => sendTest.mutateAsync({ id: campaign.id, emails })}
      />
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        schedulerLive={schedulerLive}
        pending={schedule.isPending}
        current={campaign.scheduledAt}
        onSchedule={(iso) => schedule.mutateAsync({ id: campaign.id, scheduledAt: iso })}
      />
      <SendNowDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        campaign={campaign}
        lists={lists.data ?? []}
        pending={sendNow.isPending}
        onConfirm={() => {
          sendNow.mutate(campaign.id);
          setSendOpen(false);
        }}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {inFlight ? 'Stop sending?' : 'Cancel this newsletter?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {inFlight
                ? 'Recipients already delivered keep their email; everyone else is skipped. This cannot be resumed.'
                : 'The newsletter will not be sent. You can delete it afterwards.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                cancel.mutate(campaign.id);
                setCancelOpen(false);
              }}
            >
              {inFlight ? 'Stop sending' : 'Cancel newsletter'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{campaign.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the newsletter, its PDF and its delivery history. Emails already
              delivered are unaffected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate(campaign.id, { onSuccess: onDeleted })}
              disabled={remove.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────────

function StatsCard({ campaign }: { campaign: NewsletterCampaign }) {
  const stats = useStudioCampaignStats(campaign.id);
  const sent = stats.data?.sentCount ?? campaign.sentCount;
  const failed = stats.data?.failedCount ?? campaign.failedCount;
  const read = stats.data?.readCount ?? campaign.readCount;
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile icon={MailCheck} label="Delivered" value={formatNumber(sent)} tone="emerald" />
      <StatTile
        icon={MailX}
        label="Failed"
        value={formatNumber(failed)}
        tone={failed > 0 ? 'rose' : 'slate'}
      />
      <StatTile icon={Users} label="Read" value={formatNumber(read)} tone="purple" />
      <StatTile
        icon={Eye}
        label="Read rate"
        value={sent > 0 ? formatRate(read, sent) : '—'}
        tone="purple"
        hint="Recipients who opened the newsletter from the email"
      />
    </div>
  );
}
