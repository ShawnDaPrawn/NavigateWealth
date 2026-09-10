/**
 * Social automation — types for the routine-driven weekly pipeline.
 *
 * Column names are snake_case on purpose: rows arrive from the `social_*`
 * tables unchanged, and the routines that write them speak SQL, so one
 * vocabulary end to end beats a mapping layer nobody would keep in sync.
 * Re-exported from the module's `types.ts`, which stays the single entry point.
 */

export type SocialChannel = 'linkedin' | 'instagram' | 'x';

export type SocialBatchStatus =
  | 'generating'
  | 'generated'
  | 'selecting'
  | 'scheduled'
  | 'failed'
  | 'cancelled';

export type SocialAssetState =
  | 'generated'
  | 'shortlisted'
  | 'selected'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'rejected'
  | 'expired';

export type SocialImageStatus = 'none' | 'pending' | 'rendering' | 'ready' | 'failed';

/** Column names are snake_case: rows arrive from the tables unchanged. */
export interface SocialAssetBatch {
  id: string;
  week_key: string;
  source_window_start: string;
  source_window_end: string;
  status: SocialBatchStatus;
  generated_by: string | null;
  generated_at: string | null;
  selected_by: string | null;
  selected_at: string | null;
  context_brief: string | null;
  run_report: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SocialBatchSummary extends SocialAssetBatch {
  asset_counts: Record<string, number>;
  scheduled_count: number;
  published_count: number;
}

export interface SocialAsset {
  id: string;
  batch_id: string;
  week_key: string;
  channel: SocialChannel;
  title: string;
  body: string;
  first_comment: string | null;
  hashtags: string[];
  link_url: string | null;
  link_title: string | null;
  source_article_ids: string[];
  source_summary: string | null;
  image_brief: string | null;
  image_style: string | null;
  image_status: SocialImageStatus;
  image_url: string | null;
  image_storage_path: string | null;
  image_alt_text: string | null;
  image_error: string | null;
  state: SocialAssetState;
  selection_rank: number | null;
  selection_rationale: string | null;
  scheduled_for: string | null;
  buffer_post_id: string | null;
  buffer_status: string | null;
  buffer_error: string | null;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialAutomationSettings {
  id: 'default';
  enabled: boolean;
  assets_per_channel: number;
  posts_per_channel_per_week: number;
  channels: SocialChannel[];
  posting_timezone: string;
  site_origin: string;
  /** channel -> ["tue 07:30", ...] in posting_timezone */
  preferred_slots: Record<string, string[]>;
  style_guide: string;
  compliance_rules: string;
  updated_by: string | null;
  updated_at: string;
}

export type SocialAutomationSettingsPatch = Partial<
  Omit<SocialAutomationSettings, 'id' | 'updated_by' | 'updated_at'>
>;

export interface SocialAutomationPlaybook {
  id: 'generate' | 'schedule';
  title: string;
  instructions: string;
  version: number;
  updated_by: string | null;
  updated_at: string;
}

export interface SocialAssetPatch {
  state?: 'rejected' | 'generated';
  retryImage?: boolean;
}

export interface RenderImagesReport {
  dryRun: boolean;
  scanned: number;
  rendered: number;
  failed: number;
  skipped: number;
  details: Array<{ assetId: string; channel: SocialChannel; outcome: string; error?: string }>;
}

export interface SyncBufferReport {
  dryRun: boolean;
  checked: number;
  published: number;
  failed: number;
  unchanged: number;
  removed: number;
  errors: Array<{ assetId: string; error: string }>;
}

export type SocialJobName = 'render-images' | 'sync-buffer';
