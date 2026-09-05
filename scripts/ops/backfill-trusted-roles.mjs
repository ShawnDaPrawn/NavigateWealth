#!/usr/bin/env node
/**
 * Backfill trusted roles into app_metadata (SECURITY: PR #106 review P1).
 *
 * The auth middleware no longer honours privileged roles (admin, super_admin,
 * adviser) from client-editable `user_metadata` — only from server-controlled
 * `app_metadata` (or the email allowlists). Existing staff users provisioned
 * before this change have their role ONLY in user_metadata and would lose
 * access. This script copies the role across, once, idempotently.
 *
 * Usage:
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node ./scripts/ops/backfill-trusted-roles.mjs [--dry-run]
 *
 * Only users whose user_metadata.role is a privileged value are touched.
 * Users whose app_metadata.role already matches are skipped.
 */

import { createClient } from '@supabase/supabase-js';

const PRIVILEGED_ROLES = new Set([
  'admin',
  'super_admin',
  'super-admin',
  'adviser',
  'paraplanner',
  'compliance',
  'viewer',
]);

const dryRun = process.argv.includes('--dry-run');
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

let page = 1;
let updated = 0;
let skipped = 0;
let errors = 0;

for (;;) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error(`listUsers page ${page} failed:`, error.message);
    process.exit(1);
  }
  const users = data?.users ?? [];
  if (users.length === 0) break;

  for (const user of users) {
    const metaRole = user.user_metadata?.role;
    const appRole = user.app_metadata?.role;

    if (typeof metaRole !== 'string' || !PRIVILEGED_ROLES.has(metaRole)) continue;

    if (appRole === metaRole) {
      skipped++;
      continue;
    }

    console.log(
      `${dryRun ? '[dry-run] would set' : 'setting'} app_metadata.role=${metaRole} for ${user.email} (${user.id})` +
        (appRole ? ` (was ${appRole})` : ''),
    );

    if (dryRun) {
      updated++;
      continue;
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, role: metaRole },
    });
    if (updateErr) {
      console.error(`  FAILED for ${user.email}:`, updateErr.message);
      errors++;
    } else {
      updated++;
    }
  }

  page++;
}

console.log(
  `\nDone${dryRun ? ' (dry run)' : ''}: ${updated} updated, ${skipped} already correct, ${errors} errors.`,
);
process.exit(errors > 0 ? 1 : 0);
