/**
 * AssetCard — one generated/scheduled social asset.
 *
 * Shows what the routine wrote, what state it is in, why it was picked, and
 * the image pipeline's verdict. The only human verbs are remove / restore /
 * retry image; scheduled and published posts are managed in Buffer.
 */

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

import type { SocialAsset } from './assetsTypes';
import {
  ASSET_STATE_DISPLAY,
  IMAGE_STATUS_DISPLAY,
  REJECTABLE_STATES,
  formatSlot,
  pillTone,
} from './assetsModel';
import { DsButton } from '../../../layout/page';

interface AssetCardProps {
  asset: SocialAsset;
  timeZone: string;
  busy?: boolean;
  onReject: (assetId: string) => void;
  onRestore: (assetId: string) => void;
  onRetryImage: (assetId: string) => void;
}

const CLAMP_AT = 280;

export function AssetCard({
  asset,
  timeZone,
  busy,
  onReject,
  onRestore,
  onRetryImage,
}: AssetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const state = ASSET_STATE_DISPLAY[asset.state];
  const hasImagePipeline = Boolean(asset.image_brief || asset.image_url);
  const image = IMAGE_STATUS_DISPLAY[asset.image_status];
  const longBody = asset.body.length > CLAMP_AT;
  const canReject = REJECTABLE_STATES.includes(asset.state);

  const thumbBackground =
    asset.channel === 'linkedin'
      ? 'linear-gradient(135deg,#4c1d95,#6d28d9 60%,#8b5cf6)'
      : 'linear-gradient(135deg,#111827,#312e81 70%,#4c1d95)';

  return (
    // SM-Weekly: one to-do style row per asset — thumbnail, pills and copy, actions
    <div
      className="ds-todo-row flex-wrap items-start sm:flex-nowrap"
      data-testid={`asset-card-${asset.id}`}
    >
      <div className="w-24 shrink-0">
        {asset.image_url ? (
          <img
            src={asset.image_url}
            alt={asset.image_alt_text || asset.title}
            className="h-24 w-24 rounded-[10px] object-cover"
            loading="lazy"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-24 w-24 flex-col justify-between overflow-hidden rounded-[10px] p-2.5 text-white"
            style={{ background: thumbBackground }}
          >
            <span className="text-[10px] font-semibold tracking-wide opacity-85">
              {asset.channel === 'x'
                ? 'X'
                : asset.channel.charAt(0).toUpperCase() + asset.channel.slice(1)}
            </span>
          </div>
        )}
      </div>

      <div className="grow min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`ds-pill ${pillTone(state)}`} title={state.description}>
            {state.label}
          </span>
          {asset.selection_rank != null && <span className="ds-pill">#{asset.selection_rank}</span>}
          {hasImagePipeline && (
            <span className={`ds-pill ${pillTone(image)}`} title={image.description}>
              {image.label}
            </span>
          )}
          {asset.scheduled_for && (
            <span className="ds-meta">{formatSlot(asset.scheduled_for, timeZone)}</span>
          )}
        </div>

        <div>
          <h4 className="text-[13.5px] font-semibold leading-snug text-nw-ink">{asset.title}</h4>
          {asset.source_summary && <span className="ds-meta">{asset.source_summary}</span>}
        </div>

        {!asset.image_url && asset.image_brief && (
          <p className="ds-meta italic">
            {asset.image_brief}
            {asset.image_error && (
              <span className="block not-italic text-red-700">{asset.image_error}</span>
            )}
          </p>
        )}

        <div>
          <p
            className={`whitespace-pre-wrap text-[13.5px] text-nw-ink ${expanded ? '' : 'line-clamp-3'}`}
          >
            {asset.body}
          </p>
          {longBody && (
            <button
              type="button"
              className="mt-0.5 text-[12.5px] text-nw-violet underline-offset-2 hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {asset.first_comment && <p className="ds-meta">First comment: {asset.first_comment}</p>}

        {asset.hashtags.length > 0 && (
          <p className="ds-meta">
            {asset.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')}
          </p>
        )}

        {asset.link_url && (
          <a
            href={asset.link_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12.5px] text-nw-violet hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            {asset.link_title || asset.link_url}
          </a>
        )}

        {asset.selection_rationale && (
          <p className="ds-meta border-l-2 border-nw-line pl-2 italic">
            {asset.selection_rationale}
          </p>
        )}

        {asset.buffer_post_id && (
          <p className="ds-meta">
            Buffer: {asset.buffer_status ?? 'scheduled'}
            {asset.buffer_error && <span className="text-red-700"> — {asset.buffer_error}</span>}
          </p>
        )}
        {!asset.buffer_post_id && asset.buffer_error && (
          <p className="text-[12.5px] text-red-700">{asset.buffer_error}</p>
        )}
      </div>

      {(canReject || asset.state === 'rejected' || asset.image_status === 'failed') && (
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {asset.image_status === 'failed' && asset.image_brief && (
            <DsButton size="sm" disabled={busy} onClick={() => onRetryImage(asset.id)}>
              Retry image
            </DsButton>
          )}
          {asset.state === 'rejected' && (
            <DsButton size="sm" disabled={busy} onClick={() => onRestore(asset.id)}>
              Restore
            </DsButton>
          )}
          {canReject && (
            <DsButton size="sm" variant="ghost" disabled={busy} onClick={() => onReject(asset.id)}>
              Remove
            </DsButton>
          )}
        </div>
      )}
    </div>
  );
}
