/**
 * Newsletter — background delivery health.
 *
 * Is the scheduled delivery job checking in, what did its last pass do, and
 * a button to run a pass by hand. Collapsed by default on the list screen:
 * it matters when something is wrong, not every visit.
 */
import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Play,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader } from '../../../../ui/card';
import { cn } from '../../../../ui/utils';
import { useRunProcessorNow } from '../hooks/useNewsletterStudio';
import type { NewsletterDashboardSummary } from '../types';
import { formatDateTime, formatNumber, formatRelative } from '../utils/format';
import { schedulerHealth } from '../utils/scheduler';
import { DetailRow, Notice, SectionHeader } from './shared';

export function DeliveryHealthCard({
  summary,
  canRun,
  defaultOpen,
}: {
  summary: NewsletterDashboardSummary;
  canRun: boolean;
  /** Defaults to open only when something needs attention. */
  defaultOpen?: boolean;
}) {
  const processor = summary.processor;
  const health = schedulerHealth(processor);
  const runNow = useRunProcessorNow();
  const attention = health.level !== 'live' || Boolean(processor?.lastError);
  const [open, setOpen] = useState(defaultOpen ?? attention);

  return (
    <Card className="gap-0">
      <CardHeader className={cn('pb-3', !open && 'pb-4')}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <SectionHeader
            icon={Activity}
            title="Background delivery"
            description="Runs every 2 minutes, whether or not anyone is signed in"
            className="flex-1"
          />
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn('h-2 w-2 rounded-full', attention ? 'bg-amber-500' : 'bg-emerald-500')}
              aria-hidden
            />
            {processor?.lastError ? 'Needs attention' : health.label}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
              aria-hidden
            />
          </span>
        </button>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-4">
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5',
              attention
                ? 'bg-amber-50 dark:bg-amber-950/30'
                : 'bg-emerald-50 dark:bg-emerald-950/30',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                attention
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
              )}
            >
              {attention ? (
                <AlertTriangle className="h-4 w-4" aria-hidden />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {processor?.lastError ? 'Needs attention' : health.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {health.level === 'live' && processor?.lastCronRunAt
                  ? `Last check-in ${formatRelative(processor.lastCronRunAt)}`
                  : health.detail}
              </p>
            </div>
          </div>

          {processor ? (
            <dl className="divide-y divide-border/60">
              <DetailRow label="Last run">
                {formatRelative(processor.lastRunAt)}
                <span className="ml-1 font-normal text-muted-foreground">
                  ({processor.mode === 'cron' ? 'scheduler' : 'admin browser'})
                </span>
              </DetailRow>
              <DetailRow label="Last successful run">
                {formatDateTime(processor.lastSuccessAt)}
              </DetailRow>
              <DetailRow label="Sent in last run">
                {formatNumber(processor.sentInLastRun)}
              </DetailRow>
              {processor.failedInLastRun > 0 ? (
                <DetailRow label="Failed in last run">
                  <span className="text-rose-600 dark:text-rose-400">
                    {formatNumber(processor.failedInLastRun)}
                  </span>
                </DetailRow>
              ) : null}
              <DetailRow label="Newsletters in flight">
                {formatNumber(summary.campaigns.active)}
              </DetailRow>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No delivery pass has run yet. The first one starts as soon as a newsletter is sent.
            </p>
          )}

          {processor?.lastError ? (
            <Notice tone="warn" icon={AlertTriangle} title="Last run reported a problem">
              <span className="break-words">{processor.lastError}</span>
            </Notice>
          ) : null}

          {health.level === 'missing' ? (
            <Notice tone="warn" icon={Clock} title="Scheduled sends need the delivery job">
              Newsletters still send while an admin has this page open. For unattended delivery an
              operator installs the job from{' '}
              <code className="rounded bg-black/5 px-1 py-0.5 text-[11px] dark:bg-white/10">
                supabase/cron/newsletter-studio-jobs.sql
              </code>
              .
            </Notice>
          ) : null}

          {canRun ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => runNow.mutate()}
              disabled={runNow.isPending}
            >
              {runNow.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              Run a delivery pass now
            </Button>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
