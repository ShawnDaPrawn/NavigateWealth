/**
 * AutomationStrip — the pipeline's status line and its levers.
 *
 * Kill switch, where this posting week stands, what the last run reported,
 * and the two jobs an admin can run by hand. The routines themselves are
 * scheduled outside the app (a Claude or ChatGPT routine); this strip is how
 * the operator sees them working — or not.
 */

import { DsButton } from '../../../layout/page';
import { Switch } from '../../../../ui/switch';
import type { SocialAutomationSettings, SocialBatchSummary, SocialJobName } from './assetsTypes';
import {
  BATCH_STATUS_DISPLAY,
  pillTone,
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

  const assetCount = postingBatch
    ? Object.values(postingBatch.asset_counts ?? {}).reduce((sum, n) => sum + n, 0)
    : undefined;
  const metaParts = [
    `Posting ${formatWeekLabel(postingWeek).replace(/^Week \d+ · /, 'week ')}`,
    typeof assetCount === 'number' ? `${assetCount} assets` : null,
    lastActivity
      ? `last activity ${formatSlot(lastActivity, timeZone)}${
          latestBatch?.selected_by || latestBatch?.generated_by
            ? ` by ${latestBatch.selected_by ?? latestBatch.generated_by}`
            : ''
        }`
      : null,
  ].filter(Boolean);

  return (
    // SM-Weekly: one strip — the switch and its state, the posting week, the actions
    <section className="ds-card ds-card-b flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex grow items-start gap-3">
        <Switch
          id="social-automation-enabled"
          checked={enabled}
          disabled={!settings || toggling}
          onCheckedChange={onToggleEnabled}
          aria-label="Weekly automation"
          className="mt-0.5"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="social-automation-enabled" className="font-semibold text-nw-ink">
              Weekly automation {settings ? (enabled ? 'on' : 'off') : ''}
            </label>
            {batchStatus ? (
              <span className={`ds-pill ${pillTone(batchStatus)}`} title={batchStatus.description}>
                {batchStatus.label}
              </span>
            ) : (
              <span className="ds-pill">No batch yet</span>
            )}
          </div>
          <span className="ds-meta">{metaParts.join(' · ')}</span>
          {reportLines.length > 0 && (
            <ul className="ds-meta mt-0.5">
              {reportLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <DsButton
          size="sm"
          disabled={Boolean(runningJob)}
          onClick={() => onRunJob('render-images')}
        >
          {runningJob === 'render-images' ? 'Rendering…' : 'Render images now'}
        </DsButton>
        <DsButton size="sm" disabled={Boolean(runningJob)} onClick={() => onRunJob('sync-buffer')}>
          {runningJob === 'sync-buffer' ? 'Syncing…' : 'Sync Buffer now'}
        </DsButton>
        <DsButton size="sm" variant="ghost" onClick={onOpenSettings}>
          Settings &amp; playbooks
        </DsButton>
      </div>
    </section>
  );
}
