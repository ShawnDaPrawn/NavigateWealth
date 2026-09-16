/**
 * Newsletter intake — turning a routine's hand-over into a draft.
 *
 * `createDraftFromIntake` is the one path both entrances share: the HTTPS
 * endpoint (newsletter-intake-routes.ts) and the SQL sweep below, which the
 * cron tick runs for routines that only have the Supabase connector. Either
 * way the result is a `source: 'routine'` draft the admin must approve, and
 * one "draft ready" email.
 *
 * TABLE ACCESS
 * ------------
 * `public.newsletter_intake` is a real Postgres table (migration
 * `newsletter_intake`), read through a lazy service-role client the way
 * social-assets-service.ts reads its tables — not through KV. The sweep only
 * ever touches the partial index on `status = 'pending'`, so an idle tick
 * costs one index probe (docs/STATUS.md: scheduled work must not scan a
 * namespace to find nothing).
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError } from './error.middleware.ts';
import {
  attachCampaignPdf,
  createCampaign,
  findCampaignBySourceRef,
} from './newsletter-studio-service.ts';
import { listAudienceLists } from './newsletter-studio-audience.ts';
import { newsletterCampaigns } from './repositories/newsletter-studio-repository.ts';
import { decodePdfBase64 } from './newsletter-studio-storage.ts';
import {
  buildReviewUrl,
  sendNewsletterDraftReviewNotification,
} from './newsletter-intake-notify.ts';
import {
  INTAKE_SWEEP_LIMIT,
  NEWSLETTER_INTAKE_TABLE,
  type IntakeDraftInput,
  type IntakeDraftResult,
  type IntakeSweepResult,
  type NewsletterIntakeRow,
} from './newsletter-intake-types.ts';

const log = createModuleLogger('newsletter-intake');

let _client: SupabaseClient | null = null;

/** Lazy service-role client — never constructed at module top level. */
function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: 'public' } },
  );
  return _client;
}

/** Test hook. */
export function resetIntakeClient(): void {
  _client = null;
}

/** The audiences a routine may name, so an unknown id gets a helpful 400. */
export async function assertKnownLists(listIds: string[]): Promise<string[]> {
  const lists = await listAudienceLists();
  const known = new Set(lists.map((l) => l.id));
  const unknown = listIds.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new ValidationError(
      `Unknown audience id(s): ${unknown.join(', ')}. Valid ids: ${[...known].join(', ')}`,
    );
  }
  return listIds.map((id) => lists.find((l) => l.id === id)?.name ?? id);
}

/**
 * Create the draft, store the PDF and notify the admin. A repeated
 * idempotency key returns the existing draft and sends nothing.
 */
export async function createDraftFromIntake(input: IntakeDraftInput): Promise<IntakeDraftResult> {
  if (input.idempotencyKey) {
    const existing = await findCampaignBySourceRef(input.idempotencyKey);
    if (existing) {
      log.info('Intake replay matched an existing draft', {
        campaignId: existing.id,
        idempotencyKey: input.idempotencyKey,
      });
      return {
        campaignId: existing.id,
        duplicate: true,
        reviewUrl: buildReviewUrl(existing.id),
        notified: Boolean(existing.reviewNotifiedAt),
      };
    }
  }

  const listNames = await assertKnownLists(input.listIds);

  const draft = await createCampaign(
    {
      title: input.title,
      description: input.description,
      listIds: input.listIds,
      source: 'routine',
      sourceRef: input.idempotencyKey,
    },
    `routine:${input.submittedBy}`,
  );

  let withPdf;
  try {
    withPdf = await attachCampaignPdf(draft.id, { bytes: input.bytes, fileName: input.fileName });
  } catch (error) {
    // Never leave a PDF-less routine draft behind for the admin to trip over.
    await newsletterCampaigns.remove(draft.id).catch(() => {});
    throw error;
  }

  const notified = await sendNewsletterDraftReviewNotification({
    campaignId: draft.id,
    title: input.title,
    description: input.description,
    fileName: withPdf.pdf?.fileName ?? input.fileName,
    sizeBytes: withPdf.pdf?.sizeBytes ?? input.bytes.length,
    listNames,
    submittedBy: input.submittedBy,
  });
  if (notified) {
    const latest = await newsletterCampaigns.get(draft.id);
    if (latest) {
      await newsletterCampaigns.put(draft.id, {
        ...latest,
        reviewNotifiedAt: new Date().toISOString(),
      });
    }
  }

  log.info('Routine draft created', {
    campaignId: draft.id,
    submittedBy: input.submittedBy,
    notified,
  });
  return { campaignId: draft.id, duplicate: false, reviewUrl: buildReviewUrl(draft.id), notified };
}

// ── SQL sweep ────────────────────────────────────────────────────────────────

/** Postgres "relation does not exist" — the migration has not been applied yet. */
const UNDEFINED_TABLE = '42P01';
let warnedTableMissing = false;

async function markRow(
  id: string,
  patch: Partial<Pick<NewsletterIntakeRow, 'status' | 'error' | 'campaign_id'>>,
): Promise<void> {
  const { error } = await getSupabase()
    .from(NEWSLETTER_INTAKE_TABLE)
    .update({
      ...patch,
      pdf_base64: null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(`newsletter_intake update failed: ${error.message}`);
}

/**
 * Promote pending intake rows into drafts. Bounded to INTAKE_SWEEP_LIMIT per
 * call; a missing table is logged once and treated as "nothing pending" so
 * the tick keeps working before the migration lands.
 */
export async function sweepNewsletterIntake(): Promise<IntakeSweepResult> {
  const result: IntakeSweepResult = { examined: 0, processed: 0, failed: 0, errors: [] };

  const { data, error } = await getSupabase()
    .from(NEWSLETTER_INTAKE_TABLE)
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(INTAKE_SWEEP_LIMIT);
  if (error) {
    if (error.code === UNDEFINED_TABLE) {
      if (!warnedTableMissing) {
        warnedTableMissing = true;
        log.warn('newsletter_intake table not found — apply the newsletter_intake migration');
      }
      return result;
    }
    throw new Error(`newsletter_intake read failed: ${error.message}`);
  }

  const rows = (data ?? []) as NewsletterIntakeRow[];
  result.examined = rows.length;

  for (const row of rows) {
    try {
      if (!row.pdf_base64) throw new Error('pdf_base64 is empty');
      const outcome = await createDraftFromIntake({
        title: row.title,
        description: row.description,
        listIds: row.list_ids?.length ? row.list_ids : ['sys_newsletter_contacts'],
        fileName: row.file_name || 'newsletter.pdf',
        bytes: decodePdfBase64(row.pdf_base64),
        idempotencyKey: row.idempotency_key,
        submittedBy: row.submitted_by || 'routine',
      });
      await markRow(row.id, { status: 'processed', campaign_id: outcome.campaignId, error: null });
      result.processed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed++;
      result.errors.push(`intake ${row.id}: ${message}`);
      log.error('Intake row failed', { rowId: row.id, message });
      await markRow(row.id, { status: 'failed', error: message.slice(0, 1000) }).catch((e) =>
        log.error('Could not mark intake row failed', { rowId: row.id, error: String(e) }),
      );
    }
  }

  return result;
}
