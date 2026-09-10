/**
 * AssetsTab — the weekly pipeline, one column per channel.
 *
 * What the routines generated for a posting week, which of it was selected
 * and scheduled, and the context they worked from. Read-mostly: the human's
 * levers are the kill switch, removing a candidate, and the settings dialog.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Instagram, Linkedin, Twitter } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
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
  useSocialPlaybooks,
  useUpdateSocialAsset,
  useUpdateSocialPlaybook,
  useUpdateSocialSettings,
} from '../hooks/useSocialAssets';
import type { SocialChannel, SocialJobName } from './assetsTypes';
import {
  BATCH_STATUS_DISPLAY,
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
import { AutomationSettingsDialog } from './AutomationSettingsDialog';

const CHANNEL_ICON: Record<SocialChannel, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  x: Twitter,
};

export function AssetsTab() {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

  const batchesQuery = useSocialBatches(16);
  const settingsQuery = useSocialAutomationSettings();
  const playbooksQuery = useSocialPlaybooks(settingsOpen);
  const updateSettings = useUpdateSocialSettings();
  const updatePlaybook = useUpdateSocialPlaybook();
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
        onOpenSettings={() => setSettingsOpen(true)}
        onRunJob={(job) => runJob.mutate(job)}
      />

      {batchesQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CHANNEL_ORDER.map((c) => (
            <Skeleton key={c} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : batchesQuery.error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Could not load the automation batches:{' '}
            {batchesQuery.error instanceof Error ? batchesQuery.error.message : 'unknown error'}
          </CardContent>
        </Card>
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <p className="font-medium">No weekly batches yet</p>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              The generation routine creates the first batch on Saturday morning from the week’s
              published articles and the news. Until then, use Compose to post manually. See{' '}
              <code>docs/runbooks/social-automation.md</code> for how the routines are set up.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Week</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={effectiveWeek ?? ''} onValueChange={(v) => setSelectedWeek(v)}>
                    <SelectTrigger className="w-72" aria-label="Select week">
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
                  {batch && (
                    <Badge
                      variant="outline"
                      className={BATCH_STATUS_DISPLAY[batch.status].className}
                    >
                      {BATCH_STATUS_DISPLAY[batch.status].label}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            {batch && (
              <CardContent className="pt-0 space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Articles from {batch.source_window_start} to {batch.source_window_end}
                  {batch.generated_by ? ` · generated by ${batch.generated_by}` : ''}
                  {batch.selected_by ? ` · scheduled by ${batch.selected_by}` : ''}
                </p>
                {reportLines.length > 0 && (
                  <ul className="text-muted-foreground space-y-0.5">
                    {reportLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {batch.context_brief && (
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-0"
                      onClick={() => setBriefOpen((v) => !v)}
                    >
                      {briefOpen ? (
                        <ChevronUp className="h-4 w-4 mr-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 mr-1" />
                      )}
                      Context the routine worked from
                    </Button>
                    {briefOpen && (
                      <p className="whitespace-pre-wrap text-muted-foreground border-l-2 pl-3 mt-1">
                        {batch.context_brief}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {batchQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CHANNEL_ORDER.map((c) => (
                <Skeleton key={c} className="h-64 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {CHANNEL_ORDER.map((channel) => {
                const Icon = CHANNEL_ICON[channel];
                const assets = groups[channel];
                const counts = countChannel(assets);
                return (
                  <section
                    key={channel}
                    className="space-y-3"
                    aria-label={`${CHANNEL_LABEL[channel]} assets`}
                  >
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 font-medium">
                        <Icon className="h-4 w-4" />
                        {CHANNEL_LABEL[channel]}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {counts.live} live · {counts.candidates} candidate
                        {counts.candidates === 1 ? '' : 's'}
                      </span>
                    </div>
                    {assets.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-sm text-muted-foreground">
                          No assets for {CHANNEL_LABEL[channel]} this week.
                        </CardContent>
                      </Card>
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
        </>
      )}

      <AutomationSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        playbooks={playbooksQuery.data ?? []}
        saving={updateSettings.isPending || updatePlaybook.isPending}
        onSaveSettings={(patch) => updateSettings.mutateAsync(patch)}
        onSavePlaybook={(id, patch) => updatePlaybook.mutateAsync({ id, patch })}
      />
    </div>
  );
}
