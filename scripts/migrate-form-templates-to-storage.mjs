#!/usr/bin/env node
/**
 * Migrate legacy form template PDF blobs from KV (form_template:{id}:file)
 * to Supabase Storage (make-91ed8379-documents/form-templates/...).
 *
 * Usage (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   node scripts/migrate-form-templates-to-storage.mjs
 *   node scripts/migrate-form-templates-to-storage.mjs --dry-run
 *   node scripts/migrate-form-templates-to-storage.mjs --delete-kv-after
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = 'vpjmdsltwrnpefzcgdmz';
const KV_TABLE = 'kv_store_91ed8379';
const BUCKET = 'make-91ed8379-documents';
const TEMPLATE_PREFIX = 'form_template:';
const LIST_KEY = `${TEMPLATE_PREFIX}list`;

const dryRun = process.argv.includes('--dry-run');
const deleteKvAfter = process.argv.includes('--delete-kv-after');

function loadEnvLocal() {
  for (const rel of ['../.env.local', '../e2e/.env.local']) {
    try {
      const text = readFileSync(resolve(__dirname, rel), 'utf8');
      const env = {};
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
      }
      return env;
    } catch {
      // try next
    }
  }
  return {};
}

async function kvGet(supabase, key) {
  const { data, error } = await supabase.from(KV_TABLE).select('value').eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value ?? null;
}

async function kvSet(supabase, key, value) {
  const { error } = await supabase.from(KV_TABLE).upsert({ key, value });
  if (error) throw new Error(error.message);
}

async function kvDelete(supabase, key) {
  const { error } = await supabase.from(KV_TABLE).delete().eq('key', key);
  if (error) throw new Error(error.message);
}

async function main() {
  const env = loadEnvLocal();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || env.SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`;
  if (!serviceKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY to run migration');
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const list = (await kvGet(supabase, LIST_KEY)) || [];
  const ids = Array.isArray(list) ? list : [];

  console.log(`[migrate-form-templates] Found ${ids.length} template(s)`);

  let migrated = 0;
  let skipped = 0;

  for (const id of ids) {
    const meta = await kvGet(supabase, `${TEMPLATE_PREFIX}${id}`);
    const fileRecord = await kvGet(supabase, `${TEMPLATE_PREFIX}${id}:file`);
    if (!meta || !fileRecord?.base64Content) {
      skipped += 1;
      continue;
    }
    if (meta.storagePath && !String(meta.storagePath).endsWith(':file')) {
      skipped += 1;
      continue;
    }

    const bytes = Uint8Array.from(atob(fileRecord.base64Content), (c) => c.charCodeAt(0));
    const storagePath = `form-templates/${id}/${meta.fileName || 'template.pdf'}`;

    console.log(`  ${id} → ${storagePath} (${bytes.length} bytes)`);

    if (!dryRun) {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
        contentType: meta.mimeType || 'application/pdf',
        upsert: true,
      });
      if (uploadError) throw new Error(`Upload failed for ${id}: ${uploadError.message}`);

      await kvSet(supabase, `${TEMPLATE_PREFIX}${id}`, {
        ...meta,
        storagePath,
        updatedAt: new Date().toISOString(),
      });

      if (deleteKvAfter) {
        await kvDelete(supabase, `${TEMPLATE_PREFIX}${id}:file`);
      }
    }

    migrated += 1;
  }

  console.log(`[migrate-form-templates] done migrated=${migrated} skipped=${skipped} dryRun=${dryRun}`);
  if (!dryRun && migrated > 0 && deleteKvAfter) {
    console.log('[migrate-form-templates] Set FORM_TEMPLATE_ALLOW_KV_FALLBACK=false on Edge Function after verifying fills.');
  }
}

main().catch((err) => {
  console.error('[migrate-form-templates] ERROR', err.message || err);
  process.exit(1);
});
