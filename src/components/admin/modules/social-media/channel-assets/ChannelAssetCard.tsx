/**
 * One asset: what it looks like, what it says, and where it is in its life.
 *
 * The caption and alt text are editable in place because they are the fields a
 * person actually corrects after an agent has written them, and making that a
 * dialog would put three clicks in front of a one-word fix.
 */

import { useEffect, useState } from 'react';
import { Archive, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';

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
import { DsButton } from '../../../layout/page';

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
    <section className="ds-card flex flex-col overflow-hidden">
      <div className="relative aspect-square bg-[#f3f4f6]">
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
      </div>

      <div className="ds-card-b flex flex-1 flex-col gap-2">
        <span className={`ds-pill self-start ${status.className}`}>{status.label}</span>
        <div className="ds-meta flex items-center justify-between gap-2">
          <span className="truncate" title={asset.file_name ?? undefined}>
            {asset.file_name ?? 'Untitled'}
          </span>
          <span className="shrink-0">
            {[formatBytes(asset.byte_size), dimensions, duration].filter(Boolean).join(' · ')}
          </span>
        </div>

        {asset.source && (
          <p className="ds-meta">
            Added by {asset.source}
            {asset.buffer_post_id ? ' · published through Buffer' : ''}
          </p>
        )}

        {warnings.length > 0 && (
          <p className="text-[12.5px] text-amber-700">{warnings.join(' · ')}</p>
        )}

        <div className="space-y-2">
          <div>
            <Label htmlFor={`caption-${asset.id}`} className="text-[12.5px] text-nw-text-2">
              Suggested caption
            </Label>
            <Textarea
              id={`caption-${asset.id}`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-[60px] text-sm"
            />
          </div>
          <div>
            <Label htmlFor={`alt-${asset.id}`} className="text-[12.5px] text-nw-text-2">
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

        {postBlocker && <p className="ds-meta">{postBlocker}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {onCreatePost && (
            <DsButton
              size="sm"
              variant={postBlocker ? 'default' : 'primary'}
              disabled={Boolean(postBlocker)}
              aria-label={`Create a post from ${asset.file_name ?? 'asset'}`}
              onClick={() => onCreatePost({ caption: caption || null, altText: altText || null })}
            >
              Create post
            </DsButton>
          )}
          <DsButton
            size="sm"
            disabled={!dirty || isSaving}
            onClick={() => onPatch({ caption: caption || null, altText: altText || null })}
          >
            Save
          </DsButton>

          {asset.status !== 'available' && (
            <DsButton
              size="sm"
              aria-label={`Return ${asset.file_name ?? 'asset'} to available`}
              onClick={() => onPatch({ status: 'available' })}
            >
              Requeue
            </DsButton>
          )}
          <span className="grow" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DsButton
                size="sm"
                variant="ghost"
                aria-label={`More actions for ${asset.file_name ?? 'asset'}`}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </DsButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={asset.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  Open
                </a>
              </DropdownMenuItem>
              {asset.status !== 'archived' && (
                <DropdownMenuItem onSelect={() => onPatch({ status: 'archived' })}>
                  <Archive className="h-3.5 w-3.5 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-700"
                onSelect={() => onDelete()}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  );
}
