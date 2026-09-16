/**
 * Newsletter intake — shared constants and types.
 *
 * The monthly routine hands a finished newsletter PDF over in one of two
 * ways (docs/runbooks/newsletter-intake.md):
 *
 *   - HTTPS: `POST /newsletter-intake/submit` (multipart), authenticated by
 *     the dedicated token below or the shared cron token.
 *   - SQL: `select * from public.newsletter_intake_submit(...)` through the
 *     Supabase connector, for a routine whose environment cannot reach the
 *     Edge Function. The cron tick sweeps the table.
 *
 * Both end in the same draft awaiting admin review and the same admin email.
 */

/** Header carrying the dedicated intake token (`NW_NEWSLETTER_INTAKE_TOKEN`). */
export const NEWSLETTER_INTAKE_TOKEN_HEADER = 'x-nw-newsletter-intake-token';

/** Env var naming the admin recipients of the "draft ready" email (comma list). */
export const NEWSLETTER_REVIEW_TO_ENV = 'NW_NEWSLETTER_REVIEW_TO';

/** The SQL intake table the sweep reads. */
export const NEWSLETTER_INTAKE_TABLE = 'newsletter_intake';

/** Rows the sweep promotes per cron tick. One keeps decode + upload + email inside the 20 s window. */
export const INTAKE_SWEEP_LIMIT = 1;

export type NewsletterIntakeRowStatus = 'pending' | 'processed' | 'failed';

/** A row of `public.newsletter_intake`. */
export interface NewsletterIntakeRow {
  id: string;
  title: string;
  description: string;
  list_ids: string[];
  file_name: string;
  pdf_base64: string | null;
  idempotency_key: string | null;
  submitted_by: string;
  status: NewsletterIntakeRowStatus;
  error: string | null;
  campaign_id: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface IntakeDraftInput {
  title: string;
  description: string;
  listIds: string[];
  fileName: string;
  bytes: Uint8Array;
  idempotencyKey: string | null;
  submittedBy: string;
}

export interface IntakeDraftResult {
  campaignId: string;
  /** True when the idempotency key matched an existing draft — nothing was created or mailed. */
  duplicate: boolean;
  reviewUrl: string;
  /** Whether the admin review email went out (never blocks the draft). */
  notified: boolean;
}

export interface IntakeSweepResult {
  examined: number;
  processed: number;
  failed: number;
  errors: string[];
}
