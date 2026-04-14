const DEFAULT_API_BASE = 'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/integrations';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`Usage:
  npm run provider:sync -- --job-id <portal-job-id> --auth-token <admin-session-token>
  npm run provider:sync -- --mode discover --job-id <portal-job-id> --auth-token <admin-session-token>
  npm run provider:sync -- --mode dry-run --job-id <portal-job-id> --auth-token <admin-session-token>

Environment:
  NW_API_AUTH_TOKEN                    Admin session token for Navigate Wealth API access
  NW_PORTAL_JOB_ID                     Portal job id, if not passed as --job-id
  NW_PORTAL_MODE                       run, discover, or dry-run
  NW_PORTAL_FORCE_STAGE=1              Allow staging without a prior dry-run-ready job
  NW_PROVIDER_ALLAN_GRAY_USERNAME      Allan Gray username
  NW_PROVIDER_ALLAN_GRAY_PASSWORD      Allan Gray password
  NW_PLAYWRIGHT_HEADED=1               Optional visible browser mode
`);
  process.exit(0);
}

const apiBase = String(args['api-base'] || process.env.NW_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '');
const authToken = String(args['auth-token'] || process.env.NW_API_AUTH_TOKEN || '');
const jobId = String(args['job-id'] || process.env.NW_PORTAL_JOB_ID || '');
const headed = Boolean(args.headed || process.env.NW_PLAYWRIGHT_HEADED === '1');
const maxPages = Number(args['max-pages'] || process.env.NW_PLAYWRIGHT_MAX_PAGES || 20);
const mode = String(args.mode || process.env.NW_PORTAL_MODE || 'run');
const forceStage = Boolean(args['force-stage'] || process.env.NW_PORTAL_FORCE_STAGE === '1');

if (!['run', 'discover', 'dry-run'].includes(mode)) {
  throw new Error('--mode must be run, discover, or dry-run.');
}

if (!jobId) {
  throw new Error('Missing --job-id or NW_PORTAL_JOB_ID.');
}

