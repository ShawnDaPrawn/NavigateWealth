/**
 * Social channel assets — shared shapes.
 *
 * The row shape is snake_case because it is returned verbatim from the SQL
 * functions and handed to an outside agent as JSON; renaming keys on the way
 * through would make the HTTPS contract and the Supabase-connector contract
 * differ, which is the one thing this design is trying to avoid.
 */

export const SOCIAL_ASSETS_TOKEN_HEADER = 'x-nw-social-assets-token';

export type ChannelAssetChannel = 'linkedin' | 'instagram' | 'x';
export type ChannelAssetMediaType = 'image' | 'video';
export type ChannelAssetStatus = 'available' | 'used' | 'archived';

export interface ChannelAsset {
  id: string;
  channel: ChannelAssetChannel;
  media_type: ChannelAssetMediaType;
  storage_path: string;
  /** Permanent public link — this is what Buffer fetches at publish time. */
  url: string;
  file_name: string | null;
  content_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  caption: string | null;
  alt_text: string | null;
  tags: string[];
  notes: string | null;
  status: ChannelAssetStatus;
  used_at: string | null;
  buffer_post_id: string | null;
  published_at: string | null;
  source: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListChannelAssetsOptions {
  channel?: ChannelAssetChannel;
  status?: ChannelAssetStatus;
  mediaType?: ChannelAssetMediaType;
  limit?: number;
  offset?: number;
}

export interface ChannelAssetPatch {
  channel?: ChannelAssetChannel;
  caption?: string | null;
  altText?: string | null;
  tags?: string[];
  notes?: string | null;
  status?: ChannelAssetStatus;
}
