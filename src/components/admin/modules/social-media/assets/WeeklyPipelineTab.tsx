/**
 * WeeklyPipelineTab — what the weekly routines generated, one column per channel.
 *
 * Candidate POSTS for a posting week: body text, hashtags and an image brief,
 * with which of them were selected and scheduled and the context the routines
 * worked from. Read-mostly: the human's levers are the kill switch, removing a
 * candidate, and the settings dialog.
 *
 * Not to be confused with the Assets tab, which holds the finished pictures
 * and videos themselves (`social_channel_assets`). This one is `social_assets`.
 */

import { useMemo, useState } from 'react';
import { Instagram, Linkedin, Twitter } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Skeleton } from '../../../../ui/skeleton';
import {
  useRunSocialJob,
  useSocialAutomationSettings,
  useSocialBatch,
  useSocialBatches,
  useUpdateSocialAsset,
  useUpdateSocialSettings,
} from '../hooks/useSocialAssets';
import type { SocialChannel, SocialJobName } from './assetsTypes';
import {
  BATCH_STATUS_DISPLAY,
  pillTone,
  CHANNEL_LABEL,
  CHANNEL_ORDER,
  countChannel,
  formatWeekLabel,
  groupAssetsByChannel,
  postingWeekKey,
  summarizeRunReport,
} from './assetsModel';
import { AssetCard } from './AssetCard';
import { AutomationStrip } from './AutomationStrip';
import { DsState, ErrorState } from '../../../layout/page';

const CHANNEL_ICON: Record<SocialChannel, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  x: Twitter,
};

interface WeeklyPipelineTabProps {
  /** Opens "Automation settings & playbooks" as a page of its own. */
  onOpenSettings?: () => void;
}

