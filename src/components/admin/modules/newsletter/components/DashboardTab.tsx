/**
 * Newsletter Studio — dashboard: the listmonk-style overview.
 * KPIs, delivery totals, processor health, and the latest campaigns.
 */
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Mail,
  MousePointerClick,
  Send,
  Users,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Progress } from '../../../../ui/progress';
import { useStudioDashboard } from '../hooks/useNewsletterStudio';
import { CampaignStatusBadge } from './StatusBadge';
import type { NewsletterCampaign } from '../types';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-ZA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function minutesAgo(value: string | null): string {
  if (!value) return 'never';
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes <= 0) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Mail;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function DashboardTab({
  canCreate,
  onOpenCampaign,
  onNewCampaign,
}: {
  canCreate: boolean;
  onOpenCampaign: (campaign: NewsletterCampaign) => void;
  onNewCampaign: () => void;
}) {
  const { data, isLoading } = useStudioDashboard();

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading dashboard…</p>;
  }

  const { subscribers, campaigns, delivery, recentCampaigns, processor } = data;
  const openRate =
    delivery.totalSent > 0 ? Math.round((delivery.totalOpens / delivery.totalSent) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={Users}
          label="Active subscribers"
          value={subscribers.active}
          hint={`${subscribers.total} total · ${subscribers.unsubscribed} opted out`}
        />
        <Metric
          icon={Send}
          label="Emails delivered"
          value={delivery.totalSent}
          hint={delivery.totalFailed > 0 ? `${delivery.totalFailed} failed` : 'no failures'}
        />
        <Metric
          icon={MousePointerClick}
          label="Clicks"
          value={delivery.totalClicks}
          hint={`${delivery.totalOpens} opens · ${openRate}% open rate`}
        />
        <Metric
          icon={Layers}
          label="Campaigns"
          value={campaigns.total}
          hint={`${campaigns.active} active · ${campaigns.scheduled} scheduled · ${campaigns.draft} draft`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent campaigns</CardTitle>
            {canCreate ? (
              <Button size="sm" onClick={onNewCampaign}>
                New campaign
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCampaigns.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Mail className="mx-auto mb-2 h-8 w-8 opacity-40" aria-hidden />
                No campaigns yet — create your first newsletter campaign.
              </div>
            ) : (
              recentCampaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => onOpenCampaign(campaign)}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{campaign.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{campaign.subject}</p>
                    </div>
                    <CampaignStatusBadge status={campaign.status} />
                  </div>
                  {campaign.recipientCount > 0 ? (
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={campaign.progressPercent} className="h-1.5 flex-1" />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {campaign.sentCount}/{campaign.recipientCount}
                      </span>
                    </div>
                  ) : null}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" aria-hidden /> Delivery processor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!processor ? (
              <p className="text-muted-foreground">
                No runs recorded yet. Delivery runs via the scheduled job, with this browser as a
                best-effort accelerator while the admin is open.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Heartbeat</span>
                  <span className="font-medium">{minutesAgo(processor.lastHeartbeatAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last success</span>
                  <span className="font-medium">{formatDateTime(processor.lastSuccessAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last run mode</span>
                  <span className="font-medium capitalize">{processor.mode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sent in last run</span>
                  <span className="font-medium tabular-nums">{processor.sentInLastRun}</span>
                </div>
                {processor.lastError ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="break-words">{processor.lastError}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Healthy
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
