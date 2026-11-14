/**
 * Assets — the media each channel has to post, split by channel.
 *
 * Instagram, LinkedIn and X each get their own shelf of finished pictures and
 * videos. ChatGPT fills these through `POST /social-library/assets`; a Claude
 * routine will later pick from what is `available` and publish it through
 * Buffer, which flips the asset to `Published` so nothing goes out twice.
 *
 * An admin can drop files straight in here too — same endpoint, same rows.
 */


import { Skeleton } from '../../../../ui/skeleton';
import { Tabs } from '../../../../ui/tabs';
import { cn } from '../../../../ui/utils';
import {
  DsState,
  ErrorState,
  SegmentedList,
  SegmentedTrigger,
  useConfirm,
  useUrlState,
} from '../../../layout/page';
import {
  useChannelAssets,
  useChannelAssetSummary,
  useDeleteChannelAsset,
  useUpdateChannelAsset,
  useUploadChannelAssets,
} from '../hooks/useChannelAssets';
import type { ChannelAsset, ChannelAssetChannel, ChannelAssetStatus } from '../types';
import { ChannelAssetCard } from './ChannelAssetCard';
import { ChannelAssetUploadZone } from './ChannelAssetUploadZone';
import { CHANNEL_LABEL, CHANNEL_ORDER } from './channelAssetsModel';

const STATUS_FILTERS: Array<{ value: ChannelAssetStatus | 'all'; label: string }> = [
  { value: 'available', label: 'Available' },
  { value: 'used', label: 'Published' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

interface ChannelAssetsTabProps {
  /**
   * Start a post from this asset. Optional so the tab still renders on its own
   * (in tests, or anywhere without a composer to hand it to).
   */
  onCreatePost?: (asset: ChannelAsset) => void;
}

const STATUS_IDS = STATUS_FILTERS.map((f) => f.value);

export function ChannelAssetsTab({ onCreatePost }: ChannelAssetsTabProps = {}) {
  // Channel and status define "where you are", so both live in the address.
  const [channel, setChannel] = useUrlState<ChannelAssetChannel>(
    'channel',
    'instagram',
    CHANNEL_ORDER,
  );
  const [status, setStatus] = useUrlState<ChannelAssetStatus | 'all'>(
    'assetStatus',
    'available',
    STATUS_IDS,
  );
  const { confirm, confirmDialog } = useConfirm();

  const summaryQuery = useChannelAssetSummary();
  const assetsQuery = useChannelAssets({
    channel,
    status: status === 'all' ? undefined : status,
    limit: 100,
  });
  const upload = useUploadChannelAssets();
  const update = useUpdateChannelAsset();
  const remove = useDeleteChannelAsset();

  const assets = assetsQuery.data ?? [];
  const summaries = summaryQuery.data ?? [];
  const countFor = (id: ChannelAssetChannel) => summaries.find((s) => s.id === id)?.available ?? 0;

  const askDelete = async (asset: ChannelAsset) => {
    const ok = await confirm({
      title: 'Delete this asset?',
      description: `${asset.file_name ?? 'The file'} is removed from storage as well as from the list. A post already scheduled with it would lose its media, so archive it instead if you are not sure.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) remove.mutate(asset.id);
  };

  return (
    <div className="space-y-4">
      {/* SM-Assets: channel chips on the left, status segmented control on the right */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Channel" className="flex flex-wrap gap-1.5">
          {CHANNEL_ORDER.map((id) => {
            const active = id === channel;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setChannel(id)}
                className={cn('ds-chip', active && 'on')}
              >
                {CHANNEL_LABEL[id]} · <span className="tabular-nums">{countFor(id)}</span>
              </button>
            );
          })}
        </div>
        <span className="grow" />
        <Tabs
          value={status}
          onValueChange={(value) => setStatus(value as ChannelAssetStatus | 'all')}
        >
          <SegmentedList aria-label="Asset status">
            {STATUS_FILTERS.map((option) => (
              <SegmentedTrigger key={option.value} value={option.value}>
                {option.label}
              </SegmentedTrigger>
            ))}
          </SegmentedList>
        </Tabs>
      </div>

      <ChannelAssetUploadZone
        channelLabel={CHANNEL_LABEL[channel]}
        isUploading={upload.isPending}
        onFiles={(files) => upload.mutate({ channel, files })}
      />
      <p className="ds-meta">
        Finished images and videos, ready to post. Mark each one Published once Buffer has it.
      </p>

      {assetsQuery.isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[420px] rounded-lg" />
          ))}
        </div>
      )}

      {assetsQuery.error && (
        <ErrorState
          title="Unable to load assets"
          details={assetsQuery.error instanceof Error ? assetsQuery.error.message : undefined}
          onRetry={() => void assetsQuery.refetch()}
        />
      )}

      {!assetsQuery.isLoading && !assetsQuery.error && assets.length === 0 && (
        <section className="ds-card">
          <DsState title={`Nothing here yet for ${CHANNEL_LABEL[channel]}`} />
        </section>
      )}

      {!assetsQuery.isLoading && assets.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <ChannelAssetCard
              key={asset.id}
              asset={asset}
              isSaving={update.isPending}
              onPatch={(patch) => update.mutate({ id: asset.id, patch })}
              onDelete={() => void askDelete(asset)}
              onCreatePost={
                onCreatePost
                  ? (edits) =>
                      onCreatePost({
                        ...asset,
                        caption: edits.caption,
                        alt_text: edits.altText,
                      })
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
