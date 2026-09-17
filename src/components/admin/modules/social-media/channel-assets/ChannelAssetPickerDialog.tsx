/**
 * Pick media for a manual post, from the Assets tab's library.
 *
 * Images only. Compose sends Buffer an image URL; video needs a different
 * upload path through Buffer and belongs with the publishing routine, not with
 * the by-hand composer.
 *
 * Adding new files happens in the Assets tab, which is where they have to be
 * tagged with a channel. This dialog only chooses from what is already there.
 */

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { ScrollArea } from '../../../../ui/scroll-area';
import { Skeleton } from '../../../../ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { useChannelAssets } from '../hooks/useChannelAssets';
import { MAX_POST_IMAGES } from '../composerModel';
import type { ChannelAsset, ChannelAssetChannel } from '../types';
import { formatBytes, CHANNEL_LABEL, CHANNEL_ORDER } from './channelAssetsModel';

interface ChannelAssetPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Storage paths already on the draft — they count against the ceiling. */
  attachedPaths: string[];
  onConfirm: (assets: ChannelAsset[]) => void;
}

export function ChannelAssetPickerDialog({
  open,
  onOpenChange,
  attachedPaths,
  onConfirm,
}: ChannelAssetPickerDialogProps) {
  const [channel, setChannel] = useState<ChannelAssetChannel>('instagram');
  const [selected, setSelected] = useState<Record<string, ChannelAsset>>({});

  // Only what is still on the shelf. Archiving means "take this out of
  // circulation" and `used` means it has already gone out, so neither belongs
  // in a picker for a new post — an omitted status would list all three.
  const { data, isLoading } = useChannelAssets({
    channel,
    mediaType: 'image',
    status: 'available',
    limit: 100,
  });
  const assets = data ?? [];

  // Each visit starts empty rather than from last time, so re-opening cannot
  // silently re-attach something that was already removed.
  useEffect(() => {
    if (open) setSelected({});
  }, [open]);

  const chosen = Object.values(selected);
  const atCeiling = MAX_POST_IMAGES - attachedPaths.length - chosen.length <= 0;

  const toggle = (asset: ChannelAsset) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[asset.storage_path]) {
        delete next[asset.storage_path];
        return next;
      }
      if (MAX_POST_IMAGES - attachedPaths.length - Object.keys(prev).length <= 0) return prev;
      next[asset.storage_path] = asset;
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add an image</DialogTitle>
          <DialogDescription>
            From the Assets tab. A post can carry up to {MAX_POST_IMAGES} images; upload new ones
            under Assets.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={channel} onValueChange={(value) => setChannel(value as ChannelAssetChannel)}>
          <TabsList>
            {CHANNEL_ORDER.map((id) => (
              <TabsTrigger key={id} value={id}>
                {CHANNEL_LABEL[id]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ScrollArea className="h-[320px] pr-3">
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No images for {CHANNEL_LABEL[channel]} yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {assets.map((asset) => {
                const isSelected = Boolean(selected[asset.storage_path]);
                const alreadyAttached = attachedPaths.includes(asset.storage_path);
                const blocked = atCeiling && !isSelected;
                return (
                  <button
                    type="button"
                    key={asset.id}
                    aria-label={`Select ${asset.file_name ?? 'asset'}`}
                    aria-pressed={isSelected}
                    disabled={blocked}
                    onClick={() => toggle(asset)}
                    className={`relative text-left rounded-lg overflow-hidden border-2 transition-colors ${
                      isSelected ? 'border-blue-600' : 'border-transparent hover:border-muted'
                    } ${blocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="aspect-square bg-muted">
                      <img
                        src={asset.url}
                        alt={asset.alt_text ?? asset.file_name ?? 'Asset'}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {isSelected && (
                      <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <div className="p-1.5">
                      <p className="text-xs truncate" title={asset.file_name ?? undefined}>
                        {asset.file_name ?? 'Untitled'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {alreadyAttached ? 'Already added' : formatBytes(asset.byte_size)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="items-center">
          {atCeiling && (
            <p className="text-xs text-muted-foreground mr-auto">
              That is {MAX_POST_IMAGES} images — remove one to choose another.
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={chosen.length === 0}
            onClick={() => {
              onConfirm(chosen);
              onOpenChange(false);
            }}
          >
            Add {chosen.length > 0 ? `${chosen.length} ` : ''}image{chosen.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
