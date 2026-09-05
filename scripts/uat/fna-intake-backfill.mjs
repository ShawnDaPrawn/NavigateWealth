#!/usr/bin/env node
/**
 * Backfill fna-intake:session:* KV records into public.fna_intake_sessions.
 *
 * Usage:
 *   node scripts/uat/fna-intake-backfill.mjs [--dry-run]
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');
const prefix = 'fna-intake:session:';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

function toRow(session) {
  return {
    id: session.id,
    client_id: session.clientId,
    domain: session.domain,
    status: session.status,
    inputs: session.inputs ?? {},
    progress_percent: session.progressPercent ?? 0,
    consent_accepted_at: session.consentAcceptedAt ?? null,
    consent_text_version: session.consentTextVersion ?? null,
    submitted_at: session.submittedAt ?? null,
    submitted_by: session.submittedBy ?? null,
    accepted_at: session.acceptedAt ?? null,
    accepted_by: session.acceptedBy ?? null,
    linked_fna_id: session.linkedFnaId ?? null,
    request_info_at: session.requestInfoAt ?? null,
    intake_source: session.intakeSource ?? 'client',
    created_at: session.createdAt ?? new Date().toISOString(),
    updated_at: session.updatedAt ?? new Date().toISOString(),
  };
}

async function main() {
  const { data: kvRows, error: kvError } = await supabase
    .from('kv_store_91ed8379')
    .select('key, value')
    .like('key', `${prefix}%`);

  if (kvError) {
    console.error('KV scan failed:', kvError.message);
    process.exit(1);
  }

  const sessions = (kvRows ?? [])
    .map((row) => row.value)
    .filter((v) => v && typeof v === 'object' && v.id && v.clientId && v.domain);

  console.log(`Found ${sessions.length} intake session KV records`);

  if (dryRun) {
    sessions.slice(0, 5).forEach((s) => console.log('  sample:', s.id, s.domain, s.status));
    return;
  }

  let upserted = 0;
  for (const session of sessions) {
    const row = toRow(session);
    const { error } = await supabase.from('fna_intake_sessions').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error(`Failed ${session.id}:`, error.message);
    } else {
      upserted += 1;
    }
  }

  console.log(`Upserted ${upserted}/${sessions.length} sessions into fna_intake_sessions`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
