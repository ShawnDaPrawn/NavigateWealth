#!/usr/bin/env node
/**
 * One-time bootstrap: enable shawn@navigatewealth.co as a personal client test profile.
 *
 * Usage (preferred — calls deployed API as Shawn):
 *   ADMIN_EMAIL=shawn@navigatewealth.co ADMIN_PASSWORD=... node scripts/enable-super-admin-personal-client.mjs
 *
 * Fallback (service role direct KV write when no password available):
 *   node scripts/enable-super-admin-personal-client.mjs --direct
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = 'vpjmdsltwrnpefzcgdmz';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const API_BASE = `${SUPABASE_URL}/functions/v1/make-server-91ed8379`;
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwam1kc2x0d3JucGVmemNnZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDcxNjUsImV4cCI6MjA3NTkyMzE2NX0.JeGS_wxI-iw6Tz2fTIwRMBT59oUEf0g1Q0ySvwhdSRg';
const SUPER_ADMIN_EMAIL = 'shawn@navigatewealth.co';
const useDirect = process.argv.includes('--direct');

function loadEnvLocal() {
  const path = resolve(__dirname, '../e2e/.env.local');
  try {
    const text = readFileSync(path, 'utf8');
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
    return {};
  }
}

function getServiceRoleKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  const out = execSync(
    `npx supabase projects api-keys --project-ref ${PROJECT_REF} -o json`,
    { encoding: 'utf8', cwd: resolve(__dirname, '..') },
  );
  const rows = JSON.parse(out);
  const row = rows.find((r) => r.name === 'service_role');
  if (!row?.api_key) {
    throw new Error('Could not resolve service_role key from Supabase CLI');
  }
  return row.api_key;
}

async function findUserByEmail(supabase, email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function upsertKv(supabase, key, value) {
  const { error } = await supabase.from('kv_store_91ed8379').upsert(
    { key, value },
    { onConflict: 'key' },
  );
  if (error) throw error;
}

async function getKv(supabase, key) {
  const { data, error } = await supabase
    .from('kv_store_91ed8379')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

async function generateApplicationNumber(supabase) {
  const year = new Date().getFullYear();
  const { data, error } = await supabase
    .from('kv_store_91ed8379')
    .select('value')
    .like('key', 'application:%');
  if (error) throw error;

  const apps = (data || [])
    .map((row) => row.value)
    .filter((app) => app?.application_number?.startsWith?.(`APP-${year}-`));

  if (apps.length === 0) {
    return `APP-${year}-0001`;
  }

  const max = Math.max(
    ...apps.map((app) => {
      const match = String(app.application_number).match(/APP-\d{4}-(\d{4})/);
      return match ? parseInt(match[1], 10) : 0;
    }),
  );
  return `APP-${year}-${String(max + 1).padStart(4, '0')}`;
}

async function findApplicationByUserId(supabase, userId) {
  const { data, error } = await supabase
    .from('kv_store_91ed8379')
    .select('key, value')
    .like('key', 'application:%');
  if (error) throw error;

  const matches = (data || [])
    .map((row) => row.value)
    .filter(
      (app) =>
        app &&
        app.user_id === userId &&
        app.deprecated !== true &&
        !('stepNumber' in app),
    )
    .sort(
      (a, b) =>
        new Date(String(b.updated_at || b.created_at || 0)).getTime() -
        new Date(String(a.updated_at || a.created_at || 0)).getTime(),
    );

  return matches[0] || null;
}

async function signIn(email, password) {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return data.session.access_token;
}

async function enableViaApi(token) {
  const res = await fetch(`${API_BASE}/profile/super-admin/enable-personal-client`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Enable failed (${res.status}): ${body.error || JSON.stringify(body)}`);
  }
  return body;
}

async function enableDirect() {
  const serviceKey = getServiceRoleKey();
  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const superAdminUser = await findUserByEmail(supabase, SUPER_ADMIN_EMAIL);
  if (!superAdminUser) {
    throw new Error(`Super admin user not found: ${SUPER_ADMIN_EMAIL}`);
  }

  const userId = superAdminUser.id;
  const profileKey = `user_profile:${userId}:personal_info`;
  const existingProfile = (await getKv(supabase, profileKey)) || {};
  const now = new Date().toISOString();

  const metadataName = String(superAdminUser.user_metadata?.name || '').trim();
  const nameParts = metadataName.split(/\s+/).filter(Boolean);
  const defaultFirstName = nameParts[0] || 'Shawn';
  const defaultLastName = nameParts.slice(1).join(' ') || 'Francisco';
  const personalInfo = existingProfile.personalInformation || {};

  let existingApp = await findApplicationByUserId(supabase, userId);
  let applicationId;
  let applicationNumber;

  if (existingApp?.id) {
    applicationId = String(existingApp.id);
    applicationNumber = String(existingApp.application_number || existingProfile.applicationNumber || '');
    existingApp = {
      ...existingApp,
      user_id: userId,
      status: 'approved',
      origin: existingApp.origin || 'super_admin_test',
      updated_at: now,
      reviewed_at: now,
      reviewed_by: userId,
      review_notes: 'Super admin personal client testing profile',
    };
    await upsertKv(supabase, `application:${applicationId}`, existingApp);
  } else {
    applicationId = randomUUID();
    applicationNumber = await generateApplicationNumber(supabase);
    await upsertKv(supabase, `application:${applicationId}`, {
      id: applicationId,
      application_number: applicationNumber,
      user_id: userId,
      status: 'approved',
      origin: 'super_admin_test',
      created_at: now,
      updated_at: now,
      submitted_at: now,
      reviewed_at: now,
      reviewed_by: userId,
      review_notes: 'Super admin personal client testing profile',
      application_data: {
        firstName: String(personalInfo.firstName || defaultFirstName),
        lastName: String(personalInfo.lastName || defaultLastName),
        emailAddress: superAdminUser.email,
        cellphoneNumber: String(personalInfo.cellphone || ''),
        nationality: 'South Africa',
        residentialCountry: 'South Africa',
        accountReasons: [],
        existingProducts: [],
        termsAccepted: true,
        popiaConsent: true,
        disclosureAcknowledged: true,
        accountType: 'Personal Client',
      },
    });
  }

  const updatedProfile = {
    ...existingProfile,
    profileType: 'personal',
    userId,
    email: superAdminUser.email,
    role: 'super_admin',
    accountStatus: 'approved',
    accountType: 'Personal Client',
    applicationStatus: 'approved',
    applicationId,
    applicationNumber,
    personalClientEnabled: true,
    adviserAssigned: true,
    personalInformation: {
      ...personalInfo,
      firstName: String(personalInfo.firstName || defaultFirstName),
      lastName: String(personalInfo.lastName || defaultLastName),
      email: superAdminUser.email,
      cellphone: String(personalInfo.cellphone || ''),
      nationality: String(personalInfo.nationality || 'South Africa'),
      identityDocuments: Array.isArray(personalInfo.identityDocuments)
        ? personalInfo.identityDocuments
        : [],
    },
    createdAt: existingProfile.createdAt || now,
    updatedAt: now,
  };

  await upsertKv(supabase, profileKey, updatedProfile);

  return {
    success: true,
    enabled: true,
    userId,
    applicationId,
    applicationNumber,
    mode: 'direct',
  };
}

async function main() {
  if (useDirect) {
    console.log('Enabling super admin personal client profile (direct KV bootstrap)...');
    const body = await enableDirect();
    console.log('Success:', body);
    return;
  }

  const envLocal = loadEnvLocal();
  const email = process.env.ADMIN_EMAIL || envLocal.E2E_ADMIN_EMAIL || SUPER_ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || envLocal.E2E_ADMIN_PASSWORD;

  if (!password) {
    console.log('No admin password found — falling back to direct service-role bootstrap...');
    const body = await enableDirect();
    console.log('Success:', body);
    return;
  }

  if (email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error(`This script only supports ${SUPER_ADMIN_EMAIL}, got ${email}`);
  }

  console.log(`Signing in as ${email}...`);
  const token = await signIn(email, password);

  console.log('Enabling super admin personal client profile via API...');
  const body = await enableViaApi(token);
  console.log('Success:', {
    userId: body.userId,
    applicationId: body.applicationId,
    applicationNumber: body.applicationNumber,
    enabled: body.enabled,
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