export function WeeklyPipelineTab({ onOpenSettings }: WeeklyPipelineTabProps = {}) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);

  const batchesQuery = useSocialBatches(16);
  const settingsQuery = useSocialAutomationSettings();
  const updateSettings = useUpdateSocialSettings();
  const updateAsset = useUpdateSocialAsset();
  const runJob = useRunSocialJob();

  const batches = useMemo(() => batchesQuery.data ?? [], [batchesQuery.data]);
  const postingWeek = postingWeekKey();
  const postingBatch = batches.find((b) => b.week_key === postingWeek);
  const effectiveWeek = selectedWeek ?? postingBatch?.week_key ?? batches[0]?.week_key ?? null;
  const batchQuery = useSocialBatch(effectiveWeek);

  const settings = settingsQuery.data;
  const timeZone = settings?.posting_timezone ?? 'Africa/Johannesburg';
  const groups = useMemo(
    () => groupAssetsByChannel(batchQuery.data?.assets ?? []),
    [batchQuery.data],
  );
  const batch = batchQuery.data?.batch;
  const reportLines = summarizeRunReport(batch?.run_report);
  const runningJob: SocialJobName | null = runJob.isPending ? (runJob.variables ?? null) : null;

  const handleAsset = (assetId: string, patch: Parameters<typeof updateAsset.mutate>[0]['patch']) =>
    updateAsset.mutate({ assetId, patch });

  return (
    <div className="space-y-6">
      <AutomationStrip
        settings={settings}
        postingWeek={postingWeek}
        postingBatch={postingBatch}
        latestBatch={batches[0]}
        toggling={updateSettings.isPending}
        runningJob={runningJob}
        onToggleEnabled={(enabled) => updateSettings.mutate({ enabled })}
        onOpenSettings={() => onOpenSettings?.()}
        onRunJob={(job) => runJob.mutate(job)}
      />

      {batchesQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CHANNEL_ORDER.map((c) => (
            <Skeleton key={c} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : batchesQuery.error ? (
        <ErrorState
          title="Unable to load the weekly pipeline"
          onRetry={() => void batchesQuery.refetch()}
          details={batchesQuery.error instanceof Error ? batchesQuery.error.message : undefined}
        />
      ) : batches.length === 0 ? (
        <section className="ds-card">
          <DsState title="No weekly batches yet" />
        </section>
      ) : (
        <>
          {/* SM-Weekly: one "Week" card — week picker in its header, then the assets */}
          <section className="ds-card overflow-hidden">
            <div className="ds-card-h flex-wrap">
              <h3>Week</h3>
              <div className="flex items-center gap-2">
                {batch && (
                  <span
                    className={`ds-pill ${pillTone(BATCH_STATUS_DISPLAY[batch.status])}`}
                    title={BATCH_STATUS_DISPLAY[batch.status].description}
                  >
                    {BATCH_STATUS_DISPLAY[batch.status].label}
                  </span>
                )}
                <Select value={effectiveWeek ?? ''} onValueChange={(v) => setSelectedWeek(v)}>
                  <SelectTrigger className="w-[220px]" aria-label="Select week">
                    <SelectValue placeholder="Choose a week" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.week_key} value={b.week_key}>
                        {formatWeekLabel(b.week_key)} · {BATCH_STATUS_DISPLAY[b.status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {batch && (
              <div className="ds-card-b space-y-1 border-b border-nw-line">
                <p className="ds-meta">
                  Articles from {batch.source_window_start} to {batch.source_window_end}
                  {batch.generated_by ? ` · generated by ${batch.generated_by}` : ''}
                  {batch.selected_by ? ` · scheduled by ${batch.selected_by}` : ''}
                </p>
                {reportLines.length > 0 && (
                  <ul className="ds-meta">
                    {reportLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {batch.context_brief && (
                  <div>
                    <button
                      type="button"
                      aria-expanded={briefOpen}
                      className="text-[12.5px] font-medium text-nw-violet hover:underline"
                      onClick={() => setBriefOpen((v) => !v)}
                    >
                      Context the routine worked from
                    </button>
                    {briefOpen && (
                      <p className="ds-meta mt-1 whitespace-pre-wrap border-l-2 border-nw-line pl-3">
                        {batch.context_brief}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {batchQuery.isLoading ? (
              <div className="space-y-2 p-4">
                {CHANNEL_ORDER.map((c) => (
                  <Skeleton key={c} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : batchQuery.error ? (
              <div className="p-4">
                <ErrorState
                  title="Unable to load this week’s assets"
                  onRetry={() => void batchQuery.refetch()}
                  details={batchQuery.error instanceof Error ? batchQuery.error.message : undefined}
                />
              </div>
            ) : (
              <div>
                {CHANNEL_ORDER.map((channel) => {
                  const Icon = CHANNEL_ICON[channel];
                  const assets = groups[channel];
                  const counts = countChannel(assets);
                  return (
                    <section key={channel} aria-label={`${CHANNEL_LABEL[channel]} assets`}>
                      <div className="flex items-center justify-between gap-2 border-b border-nw-line bg-[#fafafb] px-4 py-2">
                        <span className="flex items-center gap-2 text-[13px] font-medium text-nw-ink">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {CHANNEL_LABEL[channel]}
                        </span>
                        <span className="ds-meta">
                          {counts.live} live · {counts.candidates} candidate
                          {counts.candidates === 1 ? '' : 's'}
                        </span>
                      </div>
                      {assets.length === 0 ? (
                        <p className="ds-meta border-b border-nw-line px-4 py-3">
                          No assets for {CHANNEL_LABEL[channel]} this week.
                        </p>
                      ) : (
                        assets.map((asset) => (
                          <AssetCard
                            key={asset.id}
                            asset={asset}
                            timeZone={timeZone}
                            busy={updateAsset.isPending}
                            onReject={(id) => handleAsset(id, { state: 'rejected' })}
                            onRestore={(id) => handleAsset(id, { state: 'generated' })}
                            onRetryImage={(id) => handleAsset(id, { retryImage: true })}
                          />
                        ))
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
