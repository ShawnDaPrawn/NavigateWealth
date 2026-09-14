/**
 * Library — every image uploaded for posts, and the way a picture becomes one.
 *
 * "Use in post" hands the image to the composer, which is the whole point of
 * the tab: upload a graphic, then post or schedule it on LinkedIn, Instagram
 * or X without hosting it anywhere yourself.
 */

import { useState } from 'react';
import { Copy, ExternalLink, Send, Trash2 } from 'lucide-react';
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
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';
import { toast } from 'sonner';
import { useDeleteMedia, useMediaLibrary, useUploadMedia } from '../hooks/useSocialMediaLibrary';
import type { SocialMediaAsset } from '../types';
import { formatFileSize } from '../utils';
import { MediaUploadZone } from './MediaUploadZone';

interface MediaLibraryPanelProps {
  /** Send the image to Compose. */
  onUseInPost: (asset: SocialMediaAsset) => void;
}

export function MediaLibraryPanel({ onUseInPost }: MediaLibraryPanelProps) {
  const { assets, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useMediaLibrary();
  const upload = useUploadMedia();
  const remove = useDeleteMedia();
  const [pendingDelete, setPendingDelete] = useState<SocialMediaAsset | null>(null);

  const copyUrl = async (asset: SocialMediaAsset) => {
    try {
      await navigator.clipboard.writeText(asset.url);
      toast.success('Image URL copied');
    } catch {
      toast.error('Could not copy the URL');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload images</CardTitle>
          <CardDescription>
            Stored on Navigate Wealth&apos;s own storage and served from a permanent link, so a
            scheduled post still finds the picture on the day it goes out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MediaUploadZone
            onFiles={(files) => upload.mutate(files)}
            isUploading={upload.isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Library</span>
            {assets.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {assets.length}
                {hasNextPage ? '+' : ''} image{assets.length === 1 ? '' : 's'}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Could not load the library.'}
            </p>
          )}

          {!isLoading && !error && assets.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No images yet. Upload one above, then use it in a post.
            </p>
          )}

          {!isLoading && assets.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <div key={asset.storagePath} className="group space-y-2">
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                    <img
                      src={asset.url}
                      alt={asset.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" title={asset.name}>
                      {asset.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(asset.size)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" onClick={() => onUseInPost(asset)}>
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Use in post
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Copy URL for ${asset.name}`}
                      onClick={() => void copyUrl(asset)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" asChild aria-label={`Open ${asset.name}`}>
                      <a href={asset.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Delete ${asset.name}`}
                      onClick={() => setPendingDelete(asset)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasNextPage && (
            <div className="flex justify-center pt-6">
              <Button
                variant="outline"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? 'Loading…' : 'Load older images'}
              </Button>
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
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} is removed from storage. Any post already scheduled with it will
              lose its picture, so check the calendar first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete.storagePath);
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
