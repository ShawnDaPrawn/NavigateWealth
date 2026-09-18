/**
 * One asset: what it looks like, what it says, and where it is in its life.
 *
 * The caption and alt text are editable in place because they are the fields a
 * person actually corrects after an agent has written them, and making that a
 * dialog would put three clicks in front of a one-word fix.
 */

import { useEffect, useState } from 'react';
import { Archive, Check, ExternalLink, RotateCcw, Send, Trash2 } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import type { ChannelAsset, ChannelAssetPatch } from '../types';
import {
  assetWarnings,
  formatBytes,
  formatDimensions,
  formatDuration,
  STATUS_DISPLAY,
} from './channelAssetsModel';

interface ChannelAssetCardProps {
  asset: ChannelAsset;
  onPatch: (patch: ChannelAssetPatch) => void;
  onDelete: () => void;
  /**
   * Open Compose with this asset attached. Absent when there is nowhere to go.
   *
   * Takes the caption and alt text as they stand in the fields, which may not
   * be what the server holds: someone who fixes a caption and goes straight to
   * Compose means the fix, and silently posting the old wording would be a
   * poor reward for editing it.
   */
  onCreatePost?: (edits: { caption: string | null; altText: string | null }) => void;
  isSaving?: boolean;
}

export function ChannelAssetCard({
  asset,
  onPatch,
  onDelete,
  onCreatePost,
  isSaving,
}: ChannelAssetCardProps) {
  const [caption, setCaption] = useState(asset.caption ?? '');
  const [altText, setAltText] = useState(asset.alt_text ?? '');

  // An agent can add or change these while the tab is open; take the server's
  // version unless the person is mid-edit on that field.
  useEffect(() => setCaption(asset.caption ?? ''), [asset.caption]);
  useEffect(() => setAltText(asset.alt_text ?? ''), [asset.alt_text]);

  const dirty = caption !== (asset.caption ?? '') || altText !== (asset.alt_text ?? '');
  const status = STATUS_DISPLAY[asset.status];
  const warnings = assetWarnings(asset);
  const dimensions = formatDimensions(asset);
  const duration = formatDuration(asset.duration_seconds);
  // Compose sends Buffer an image URL; video needs Buffer's own upload path and
  // arrives with the publishing routine. Saying so beats letting the post fail
  // at Buffer — but it has to be said in the card, not in a `title`: the shared
  // Button carries `disabled:pointer-events-none`, so a disabled one never
  // fires hover, and it takes no keyboard focus either.
  const postBlocker =
    asset.media_type === 'video'
      ? 'Video cannot be posted from Compose yet — it needs Buffer\u2019s upload path.'
      : asset.status === 'used'
        ? 'This asset has already been published. Requeue it first to post it again.'
        : null;

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="aspect-square bg-muted relative">
        {asset.media_type === 'video' ? (
          <video
            src={asset.url}
            className="w-full h-full object-cover"
            controls
            preload="metadata"
            aria-label={asset.file_name ?? 'Video asset'}
          />
        ) : (
          <img
            src={asset.url}
            alt={asset.alt_text ?? asset.file_name ?? 'Asset'}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        )}
        <Badge className={`absolute top-2 left-2 ${status.className}`} variant="outline">
          {status.label}
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate" title={asset.file_name ?? undefined}>
            {asset.file_name ?? 'Untitled'}
          </span>
          <span className="shrink-0">
            {[formatBytes(asset.byte_size), dimensions, duration].filter(Boolean).join(' · ')}
          </span>
        </div>

        {asset.source && (
          <p className="text-xs text-muted-foreground">
            Added by {asset.source}
            {asset.buffer_post_id ? ' · published through Buffer' : ''}
          </p>
        )}

        {warnings.length > 0 && <p className="text-xs text-amber-700">{warnings.join(' · ')}</p>}

        <div className="space-y-2">
          <div>
            <Label htmlFor={`caption-${asset.id}`} className="text-xs">
              Suggested caption
            </Label>
            <Textarea
              id={`caption-${asset.id}`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What this post should say"
              className="min-h-[60px] text-sm"
            />
          </div>
          <div>
            <Label htmlFor={`alt-${asset.id}`} className="text-xs">
              Alt text
            </Label>
            <Input
              id={`alt-${asset.id}`}
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe the image"
              className="h-8 text-sm"
            />
          </div>
        </div>

        {postBlocker && <p className="text-xs text-muted-foreground">{postBlocker}</p>}

        <div className="flex flex-wrap gap-1">
          {onCreatePost && (
            <Button
              size="sm"
              variant={postBlocker ? 'outline' : 'default'}
              disabled={Boolean(postBlocker)}
              title={postBlocker ?? undefined}
              aria-label={`Create a post from ${asset.file_name ?? 'asset'}`}
              onClick={() => onCreatePost({ caption: caption || null, altText: altText || null })}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Create post
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={!dirty || isSaving}
            onClick={() => onPatch({ caption: caption || null, altText: altText || null })}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Save
          </Button>

          {asset.status !== 'available' && (
            <Button
              size="sm"
              variant="outline"
              aria-label={`Return ${asset.file_name ?? 'asset'} to available`}
              onClick={() => onPatch({ status: 'available' })}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Requeue
            </Button>
          )}
          {asset.status !== 'archived' && (
            <Button
              size="sm"
              variant="outline"
              aria-label={`Archive ${asset.file_name ?? 'asset'}`}
              onClick={() => onPatch({ status: 'archived' })}
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            asChild
            aria-label={`Open ${asset.file_name ?? 'asset'}`}
          >
            <a href={asset.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label={`Delete ${asset.file_name ?? 'asset'}`}
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-600" />
          </Button>
        </div>
      </div>
    </div>
  );
}