if (!authToken) {
  throw new Error('Missing --auth-token or NW_API_AUTH_TOKEN. Use an admin session token; do not paste provider passwords here.');
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

async function updateJob(status, patch = {}) {
  return apiFetch(`/portal-jobs/${jobId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, ...patch }),
  });
}

async function visibleLocator(pageOrLocator, selector, timeout = 30000) {
  const locator = pageOrLocator.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout });
  return locator;
}

async function firstVisibleSelector(page, selectors, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      try {
        const locator = page.locator(selector).first();
        if (await locator.isVisible({ timeout: 500 }).catch(() => false)) {
          return selector;
        }
      } catch {
        // Keep polling; provider pages often re-render during login.
      }
    }
    await page.waitForTimeout(1000);
  }
  return null;
}

async function waitForManualOtp(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const data = await apiFetch(`/portal-jobs/${jobId}/otp`);
    if (data.otp) return data.otp;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error('Timed out waiting for manual OTP.');
}

async function postDiscoveryReport(report) {
  return apiFetch(`/portal-jobs/${jobId}/discovery-report`, {
    method: 'POST',
    body: JSON.stringify(report),
  });
}

async function captureDiscoveryReport(page, flow, options = {}) {
  const report = await page.evaluate(() => {
    const safeCommonText = /^(log in|login|sign in|continue|verify|submit|next|previous|clients?|investors?|policies|policy details|investments?|portfolio|search|filter|view|details|statements?|download|export)$/i;
    const getStableLabel = (el) => {
      const attrLabel = el.getAttribute('aria-label')
        || el.getAttribute('title')
        || el.getAttribute('placeholder')
        || el.getAttribute('name')
        || el.getAttribute('id')
        || '';
      if (attrLabel) return attrLabel.slice(0, 120);
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      return safeCommonText.test(text) ? text.slice(0, 120) : '';
    };
    const escapeValue = (value) => CSS.escape(String(value));
    const selectorFor = (el) => {
      const tag = el.tagName.toLowerCase();
      const testId = el.getAttribute('data-testid');
      const id = el.getAttribute('id');
      const name = el.getAttribute('name');
      const aria = el.getAttribute('aria-label');
      const type = el.getAttribute('type');
      if (testId) return `[data-testid="${escapeValue(testId)}"]`;
      if (id) return `#${escapeValue(id)}`;
      if (name) return `${tag}[name="${escapeValue(name)}"]`;
      if (aria) return `${tag}[aria-label="${escapeValue(aria)}"]`;
      if (type) return `${tag}[type="${escapeValue(type)}"]`;
      const siblings = Array.from((el.parentElement || document.body).children).filter((child) => child.tagName === el.tagName);
      const index = Math.max(1, siblings.indexOf(el) + 1);
      return `${tag}:nth-of-type(${index})`;
    };
    const asCandidate = (purpose, el, confidence = 'medium', notes = '') => ({
      purpose,
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || undefined,
      role: el.getAttribute('role') || undefined,
      label: getStableLabel(el) || undefined,
      confidence,
      notes: notes || undefined,
    });

    const inputs = Array.from(document.querySelectorAll('input, select, textarea')).slice(0, 80);
    const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).slice(0, 80);
    const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 120);
    const tables = Array.from(document.querySelectorAll('table')).slice(0, 40);
    const tableSummaries = tables.map((table) => {
      const headerTexts = Array.from(table.querySelectorAll('thead th, tr:first-child th'))
        .map((header) => (header.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120))
        .filter(Boolean)
        .slice(0, 30);
      return {
        selector: selectorFor(table),
        headerTexts,
        rowCount: table.querySelectorAll('tbody tr').length || table.querySelectorAll('tr').length,
      };
    });
    const policyTableSummaries = tableSummaries.filter((table) =>
      table.headerTexts.join(' ').match(/policy|product|fund|portfolio|value|inception|investment/i),
    );
    const selectorCandidates = [
      ...inputs.map((el) => asCandidate('input', el, el.getAttribute('autocomplete') === 'one-time-code' ? 'high' : 'medium')),
      ...buttons.map((el) => asCandidate('button', el, 'medium')),
      ...links.map((el) => asCandidate('link', el, 'low')),
      ...tables.map((el) => asCandidate('table', el, 'medium')),
      ...policyTableSummaries.map((table) => ({
        purpose: 'policy_row',
        selector: `${table.selector} tbody tr`,
        confidence: 'medium',
        notes: `Candidate policy table with headers: ${table.headerTexts.join(', ')}`,
      })),
    ];

    return {
      urlHost: window.location.host,
      title: document.title,
      summary: {
        inputCount: inputs.length,
        buttonCount: buttons.length,
        linkCount: links.length,
        tableCount: tables.length,
        candidatePolicyTables: policyTableSummaries.length,
      },
      selectorCandidates,
      tableSummaries,
      warnings: [],
    };
  });

  const configuredPolicySelector = flow.extraction?.policyRowSelector;
  const configuredFields = Array.isArray(flow.extraction?.fields) ? flow.extraction.fields : [];
  const warnings = [...(report.warnings || [])];
  if (!configuredPolicySelector) warnings.push('No policy row selector is configured yet.');
  if (configuredFields.length === 0) warnings.push('No extraction fields are configured yet.');

  return {
    ...report,
    mode: options.mode || 'discover',
    summary: {
      ...report.summary,
      extractedRowCount: options.extractedRowCount,
    },
    warnings,
  };
}

async function readField(row, field) {
  const locator = row.locator(field.selector).first();
  if (!(await locator.count())) {
    if (field.required) throw new Error(`Required field selector not found: ${field.sourceHeader}`);
    return '';
  }

  let value = '';
  if (field.attribute === 'value') {
    value = await locator.inputValue().catch(() => '');
  } else if (field.attribute && field.attribute !== 'text') {
    value = (await locator.getAttribute(field.attribute)) || '';
  } else {
    value = (await locator.textContent()) || '';
  }

  if (field.transform === 'number') {
    return value.replace(/[^\d.-]/g, '');
  }
  return value.trim();
}

