/**
 * AutomationStrip — the pipeline's status line and its levers.
 *
 * Kill switch, where this posting week stands, what the last run reported,
 * and the two jobs an admin can run by hand. The routines themselves are
 * scheduled outside the app (a Claude or ChatGPT routine); this strip is how
 * the operator sees them working — or not.
 */

import { Image as ImageIcon, RefreshCw, Settings2 } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Switch } from '../../../../ui/switch';
import type { SocialAutomationSettings, SocialBatchSummary, SocialJobName } from './assetsTypes';
import {
  BATCH_STATUS_DISPLAY,
  formatSlot,
  formatWeekLabel,
  summarizeRunReport,
} from './assetsModel';

interface AutomationStripProps {
  settings?: SocialAutomationSettings;
  postingWeek: string;
  postingBatch?: SocialBatchSummary;
  latestBatch?: SocialBatchSummary;
  toggling?: boolean;
  runningJob?: SocialJobName | null;
  onToggleEnabled: (enabled: boolean) => void;
  onOpenSettings: () => void;
  onRunJob: (job: SocialJobName) => void;
}

export function AutomationStrip({
  settings,
  postingWeek,
  postingBatch,
  latestBatch,
  toggling,
  runningJob,
  onToggleEnabled,
  onOpenSettings,
  onRunJob,
}: AutomationStripProps) {
  const enabled = settings?.enabled ?? false;
  const timeZone = settings?.posting_timezone ?? 'Africa/Johannesburg';
  const batchStatus = postingBatch ? BATCH_STATUS_DISPLAY[postingBatch.status] : null;
  const reportLines = summarizeRunReport(latestBatch?.run_report).slice(0, 3);
  const lastActivity = latestBatch?.selected_at ?? latestBatch?.generated_at ?? null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Switch
              id="social-automation-enabled"
              checked={enabled}
              disabled={!settings || toggling}
              onCheckedChange={onToggleEnabled}
              aria-label="Weekly automation"
            />
            <div>
              <label htmlFor="social-automation-enabled" className="font-medium">
                Weekly automation {settings ? (enabled ? 'on' : 'off') : ''}
              </label>
              <p className="text-sm text-muted-foreground">
                Saturday: the routine generates candidates · hourly: images render · Sunday: the
                routine selects and schedules in Buffer · hourly: Buffer status syncs back.
                {!enabled && settings && ' Nothing runs while this is off.'}
              </p>
            </div>
          </div>

          <div className="text-sm lg:text-right">
            <div className="flex items-center gap-2 lg:justify-end">
              <span className="text-muted-foreground">Posting week</span>
              <span className="font-medium">{formatWeekLabel(postingWeek)}</span>
              {batchStatus ? (
                <Badge
                  variant="outline"
                  className={batchStatus.className}
                  title={batchStatus.description}
                >
                  {batchStatus.label}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                  No batch yet
                </Badge>
              )}
            </div>
            {lastActivity && (
              <p className="text-xs text-muted-foreground mt-1">
                Last activity {formatSlot(lastActivity, timeZone)}
                {latestBatch?.selected_by || latestBatch?.generated_by
                  ? ` by ${latestBatch.selected_by ?? latestBatch.generated_by}`
                  : ''}
              </p>
            )}
            {reportLines.length > 0 && (
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {reportLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(runningJob)}
              onClick={() => onRunJob('render-images')}
            >
              <ImageIcon className="h-4 w-4 mr-1.5" />
              {runningJob === 'render-images' ? 'Rendering…' : 'Render images now'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(runningJob)}
              onClick={() => onRunJob('sync-buffer')}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${runningJob === 'sync-buffer' ? 'animate-spin' : ''}`}
              />
              Sync Buffer now
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenSettings}>
              <Settings2 className="h-4 w-4 mr-1.5" />
              Settings &amp; playbooks
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
