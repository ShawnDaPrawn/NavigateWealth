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
import { sleep } from './publications-notification-state.ts';
import {
  newsletterCampaigns,
  newsletterIntakeReservations,
} from './repositories/newsletter-studio-repository.ts';
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

/**
 * Which issue a hand-over is for.
 *
 * A routine's idempotency key is documented as the issue month (`2026-09`),
 * so when it looks like one it IS one — without this, a September hand-over
 * swept on 1 October files under October and publishes into the wrong month
 * of the website archive (review finding). An explicit field still wins, and
 * a key in any other shape falls through to the create-time default.
 */
export function resolveIntakeIssueMonth(input: {
  issueMonth?: string | null;
  idempotencyKey: string | null;
}): string | undefined {
  const explicit = (input.issueMonth ?? '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(explicit)) return explicit;
  const key = (input.idempotencyKey ?? '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return key;
  return undefined;
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

// ── Idempotency ──────────────────────────────────────────────────────────────

/** Settle window after writing a reservation before reading it back (the lease's 80 ms). */
export const RESERVATION_SETTLE_MS = 80;
/** How long a losing concurrent hand-over waits for the winner to record its draft. */
const RESERVATION_WAIT_MS = 250;
const RESERVATION_WAIT_ATTEMPTS = 12;

type Reservation = { owned: true } | { owned: false; campaignId: string | null };

/**
 * Claim an idempotency key, or learn who already holds it.
 *
 * KV has no unique constraint, so a plain "look up, then create" lets two
 * overlapping submissions with the same key both pass the lookup and both
 * create a draft (review finding). Instead the key is reserved with a nonce,
 * settled, and read back — the same optimistic write → settle → read-back
 * the campaign lease uses. Exactly one writer sees its own nonce.
 */
async function reserveIntakeKey(key: string): Promise<Reservation> {
  const existing = await newsletterIntakeReservations.get(key);
  if (existing) return { owned: false, campaignId: existing.campaignId };

  const nonce = crypto.randomUUID();
  await newsletterIntakeReservations.put(key, {
    key,
    nonce,
    campaignId: null,
    createdAt: new Date().toISOString(),
  });
  await sleep(RESERVATION_SETTLE_MS);

  const settled = await newsletterIntakeReservations.get(key);
  if (!settled || settled.nonce !== nonce) {
    return { owned: false, campaignId: settled?.campaignId ?? null };
  }
  return { owned: true };
}

/** The draft an earlier hand-over with this key produced, once it has one. */
async function awaitReservedCampaign(key: string, known: string | null): Promise<string | null> {
  if (known) return known;
  for (let attempt = 0; attempt < RESERVATION_WAIT_ATTEMPTS; attempt++) {
    await sleep(RESERVATION_WAIT_MS);
    const reservation = await newsletterIntakeReservations.get(key);
    if (reservation?.campaignId) return reservation.campaignId;
    // The winner gave up (its PDF was rejected) and released the key.
    if (!reservation) return null;
  }
  // Drafts created before reservations existed carry the key on the campaign only.
  return (await findCampaignBySourceRef(key))?.id ?? null;
}

async function duplicateOutcome(campaignId: string): Promise<IntakeDraftResult> {
  const existing = await newsletterCampaigns.get(campaignId);
  return {
    campaignId,
    duplicate: true,
    reviewUrl: buildReviewUrl(campaignId),
    notified: Boolean(existing?.reviewNotifiedAt),
  };
}

/**
 * Create the draft, store the PDF and notify the admin. A repeated
 * idempotency key returns the existing draft and sends nothing, even when
 * the repeat overlaps the original.
 */
export async function createDraftFromIntake(input: IntakeDraftInput): Promise<IntakeDraftResult> {
  const key = input.idempotencyKey;
  if (key) {
    // Drafts from before reservations existed: the key lives on the campaign only.
    const legacy = await findCampaignBySourceRef(key);
    if (legacy) {
      log.info('Intake replay matched an existing draft', { campaignId: legacy.id, key });
      return duplicateOutcome(legacy.id);
    }
    const reservation = await reserveIntakeKey(key);
    if (!reservation.owned) {
      const campaignId = await awaitReservedCampaign(key, reservation.campaignId);
      if (!campaignId) {
        throw new ValidationError(
          `A hand-over with idempotency key "${key}" is already in progress; retry in a moment`,
        );
      }
      log.info('Intake replay matched an existing draft', { campaignId, key });
      return duplicateOutcome(campaignId);
    }
  }

  const listNames: string[] = [];
  try {
    listNames.push(...(await assertKnownLists(input.listIds)));
  } catch (error) {
    if (key) await newsletterIntakeReservations.remove(key).catch(() => {});
    throw error;
  }

  const draft = await createCampaign(
    {
      title: input.title,
      description: input.description,
      listIds: input.listIds,
      issueMonth: resolveIntakeIssueMonth(input),
      source: 'routine',
      sourceRef: input.idempotencyKey,
    },
    `routine:${input.submittedBy}`,
  );

  let withPdf;
  try {
    withPdf = await attachCampaignPdf(draft.id, { bytes: input.bytes, fileName: input.fileName });
  } catch (error) {
    // Never leave a PDF-less routine draft behind for the admin to trip over,
    // and release the key so a corrected hand-over can reuse it.
    await newsletterCampaigns.remove(draft.id).catch(() => {});
    if (key) await newsletterIntakeReservations.remove(key).catch(() => {});
    throw error;
  }
  if (key) {
    const reservation = await newsletterIntakeReservations.get(key);
    await newsletterIntakeReservations.put(key, {
      key,
      nonce: reservation?.nonce ?? '',
      campaignId: draft.id,
      createdAt: reservation?.createdAt ?? new Date().toISOString(),
    });
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
