/**
 * Pick images for a post, from inside the composer.
 *
 * Uploading here adds straight to the selection, because someone who just
 * dragged a picture in means to use it — making them find it again in the grid
 * would be busywork.
 *
 * Selection stops at the server's per-post ceiling (`MAX_POST_IMAGES`). Letting
 * someone attach a fifth image would store it and then fail every publish
 * attempt on a validation error they had no way to see coming.
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
import { useMediaLibrary, useUploadMedia } from '../hooks/useSocialMediaLibrary';
import { MAX_POST_IMAGES } from '../composerModel';
import type { SocialMediaAsset } from '../types';
import { formatFileSize } from '../utils';
import { MediaUploadZone } from './MediaUploadZone';

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Storage paths already attached to the draft — they count against the ceiling. */
  attachedPaths: string[];
  onConfirm: (assets: SocialMediaAsset[]) => void;
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  attachedPaths,
  onConfirm,
}: MediaPickerDialogProps) {
  const { assets, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useMediaLibrary(open);
  const upload = useUploadMedia();
  const [selected, setSelected] = useState<Record<string, SocialMediaAsset>>({});

  // Each visit starts with an empty selection rather than last time's, so
  // re-opening the picker cannot silently re-attach what was already removed.
  // What the draft already carries is shown instead (see `attachedPaths`).
  useEffect(() => {
    if (open) setSelected({});
  }, [open]);

  const chosen = Object.values(selected);
  const remaining = Math.max(0, MAX_POST_IMAGES - attachedPaths.length - chosen.length);
  const atCeiling = remaining === 0;

  const toggle = (asset: SocialMediaAsset) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[asset.storagePath]) {
        delete next[asset.storagePath];
        return next;
      }
      // Deselecting is always allowed; selecting stops at the ceiling.
      if (MAX_POST_IMAGES - attachedPaths.length - Object.keys(prev).length <= 0) return prev;
      next[asset.storagePath] = asset;
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add an image</DialogTitle>
          <DialogDescription>
            Upload a new picture or pick one you have used before. A post can carry up to{' '}
            {MAX_POST_IMAGES} images.
          </DialogDescription>
        </DialogHeader>

        <MediaUploadZone
          dense
          isUploading={upload.isPending}
          onFiles={(files) =>
            upload.mutate(files, {
              onSuccess: (outcome) =>
                setSelected((prev) => {
                  const room = MAX_POST_IMAGES - attachedPaths.length - Object.keys(prev).length;
                  const taking = outcome.uploaded.slice(0, Math.max(0, room));
                  return { ...prev, ...Object.fromEntries(taking.map((a) => [a.storagePath, a])) };
                }),
            })
          }
        />

        <ScrollArea className="h-[320px] pr-3">
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nothing in the library yet.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {assets.map((asset) => {
                  const isSelected = Boolean(selected[asset.storagePath]);
                  const alreadyAttached = attachedPaths.includes(asset.storagePath);
                  const blocked = atCeiling && !isSelected;
                  return (
                    <button
                      type="button"
                      key={asset.storagePath}
                      aria-label={`Select ${asset.name}`}
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
                          alt={asset.name}
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
                        <p className="text-xs truncate" title={asset.name}>
                          {asset.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {alreadyAttached ? 'Already added' : formatFileSize(asset.size)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {hasNextPage && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isFetchingNextPage}
                    onClick={() => void fetchNextPage()}
                  >
                    {isFetchingNextPage ? 'Loading…' : 'Load older images'}
                  </Button>
                </div>
              )}
            </>
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
