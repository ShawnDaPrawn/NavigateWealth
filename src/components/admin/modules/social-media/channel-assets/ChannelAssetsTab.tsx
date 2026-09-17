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

import { useState } from 'react';
import { Info } from 'lucide-react';
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
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Skeleton } from '../../../../ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../../../../ui/tabs';
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

export function ChannelAssetsTab() {
  const [channel, setChannel] = useState<ChannelAssetChannel>('instagram');
  const [status, setStatus] = useState<ChannelAssetStatus | 'all'>('available');
  const [pendingDelete, setPendingDelete] = useState<ChannelAsset | null>(null);

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

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Finished images and videos, ready to post. ChatGPT adds them through the social
              library endpoint; a scheduling routine will pick from <strong>Available</strong> and
              mark each one <strong>Published</strong> once Buffer has it.
            </span>
          </p>
        </CardContent>
      </Card>

      <Tabs value={channel} onValueChange={(value) => setChannel(value as ChannelAssetChannel)}>
        <TabsList>
          {CHANNEL_ORDER.map((id) => (
            <TabsTrigger key={id} value={id} className="flex items-center gap-2">
              {CHANNEL_LABEL[id]}
              <Badge variant="secondary" className="ml-1">
                {countFor(id)}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Add to {CHANNEL_LABEL[channel]}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChannelAssetUploadZone
            channelLabel={CHANNEL_LABEL[channel]}
            isUploading={upload.isPending}
            onFiles={(files) => upload.mutate({ channel, files })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>
              {CHANNEL_LABEL[channel]} assets
              {assets.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}
                  · {assets.length}
                </span>
              )}
            </span>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as ChannelAssetStatus | 'all')}
            >
              <SelectTrigger className="w-[160px]" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assetsQuery.isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[420px] rounded-lg" />
              ))}
            </div>
          )}

          {assetsQuery.error && (
            <p className="text-sm text-red-600">
              {assetsQuery.error instanceof Error
                ? assetsQuery.error.message
                : 'Could not load the assets.'}
            </p>
          )}

          {!assetsQuery.isLoading && !assetsQuery.error && assets.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing here yet for {CHANNEL_LABEL[channel]}. Drop a file above, or let ChatGPT add
              one.
            </p>
          )}

          {!assetsQuery.isLoading && assets.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map((asset) => (
                <ChannelAssetCard
                  key={asset.id}
                  asset={asset}
                  isSaving={update.isPending}
                  onPatch={(patch) => update.mutate({ id: asset.id, patch })}
                  onDelete={() => setPendingDelete(asset)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this asset?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.file_name ?? 'The file'} is removed from storage as well as from the
              list. A post already scheduled with it would lose its media, so archive it instead if
              you are not sure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
