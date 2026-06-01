#!/usr/bin/env node
/**
 * API-level FNA intake UAT — all six domains, draft → submit → accept.
 * Outputs JSON report for scripts/fna-intake-uat-report.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOMAINS = ['risk', 'medical', 'retirement', 'investment', 'tax', 'estate'];
const PROJECT_REF = 'vpjmdsltwrnpefzcgdmz';
const API_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1/make-server-91ed8379`;
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwam1kc2x0d3JucGVmemNnZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDcxNjUsImV4cCI6MjA3NTkyMzE2NX0.JeGS_wxI-iw6Tz2fTIwRMBT59oUEf0g1Q0ySvwhdSRg';

function loadEnvLocal() {
  const path = resolve(__dirname, '../e2e/.env.local');
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
}

function getServiceRoleKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  const out = execSync(`npx supabase projects api-keys --project-ref ${PROJECT_REF} -o json`, {
    encoding: 'utf8',
    cwd: resolve(__dirname, '..'),
  });
  const row = JSON.parse(out).find((r) => r.name === 'service_role');
  if (!row?.api_key) throw new Error('Could not resolve service_role key');
  return row.api_key;
}

async function clearUatRateLimits(clientId) {
  const supabase = createClient(`https://${PROJECT_REF}.supabase.co`, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const suffix of ['draft', 'submit']) {
    const key = `rate_limit:fna-intake:${suffix}:${clientId}`;
    await supabase.from('kv_store_91ed8379').delete().eq('key', key);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(email, password) {
  const supabase = createClient(`https://${PROJECT_REF}.supabase.co`, ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return data.session.access_token;
}

async function apiFetch(token, path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function runDomainUat({ domain, clientToken, adviserToken, clientId }) {
  const steps = {};

  const draftRes = await apiFetch(clientToken, `/fna-intake/${domain}/draft/${clientId}`, {
    method: 'PUT',
    body: JSON.stringify({
      inputs: { uatDomain: domain, uatSmoke: true, currentAge: 40 },
    }),
  });
  steps.draftSubmit = draftRes.status === 200 && draftRes.body?.success;
  if (!steps.draftSubmit) {
    return {
      domain,
      pass: false,
      steps,
      error: `draft failed: ${draftRes.status} ${JSON.stringify(draftRes.body)}`,
    };
  }

  const sessionId = draftRes.body.data?.id;
  const submitRes = await apiFetch(clientToken, `/fna-intake/session/${sessionId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ consentAccepted: true }),
  });
  steps.clientSubmit = submitRes.status === 200 && submitRes.body?.success;
  if (!steps.clientSubmit) {
    return { domain, pass: false, steps, error: `submit failed: ${submitRes.status}` };
  }

  steps.consentStored =
    Boolean(submitRes.body?.data?.consentAcceptedAt) || Boolean(submitRes.body?.data?.submittedAt);

  const queueRes = await apiFetch(adviserToken, '/fna-intake/queue/list');
  steps.adviserQueue =
    queueRes.status === 200 &&
    Array.isArray(queueRes.body?.data) &&
    queueRes.body.data.some((s) => s.id === sessionId);
  if (!steps.adviserQueue) {
    return { domain, pass: false, steps, error: 'queue list missing session' };
  }

  const acceptRes = await apiFetch(adviserToken, `/fna-intake/session/${sessionId}/accept`, {
    method: 'POST',
  });
  steps.acceptPrefill =
    acceptRes.status === 200 &&
    acceptRes.body?.success &&
    Boolean(acceptRes.body?.data?.linkedFnaId);
  if (!steps.acceptPrefill) {
    return { domain, pass: false, steps, error: `accept failed: ${acceptRes.status}` };
  }

  const acceptAgain = await apiFetch(adviserToken, `/fna-intake/session/${sessionId}/accept`, {
    method: 'POST',
  });
  steps.acceptIdempotent =
    acceptAgain.status === 200 &&
    acceptAgain.body?.success &&
    acceptAgain.body?.data?.linkedFnaId === acceptRes.body.data.linkedFnaId;

  const statusRes = await apiFetch(clientToken, `/fna-intake/${domain}/status/${clientId}`);
  steps.readOnlyOrAccepted =
    statusRes.status === 200 &&
    (statusRes.body?.data?.status === 'accepted' || statusRes.body?.data === null);

  const pass = Object.values(steps).every(Boolean);
  console.log(`[${domain}] ${pass ? 'PASS' : 'FAIL'}`, steps);
  return { domain, pass, steps, linkedFnaId: acceptRes.body?.data?.linkedFnaId };
}

async function main() {
  const env = loadEnvLocal();
  const {
    E2E_FNA_CLIENT_EMAIL: clientEmail,
    E2E_FNA_CLIENT_PASSWORD: clientPassword,
    E2E_FNA_ADVISER_EMAIL: adviserEmail,
    E2E_FNA_ADVISER_PASSWORD: adviserPassword,
    E2E_FNA_CLIENT_ID: clientId,
  } = env;

  if (!clientEmail || !clientPassword || !adviserEmail || !adviserPassword || !clientId) {
    throw new Error('Run scripts/fna-intake-bootstrap-uat-actors.mjs first');
  }

  const clientToken = await signIn(clientEmail, clientPassword);
  const adviserToken = await signIn(adviserEmail, adviserPassword);

  const results = [];
  for (const domain of DOMAINS) {
    await clearUatRateLimits(clientId);
    results.push(await runDomainUat({ domain, clientToken, adviserToken, clientId }));
    await sleep(300);
  }

  const allPass = results.every((r) => r.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    allPass,
    domains: results,
  };

  const outDir = resolve(__dirname, '../tmp');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'fna-intake-uat-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Report: ${outPath}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
