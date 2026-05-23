#!/usr/bin/env node
/**
 * API smoke test for Form Prefill routes (/prefill/*).
 * Verifies deployed Edge Function exposes resolver endpoints with auth.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = 'vpjmdsltwrnpefzcgdmz';
const API_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1/make-server-91ed8379`;
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwam1kc2x0d3JucGVmemNnZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDcxNjUsImV4cCI6MjA3NTkyMzE2NX0.JeGS_wxI-iw6Tz2fTIwRMBT59oUEf0g1Q0ySvwhdSRg';

const EXPECTED_FORM_IDS = [
  'retirement-fna-step1',
  'risk-fna-step1',
  'medical-fna-step1',
  'tax-fna-step1',
  'estate-fna-step1',
  'investment-ina-step1',
];

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

async function main() {
  const env = loadEnvLocal();
  const adviserEmail = process.env.E2E_FNA_ADVISER_EMAIL || env.E2E_FNA_ADVISER_EMAIL;
  const adviserPassword = process.env.E2E_FNA_ADVISER_PASSWORD || env.E2E_FNA_ADVISER_PASSWORD;
  const clientId = process.env.E2E_FNA_CLIENT_ID || env.E2E_FNA_CLIENT_ID;

  if (!adviserEmail || !adviserPassword || !clientId) {
    throw new Error('Set E2E_FNA_ADVISER_* and E2E_FNA_CLIENT_ID (or run fna-intake-bootstrap-uat-actors.mjs)');
  }

  const adviserToken = await signIn(adviserEmail, adviserPassword);
  const report = { timestamp: new Date().toISOString(), steps: {}, resolve: {} };

  const formsRes = await apiFetch(adviserToken, '/prefill/forms');
  const formIds = formsRes.body?.data ?? [];
  report.steps.listForms =
    formsRes.status === 200 &&
    Array.isArray(formIds) &&
    EXPECTED_FORM_IDS.every((id) => formIds.includes(id));
  if (!report.steps.listForms) {
    throw new Error(`GET /prefill/forms failed: ${formsRes.status} ${JSON.stringify(formsRes.body)}`);
  }

  for (const formId of EXPECTED_FORM_IDS) {
    const resolveRes = await apiFetch(adviserToken, '/prefill/resolve', {
      method: 'POST',
      body: JSON.stringify({
        clientId,
        formId,
        currentFormValues: {},
      }),
    });
    const stepKey = `resolve_${formId.replace(/-/g, '_')}`;
    const ok =
      resolveRes.status === 200 &&
      resolveRes.body?.success &&
      resolveRes.body?.data?.formId === formId &&
      typeof resolveRes.body?.data?.resolverVersion === 'string';
    report.steps[stepKey] = ok;
    report.resolve[formId] = {
      status: resolveRes.status,
      matchCount: resolveRes.body?.data?.matches?.length ?? 0,
      resolverVersion: resolveRes.body?.data?.resolverVersion,
    };
    if (!ok) {
      throw new Error(`POST /prefill/resolve (${formId}) failed: ${resolveRes.status} ${JSON.stringify(resolveRes.body)}`);
    }
  }

  const auditRes = await apiFetch(adviserToken, `/prefill/audit/${encodeURIComponent(clientId)}`);
  report.steps.auditList =
    auditRes.status === 200 && auditRes.body?.success && Array.isArray(auditRes.body?.data);

  const applyAuditRes = await apiFetch(adviserToken, '/prefill/apply-audit', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      formId: 'retirement-fna-step1',
      appliedFields: ['currentAge'],
      resolverVersion: report.resolve['retirement-fna-step1']?.resolverVersion ?? 'smoke',
    }),
  });
  report.steps.applyAudit =
    applyAuditRes.status === 200 &&
    applyAuditRes.body?.success &&
    typeof applyAuditRes.body?.data?.auditKey === 'string';

  const templatesRes = await apiFetch(adviserToken, '/form-templates');
  report.steps.listFormTemplates =
    templatesRes.status === 200 &&
    templatesRes.body?.success &&
    Array.isArray(templatesRes.body?.data);

  if (templatesRes.body?.data?.length > 0) {
    const templateId = templatesRes.body.data[0].id;
    const previewRes = await apiFetch(adviserToken, `/form-templates/${templateId}/preview`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
    report.steps.templatePreview =
      previewRes.status === 200 &&
      previewRes.body?.success &&
      Array.isArray(previewRes.body?.data?.matches);
  } else {
    report.steps.templatePreview = true;
    report.templatePreviewSkipped = 'no templates uploaded';
  }

  report.pass = Object.values(report.steps).every(Boolean);
  console.log('[form-prefill-smoke]', report.pass ? 'PASS' : 'FAIL', report);

  const outDir = resolve(__dirname, '../tmp');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'form-prefill-smoke-report.json'), JSON.stringify(report, null, 2));

  if (!report.pass) process.exit(1);
}

main().catch((err) => {
  console.error('[form-prefill-smoke] ERROR', err.message || err);
  process.exit(1);
});