async function extractRows(page, flow) {
  const { extraction } = flow;
  if (!extraction?.policyRowSelector || !Array.isArray(extraction.fields) || extraction.fields.length === 0) {
    throw new Error('Portal flow extraction selectors are not configured yet.');
  }

  const rows = [];
  const seenPageKeys = new Set();
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    await page.locator(extraction.policyRowSelector).first().waitFor({ state: 'visible', timeout: 45000 });
    const policyRows = page.locator(extraction.policyRowSelector);
    const count = await policyRows.count();

    for (let index = 0; index < count; index += 1) {
      const row = policyRows.nth(index);
      const record = {};
      for (const field of extraction.fields) {
        record[field.sourceHeader] = await readField(row, field);
      }
      if (Object.values(record).some((value) => String(value || '').trim())) {
        rows.push(record);
      }
    }

    const pageKey = `${page.url()}:${count}:${rows.length}`;
    if (seenPageKeys.has(pageKey) || !flow.navigation?.nextPageSelector) break;
    seenPageKeys.add(pageKey);

    const next = page.locator(flow.navigation.nextPageSelector).first();
    if (!(await next.isVisible().catch(() => false)) || !(await next.isEnabled().catch(() => false))) break;
    await Promise.all([
      next.click(),
      page.waitForLoadState('domcontentloaded').catch(() => undefined),
    ]);
  }

  return rows;
}

async function main() {
  let browser;
  try {
    const { job } = await apiFetch(`/portal-jobs/${jobId}`);
    const { flow } = await apiFetch(`/portal-flows/${job.providerId}`);
    if (mode === 'run' && job.status !== 'dry_run_ready' && !forceStage) {
      throw new Error('Refusing to stage portal data before a successful dry run. Run with --mode dry-run first, or pass --force-stage after manual review.');
    }
    const credentialProfile = flow.credentialProfiles.find((profile) => profile.id === job.credentialProfileId);
    if (!credentialProfile) throw new Error('Credential profile no longer exists on the portal flow.');
    if (credentialProfile.source !== 'environment') {
      throw new Error('This worker currently supports environment credential profiles only.');
    }

    const username = process.env[credentialProfile.usernameEnvVar || ''];
    const password = process.env[credentialProfile.passwordEnvVar || ''];
    if (!username || !password) {
      throw new Error(`Missing provider credential env vars: ${credentialProfile.usernameEnvVar}, ${credentialProfile.passwordEnvVar}`);
    }

    await updateJob('running', { currentStep: 'opening_login', message: 'Opening provider login page.' });
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: !headed });
    const page = await browser.newPage();

    await page.goto(flow.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await updateJob('running', { currentStep: 'submitting_credentials', message: 'Submitting provider credentials.' });
    await (await visibleLocator(page, flow.login.usernameSelector)).fill(username);
    await (await visibleLocator(page, flow.login.passwordSelector)).fill(password);
    await (await visibleLocator(page, flow.login.submitSelector)).click();

    const otpSelector = await firstVisibleSelector(page, flow.otp.detectionSelectors, 45000);
    if (otpSelector) {
      await updateJob('waiting_for_otp', {
        currentStep: 'manual_sms_otp',
        message: flow.otp.instructions || 'Waiting for manual SMS OTP.',
      });
      const otp = await waitForManualOtp(flow.otp.timeoutMs || 600000);
      await (await visibleLocator(page, flow.otp.inputSelector)).fill(otp);
      await (await visibleLocator(page, flow.otp.submitSelector)).click();
    }

    if (flow.navigation?.postLoginUrl) {
      await page.goto(flow.navigation.postLoginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    if (mode === 'discover') {
      await updateJob('discovering', { currentStep: 'capturing_discovery_report', message: 'Capturing selector discovery report. No policy data will be staged.' });
      const report = await captureDiscoveryReport(page, flow, { mode: 'discover' });
      await postDiscoveryReport(report);
      return;
    }

    await updateJob('extracting', { currentStep: mode === 'dry-run' ? 'dry_run_extracting_policy_rows' : 'extracting_policy_rows', message: 'Extracting provider policy rows.' });
    const rows = await extractRows(page, flow);

    if (mode === 'dry-run') {
      const report = await captureDiscoveryReport(page, flow, { mode: 'dry-run', extractedRowCount: rows.length });
      await postDiscoveryReport(report);
      return;
    }

    await updateJob('staging', {
      currentStep: 'staging_rows',
      message: `Extracted ${rows.length} rows. Staging policy sync run.`,
      extractedRows: rows.length,
    });
    await apiFetch(`/portal-jobs/${jobId}/stage`, {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  } catch (error) {
    await updateJob('failed', {
      currentStep: 'failed',
      message: 'Portal worker failed.',
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
