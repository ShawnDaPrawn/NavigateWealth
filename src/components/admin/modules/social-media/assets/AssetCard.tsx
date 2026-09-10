/**
 * AssetCard — one generated/scheduled social asset.
 *
 * Shows what the routine wrote, what state it is in, why it was picked, and
 * the image pipeline's verdict. The only human verbs are remove / restore /
 * retry image; scheduled and published posts are managed in Buffer.
 */

import { useState } from 'react';
import { ExternalLink, ImageOff, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import type { SocialAsset } from './assetsTypes';
import {
  ASSET_STATE_DISPLAY,
  IMAGE_STATUS_DISPLAY,
  REJECTABLE_STATES,
  formatSlot,
} from './assetsModel';

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

  return (
    <Card className="border-border" data-testid={`asset-card-${asset.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={state.className} title={state.description}>
            {state.label}
          </Badge>
          {asset.selection_rank != null && (
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
              #{asset.selection_rank}
            </Badge>
          )}
          {hasImagePipeline && (
            <Badge variant="outline" className={image.className} title={image.description}>
              {image.label}
            </Badge>
          )}
          {asset.scheduled_for && (
            <span className="ml-auto text-xs text-muted-foreground">
              {formatSlot(asset.scheduled_for, timeZone)}
            </span>
          )}
        </div>

        <div>
          <h4 className="font-medium leading-snug">{asset.title}</h4>
          {asset.source_summary && (
            <p className="text-xs text-muted-foreground mt-0.5">{asset.source_summary}</p>
          )}
        </div>

        {asset.image_url ? (
          <div
            className={`overflow-hidden rounded-md bg-muted ${asset.channel === 'instagram' ? 'aspect-square' : 'aspect-video'}`}
          >
            <img
              src={asset.image_url}
              alt={asset.image_alt_text || asset.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : asset.image_brief ? (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground flex gap-2">
            <ImageOff className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="italic">{asset.image_brief}</span>
              {asset.image_error && <div className="mt-1 text-red-600">{asset.image_error}</div>}
            </div>
          </div>
        ) : null}

        <div>
          <p className={`text-sm whitespace-pre-wrap ${expanded ? '' : 'line-clamp-5'}`}>
            {asset.body}
          </p>
          {longBody && (
            <button
              type="button"
              className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {asset.first_comment && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">First comment:</span> {asset.first_comment}
          </p>
        )}

        {asset.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {asset.hashtags.map((tag) => (
              <span key={tag} className="text-xs text-muted-foreground">
                #{tag.replace(/^#/, '')}
              </span>
            ))}
          </div>
        )}

        {asset.link_url && (
          <a
            href={asset.link_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {asset.link_title || asset.link_url}
          </a>
        )}

        {asset.selection_rationale && (
          <p className="text-xs italic text-muted-foreground border-l-2 pl-2">
            {asset.selection_rationale}
          </p>
        )}

        {asset.buffer_post_id && (
          <p className="text-xs text-muted-foreground">
            Buffer: {asset.buffer_status ?? 'scheduled'}
            {asset.buffer_error && <span className="text-red-600"> — {asset.buffer_error}</span>}
          </p>
        )}
        {!asset.buffer_post_id && asset.buffer_error && (
          <p className="text-xs text-red-600">{asset.buffer_error}</p>
        )}

        {(canReject || asset.state === 'rejected' || asset.image_status === 'failed') && (
          <div className="flex flex-wrap gap-2 pt-1">
            {canReject && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onReject(asset.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
            )}
            {asset.state === 'rejected' && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onRestore(asset.id)}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Restore
              </Button>
            )}
            {asset.image_status === 'failed' && asset.image_brief && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onRetryImage(asset.id)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Retry image
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
