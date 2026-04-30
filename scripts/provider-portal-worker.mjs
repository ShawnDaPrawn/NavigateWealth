import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';

const DEFAULT_API_BASE = 'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/integrations';
const TEMPLATE_METADATA_COLUMNS = {
  templateVersion: '_NW Template Version',
  policyId: '_NW Policy ID',
  clientId: '_NW Client ID',
  providerId: '_NW Provider ID',
  categoryId: '_NW Category ID',
  normalizedPolicyNumber: '_NW Normalized Policy Number',
};

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
  npm run provider:sync -- --poll

Environment:
  NW_API_AUTH_TOKEN                    Admin session token for Navigate Wealth API access
  NW_PORTAL_WORKER_SECRET              Hosted worker secret for live polling mode
  NW_PORTAL_JOB_ID                     Portal job id, if not passed as --job-id
  NW_PORTAL_MODE                       run, discover, or dry-run
  NW_PORTAL_POLL=1                     Poll Supabase for queued jobs continuously
  NW_PORTAL_FORCE_STAGE=1              Allow staging without a prior dry-run-ready job
  NW_PROVIDER_ALLAN_GRAY_USERNAME      Allan Gray username
  NW_PROVIDER_ALLAN_GRAY_PASSWORD      Allan Gray password
  NW_PLAYWRIGHT_HEADED=1               Optional visible browser mode
`);
  process.exit(0);
}

const apiBase = String(args['api-base'] || process.env.NW_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '');
const authToken = String(args['auth-token'] || process.env.NW_API_AUTH_TOKEN || '');
const workerSecret = String(args['worker-secret'] || process.env.NW_PORTAL_WORKER_SECRET || process.env.PORTAL_WORKER_SECRET || '');
let activeJobId = String(args['job-id'] || process.env.NW_PORTAL_JOB_ID || '');
const headed = Boolean(args.headed || process.env.NW_PLAYWRIGHT_HEADED === '1');
const maxPages = Number(args['max-pages'] || process.env.NW_PLAYWRIGHT_MAX_PAGES || 20);
const mode = String(args.mode || process.env.NW_PORTAL_MODE || 'run');
const forceStage = Boolean(args['force-stage'] || process.env.NW_PORTAL_FORCE_STAGE === '1');
const poll = Boolean(args.poll || process.env.NW_PORTAL_POLL === '1');
const workerId = String(args['worker-id'] || process.env.NW_PORTAL_WORKER_ID || `worker-${process.pid}`);
const debugDir = String(args['debug-dir'] || process.env.NW_PORTAL_DEBUG_DIR || '').trim();

if (!['run', 'discover', 'dry-run'].includes(mode)) {
  throw new Error('--mode must be run, discover, or dry-run.');
}

if (!activeJobId && !poll) {
  throw new Error('Missing --job-id or NW_PORTAL_JOB_ID.');
}

if (!authToken && !workerSecret) {
  throw new Error('Missing --auth-token/NW_API_AUTH_TOKEN or --worker-secret/NW_PORTAL_WORKER_SECRET.');
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(workerSecret ? { 'X-Portal-Worker-Secret': workerSecret } : {}),
      'X-Portal-Worker-Id': workerId,
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

async function apiUpload(path, formData) {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(workerSecret ? { 'X-Portal-Worker-Secret': workerSecret } : {}),
      'X-Portal-Worker-Id': workerId,
    },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Upload failed: ${response.status}`);
  }
  return data;
}

function jobPath(suffix = '') {
  if (!activeJobId) throw new Error('No active portal job id.');
  return workerSecret && !authToken
    ? `/portal-worker/jobs/${activeJobId}${suffix}`
    : `/portal-jobs/${activeJobId}${suffix}`;
}

function workerJobPath(suffix = '') {
  if (!activeJobId) throw new Error('No active portal job id.');
  return `/portal-worker/jobs/${activeJobId}${suffix}`;
}

const jobWarnings = [];
const itemWarnings = new Map();

function safeDebugFilePart(value) {
  return String(value || 'debug')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'debug';
}

async function writeDebugArtifact(item, name, payload) {
  if (!debugDir) return;
  await mkdir(debugDir, { recursive: true }).catch(() => undefined);
  const fileName = [
    safeDebugFilePart(activeJobId),
    safeDebugFilePart(item?.policyNumber || item?.id),
    safeDebugFilePart(name),
  ].join('-');
  await writeFile(
    `${debugDir}/${fileName}.json`,
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  ).catch(() => undefined);
}

async function writeDebugScreenshot(page, item, name) {
  if (!debugDir) return;
  await mkdir(debugDir, { recursive: true }).catch(() => undefined);
  const fileName = [
    safeDebugFilePart(activeJobId),
    safeDebugFilePart(item?.policyNumber || item?.id),
    safeDebugFilePart(name),
  ].join('-');
  await page.screenshot({
    path: `${debugDir}/${fileName}.png`,
    fullPage: true,
  }).catch(() => undefined);
}

function sanitiseWarning(value) {
  return String(value || '').trim().slice(0, 500);
}

function uniqueWarnings(values = []) {
  return Array.from(new Set(values.map(sanitiseWarning).filter(Boolean))).slice(-20);
}

function latestWarning(values = []) {
  return values.length ? values[values.length - 1] : undefined;
}

function rememberJobWarnings(patch = {}) {
  const additions = Array.isArray(patch.warnings)
    ? patch.warnings
    : patch.warning
      ? [patch.warning]
      : [];
  const merged = uniqueWarnings([...jobWarnings, ...additions]);
  jobWarnings.splice(0, jobWarnings.length, ...merged);
}

function rememberItemWarnings(itemId, patch = {}) {
  if (!itemId) return;
  const existing = itemWarnings.get(itemId) || [];
  const additions = Array.isArray(patch.warnings)
    ? patch.warnings
    : patch.warning
      ? [patch.warning]
      : [];
  itemWarnings.set(itemId, uniqueWarnings([...existing, ...additions]));
}

function addJobWarning(warning) {
  if (!warning) return;
  rememberJobWarnings({ warning });
}

function addItemWarning(itemId, warning) {
  if (!warning) return;
  rememberItemWarnings(itemId, { warning });
}

async function updateJob(status, patch = {}) {
  rememberJobWarnings(patch);
  const warnings = uniqueWarnings(Array.isArray(patch.warnings) ? patch.warnings : jobWarnings);
  return apiFetch(jobPath('/status'), {
    method: 'POST',
    body: JSON.stringify({
      status,
      ...patch,
      warnings,
      warning: patch.warning ? sanitiseWarning(patch.warning) : latestWarning(warnings),
    }),
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
    const data = await apiFetch(jobPath('/otp'));
    if (data.otp) return data.otp;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error('Timed out waiting for manual OTP.');
}

function describeNavigationFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/net::ERR_ABORTED/i.test(message)) return 'the provider aborted the page load';
  if (/Timeout/i.test(message)) return 'the page did not load before the timeout';
  return message;
}

function buildNavigationWarning(prefix, attemptedUrl, reason, fallbackMessage) {
  return `${prefix} Attempted URL: ${attemptedUrl}. Reason: ${reason}. ${fallbackMessage}`.slice(0, 500);
}

async function detectNavigationLandingIssue(page, loginUrl, attemptedUrl) {
  const currentUrl = page.url();
  const loginOrigin = (() => {
    try {
      return new URL(loginUrl).origin;
    } catch {
      return '';
    }
  })();

  if (!currentUrl || currentUrl === 'about:blank') {
    return 'the browser stayed on a blank page';
  }

  if (loginOrigin && currentUrl.startsWith(loginOrigin) && currentUrl !== attemptedUrl) {
    const bodyText = (await page.locator('body').innerText({ timeout: 2000 }).catch(() => '') || '').trim();
    if (/log\s*in|sign\s*in|one[-\s]*time\s*pin|verify|access denied|not authorised|unauthori[sz]ed|forbidden|session expired/i.test(bodyText)) {
      return 'the provider redirected back to a login or access-check page';
    }
  }

  const bodyText = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => '') || '').trim();
  if (/access denied|not authorised|unauthori[sz]ed|forbidden|permission denied/i.test(bodyText)) {
    return 'the provider page shows access denied';
  }

  const textLength = bodyText.replace(/\s+/g, '').length;
  const visibleSignals = await page.locator('input, button, a, table, [role="button"], [role="link"], [role="row"]').count().catch(() => 0);
  if (textLength === 0 && visibleSignals === 0) {
    return 'the provider page loaded without usable content';
  }

  return '';
}

async function attemptConfiguredNavigation(page, options) {
  const {
    attemptedUrl,
    loginUrl,
    warningPrefix,
    fallbackMessage,
  } = options;

  if (!attemptedUrl) return { attempted: false, warning: '' };

  try {
    await page.goto(attemptedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);
  } catch (error) {
    return {
      attempted: true,
      warning: buildNavigationWarning(
        warningPrefix,
        attemptedUrl,
        describeNavigationFailure(error),
        fallbackMessage,
      ),
    };
  }

  const landingIssue = await detectNavigationLandingIssue(page, loginUrl, attemptedUrl);
  if (landingIssue) {
    return {
      attempted: true,
      warning: buildNavigationWarning(
        warningPrefix,
        attemptedUrl,
        landingIssue,
        fallbackMessage,
      ),
    };
  }

  return { attempted: true, warning: '' };
}

function normalisePolicyNumber(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
    .replace(/[-_/]/g, '');
}

function sampleText(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

async function capturePolicyConfirmationSnapshot(page) {
  const parts = [];
  const title = await page.title().catch(() => '');
  const currentUrl = page.url();

  const mainText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  if (mainText) parts.push(mainText);

  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const frameText = await frame.locator('body').innerText({ timeout: 1500 }).catch(() => '');
    if (frameText) parts.push(frameText);
  }

  const combinedText = parts.join('\n');
  return {
    currentUrl,
    title,
    text: combinedText,
    searchableText: [currentUrl, title, combinedText].join('\n'),
    sample: sampleText(combinedText),
  };
}

async function waitForPolicyNumberConfirmation(page, policyNumber, timeoutMs = 25000) {
  const normalizedPolicyNumber = normalisePolicyNumber(policyNumber);
  const deadline = Date.now() + timeoutMs;
  let latestSnapshot = null;

  while (Date.now() < deadline) {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);
    latestSnapshot = await capturePolicyConfirmationSnapshot(page);
    if (normalisePolicyNumber(latestSnapshot.searchableText).includes(normalizedPolicyNumber)) {
      return { confirmed: true, snapshot: latestSnapshot };
    }
    await page.waitForTimeout(1000);
  }

  return {
    confirmed: false,
    snapshot: latestSnapshot || await capturePolicyConfirmationSnapshot(page).catch(() => ({
      currentUrl: page.url(),
      title: '',
      text: '',
      searchableText: page.url(),
      sample: '',
    })),
  };
}

function splitLabels(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normaliseFieldSignature(field) {
  return [
    field?.targetFieldId,
    field?.targetFieldName,
    field?.columnName,
    field?.sourceHeader,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getFieldSemanticKind(field) {
  const signature = normaliseFieldSignature(field);
  if (/(policy\s*(number|no)|account\s*number|investment\s*number|reference)/i.test(signature)) return 'policy_number';
  if (/(date\s*of\s*inception|inception\s*date|start\s*date|investment\s*start\s*date)/i.test(signature)) return 'date_of_inception';
  if (
    /(ret(_pre|_post)?_3|retirement_fund_value|invest_current_value|fundvalue|currentvalue)/i.test(signature)
  ) return 'current_value';
  if (
    !/(maturity|estimated|projected|guaranteed|premium|contribution)/i.test(signature)
    && /(current\s*value|fund\s*value|market\s*value|closing\s*balance|policy\s*value|account\s*value|retirement\s*annuity\s*value|\bvalue\b)/i.test(signature)
  ) return 'current_value';
  if (/(product\s*type|product\s*name|investment\s*type|retirement\s*annuity\s*fund)/i.test(signature)) return 'product_type';
  return 'generic';
}

function getFallbackValueForField(field, fallbackValues = {}) {
  const kind = getFieldSemanticKind(field);
  if (kind === 'policy_number') return fallbackValues.policyNumber || '';
  if (kind === 'date_of_inception') return fallbackValues.dateOfInception || '';
  if (kind === 'current_value') return fallbackValues.currentValue || '';
  if (kind === 'product_type') return fallbackValues.productType || '';
  return '';
}

function isLikelyDateValue(value) {
  const text = sampleText(value, 120);
  if (!text) return false;
  if (/\b(selected period|since inception|bank details|statement|download)\b/i.test(text)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return true;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text)) return true;
  if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}$/.test(text)) return true;
  return !Number.isNaN(Date.parse(text));
}

function isLikelyCurrencyValue(value) {
  const text = sampleText(value, 120);
  if (!text) return false;
  if (!/\d/.test(text)) return false;
  if (/\b(selected period|since inception|bank details|statement|download)\b/i.test(text)) return false;
  return /(?:R\s*)?[-+]?\d[\d\s,.]*$/.test(text);
}

function isLikelyProductTypeValue(value) {
  const text = sampleText(value, 160);
  if (!text) return false;
  if (/\b(selected period|since inception|bank details|statement|download|search|filter|details)\b/i.test(text)) return false;
  if (isLikelyDateValue(text)) return false;
  if (isLikelyCurrencyValue(text)) return false;
  if (text.length < 3 || text.length > 120) return false;
  return /[A-Za-z]/.test(text);
}

function isPlausibleValueForField(field, value, item) {
  const text = sampleText(value, 160);
  if (!text) return false;

  switch (getFieldSemanticKind(field)) {
    case 'policy_number':
      return normalisePolicyNumber(text).includes(normalisePolicyNumber(item?.policyNumber || text));
    case 'date_of_inception':
      return isLikelyDateValue(text);
    case 'current_value':
      return isLikelyCurrencyValue(text);
    case 'product_type':
      return isLikelyProductTypeValue(text);
    default:
      return text.length <= 220;
  }
}

function candidateSearchText(candidate) {
  return [
    candidate?.text,
    candidate?.nearbyText,
    candidate?.placeholder,
    candidate?.ariaLabel,
    candidate?.title,
    candidate?.name,
    candidate?.id,
    candidate?.role,
  ].map((value) => String(value || '')).join(' ').trim();
}

function chooseDeterministicSearchCandidate(candidates = []) {
  const usable = candidates.filter((candidate) => {
    const text = candidateSearchText(candidate);
    return !/password|otp|one[-\s]*time|verification|username|log\s*in|login|sign\s*in|home|legal|help|contact/i.test(text);
  });

  const directInput = usable.find((candidate) =>
    candidate.interaction === 'fill'
    && /policy|account|client|investor|search|portfolio|contract|member/i.test(candidateSearchText(candidate)),
  );
  if (directInput) return { candidate: directInput, reason: 'deterministic input match' };

  const navTrigger = usable.find((candidate) =>
    candidate.interaction === 'click_then_fill'
    && /\b(clients?|investors?|search|accounts?|policies?|portfolio|funds?|practice)\b/i.test(candidateSearchText(candidate)),
  );
  if (navTrigger) return { candidate: navTrigger, reason: 'deterministic navigation/search trigger match' };

  const onlyInput = usable.filter((candidate) => candidate.interaction === 'fill');
  if (onlyInput.length === 1) return { candidate: onlyInput[0], reason: 'only visible fillable candidate' };

  return null;
}

function chooseDeterministicResultCandidate(candidates = [], policyNumber = '') {
  const normalizedPolicyNumber = normalisePolicyNumber(policyNumber);
  const scored = candidates
    .filter((candidate) => candidate?.selector)
    .map((candidate) => {
      const text = candidateSearchText(candidate);
      const normalizedText = normalisePolicyNumber(text);
      let score = 0;

      if (!text || /password|otp|one[-\s]*time|verification|username|log\s*in|login|sign\s*in/i.test(text)) {
        score -= 25;
      }
      if (normalizedPolicyNumber && normalizedText.includes(normalizedPolicyNumber)) score += 20;
      if (/\b(policy|account|contract|portfolio|member|client|investor|result|row)\b/i.test(text)) score += 4;
      if (candidate.tag === 'tr' || candidate.role === 'row') score += 2;
      if (/link|button/i.test(`${candidate.tag || ''} ${candidate.role || ''}`)) score += 1;

      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) {
    return {
      candidate: scored[0].candidate,
      reason: normalizedPolicyNumber ? 'deterministic policy-number result match' : 'deterministic result candidate match',
    };
  }

  if (scored.length === 1) return { candidate: scored[0].candidate, reason: 'only visible result candidate' };
  return null;
}

async function claimNextPolicyItem() {
  const data = await apiFetch(jobPath('/items/claim'), {
    method: 'POST',
    body: JSON.stringify({ workerId }),
  });
  return data.item || null;
}

async function updatePolicyItem(itemId, status, patch = {}) {
  rememberItemWarnings(itemId, patch);
  const warnings = uniqueWarnings(Array.isArray(patch.warnings) ? patch.warnings : (itemWarnings.get(itemId) || []));
  return apiFetch(jobPath(`/items/${itemId}/status`), {
    method: 'POST',
    body: JSON.stringify({
      status,
      ...patch,
      warnings,
      warning: patch.warning ? sanitiseWarning(patch.warning) : latestWarning(warnings),
    }),
  });
}

async function stageCompletedPolicyItems() {
  return apiFetch(jobPath('/stage-items'), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

function brainAssistConfig(flow) {
  const brain = flow?.search?.brain || {};
  return {
    enabled: brain.enabled === true,
    maxDecisionsPerItem: Math.max(1, Math.min(Number(brain.maxDecisionsPerItem || 2), 5)),
    rememberSelectors: brain.rememberSelectors !== false,
  };
}

function rememberedSelectorsForStage(brain, stage) {
  const memory = brain?.memory || {};
  const list = stage === 'search_result' ? memory.searchResultHints : memory.searchInputHints;
  return Array.isArray(list)
    ? list.map((entry) => String(entry?.selector || '').trim()).filter(Boolean)
    : [];
}

function describeBrainDecision(decision) {
  if (!decision) return 'no decision';
  return `${decision.action || 'stop_uncertain'} (${decision.confidence || 'low'}): ${decision.reason || 'No reason supplied.'}`;
}

function describeBrainFallbackError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.replace(/\s+/g, ' ').trim().slice(0, 160) || 'unknown error';
}

function isNavigationContextError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Execution context was destroyed|most likely because of a navigation|Cannot find context with specified id|navigation/i.test(message);
}

async function evaluateWithNavigationRetry(page, pageFunction, arg, options = {}) {
  const attempts = Math.max(1, Number(options.attempts || 3));
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
      if (attempt > 1) {
        await page.waitForTimeout(750);
      }
      return await page.evaluate(pageFunction, arg);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isNavigationContextError(error)) {
        throw error;
      }
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined);
      await page.waitForTimeout(500);
    }
  }

  throw lastError || new Error('Page evaluation failed.');
}

async function rememberBrainSelector(stage, item, candidate, source = 'brain') {
  if (!candidate?.selector) return;
  await apiFetch(workerJobPath('/brain/memory'), {
    method: 'POST',
    body: JSON.stringify({
      stage,
      selector: candidate.selector,
      label: candidate.placeholder || candidate.ariaLabel || candidate.nearbyText || candidate.text || candidate.name || '',
      notes: `${stage.replace('_', ' ')} selector confirmed (${source})`.slice(0, 200),
      source,
    }),
  }).catch(() => undefined);
}

async function requestBrainDecision(stage, page, flow, item, snapshot) {
  return apiFetch(workerJobPath('/brain/decide'), {
    method: 'POST',
    body: JSON.stringify({
      stage,
      itemId: item.id,
      policyNumber: item.policyNumber,
      snapshot: {
        ...snapshot,
        title: String(snapshot?.title || '').slice(0, 200),
        currentUrl: String(snapshot?.currentUrl || '').slice(0, 1000),
        pageTextSample: String(snapshot?.pageTextSample || '').slice(0, 1600),
        instructions: flow?.search?.instructions || '',
        searchInputLabels: splitLabels(flow?.search?.searchInputLabels),
      },
    }),
  });
}

async function captureInputCandidates(page) {
  return evaluateWithNavigationRetry(page, () => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const searchRegex = /(search|find|lookup|policy|client|clients|investor|investors|investment|investments|account|portfolio|contract|member|record|practice|funds?|products?)/i;
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const escapeValue = (value) => CSS.escape(String(value));
    const segmentFor = (el) => {
      const tag = el.tagName.toLowerCase();
      const testId = el.getAttribute('data-testid');
      const id = el.getAttribute('id');
      const name = el.getAttribute('name');
      const aria = el.getAttribute('aria-label');
      const placeholder = el.getAttribute('placeholder');
      if (testId) return `${tag}[data-testid="${escapeValue(testId)}"]`;
      if (id) return `#${escapeValue(id)}`;
      if (name) return `${tag}[name="${escapeValue(name)}"]`;
      if (aria) return `${tag}[aria-label="${escapeValue(aria)}"]`;
      if (placeholder) return `${tag}[placeholder="${escapeValue(placeholder)}"]`;
      const siblings = Array.from((el.parentElement || document.body).children).filter((child) => child.tagName === el.tagName);
      const index = Math.max(1, siblings.indexOf(el) + 1);
      return `${tag}:nth-of-type(${index})`;
    };
    const selectorFor = (el) => {
      const parts = [];
      let current = el;
      while (current && current !== document.body && parts.length < 5) {
        parts.unshift(segmentFor(current));
        if (current.id || current.getAttribute('data-testid')) break;
        current = current.parentElement;
      }
      return parts.join(' > ');
    };
    const candidateKeyFor = (el) => selectorFor(el) || `${el.tagName}:${normalise(el.textContent).slice(0, 80)}`;
    const nearbyTextFor = (el) => {
      const labels = 'labels' in el && Array.isArray(el.labels) ? el.labels : Array.from(el.labels || []);
      const labelText = labels.map((label) => normalise(label.textContent)).filter(Boolean).join(' | ');
      if (labelText) return labelText.slice(0, 160);
      const parentText = normalise(el.parentElement?.textContent || '').replace(normalise(el.value || ''), '');
      return parentText.slice(0, 160);
    };
    const directElements = Array.from(document.querySelectorAll('input, textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [contenteditable="true"]'))
      .filter((el) => isVisible(el) && normalise(el.getAttribute('type')).toLowerCase() !== 'hidden' && normalise(el.getAttribute('type')).toLowerCase() !== 'password')
      .slice(0, 16)
      .map((el, index) => ({
        candidateId: `input-${index + 1}`,
        selector: selectorFor(el),
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        role: el.getAttribute('role') || '',
        placeholder: el.getAttribute('placeholder') || '',
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || '',
        text: normalise(el.textContent || '').slice(0, 160),
        nearbyText: nearbyTextFor(el),
        interaction: 'fill',
      }));
    const triggerElements = [];
    const seenTriggers = new Set();
    const triggerSelector = [
      'button',
      'a',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[onclick]',
      '[tabindex]:not([tabindex="-1"])',
      '[data-testid*="search" i]',
      '[data-testid*="client" i]',
      '[data-testid*="investor" i]',
      '[data-testid*="policy" i]',
      '[class*="search" i]',
      '[class*="client" i]',
      '[class*="investor" i]',
      '[class*="policy" i]',
      '[aria-label*="search" i]',
      '[aria-label*="client" i]',
      '[aria-label*="investor" i]',
      '[aria-label*="policy" i]',
      '[title*="search" i]',
      '[title*="client" i]',
      '[title*="investor" i]',
      '[title*="policy" i]',
      'nav a',
      'nav button',
      'nav [role="menuitem"]',
      'header a',
      'header button',
      '[class*="nav" i] a',
      '[class*="nav" i] button',
      '[class*="menu" i] a',
      '[class*="menu" i] button',
    ].join(', ');
    for (const el of Array.from(document.querySelectorAll(triggerSelector))) {
      if (!isVisible(el)) continue;
      const text = [
        normalise(el.textContent),
        normalise(el.getAttribute('aria-label')),
        normalise(el.getAttribute('title')),
        normalise(el.getAttribute('data-testid')),
        normalise(el.getAttribute('class')),
      ].join(' ');
      if (!searchRegex.test(text)) continue;
      const visibleText = normalise(el.textContent);
      if (visibleText.length > 180) continue;
      const key = candidateKeyFor(el);
      if (seenTriggers.has(key)) continue;
      seenTriggers.add(key);
      triggerElements.push(el);
      if (triggerElements.length >= 18) break;
    }
    const triggerCandidates = triggerElements
      .map((el, index) => ({
        candidateId: `trigger-${index + 1}`,
        selector: selectorFor(el),
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        role: el.getAttribute('role') || '',
        placeholder: el.getAttribute('placeholder') || '',
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || '',
        text: normalise(el.textContent || '').slice(0, 160),
        nearbyText: nearbyTextFor(el),
        interaction: 'click_then_fill',
      }));
    const fallbackTextCandidates = triggerCandidates.length > 0 ? [] : Array.from(document.querySelectorAll('body *'))
      .filter((el) => {
        if (!isVisible(el)) return false;
        const text = normalise(el.textContent || '');
        return text && text.length <= 80 && searchRegex.test(text);
      })
      .slice(0, 10)
      .map((el, index) => ({
        candidateId: `text-trigger-${index + 1}`,
        selector: selectorFor(el),
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        role: el.getAttribute('role') || '',
        placeholder: el.getAttribute('placeholder') || '',
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || '',
        text: normalise(el.textContent || '').slice(0, 160),
        nearbyText: nearbyTextFor(el),
        interaction: 'click_then_fill',
      }));
    const pageTextSample = normalise(document.body?.innerText || '').slice(0, 1200);
    return {
      currentUrl: window.location.href,
      title: document.title,
      pageTextSample,
      candidates: [...directElements, ...triggerCandidates, ...fallbackTextCandidates],
    };
  });
}

async function captureSearchResultCandidates(page, flow) {
  const resultSelector = flow?.search?.resultContainerSelector || 'table tbody tr, [data-testid*="result" i], [data-testid*="policy" i], a, [role="row"]';
  return evaluateWithNavigationRetry(page, (selector) => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const escapeValue = (value) => CSS.escape(String(value));
    const segmentFor = (el) => {
      const tag = el.tagName.toLowerCase();
      const testId = el.getAttribute('data-testid');
      const id = el.getAttribute('id');
      const name = el.getAttribute('name');
      const aria = el.getAttribute('aria-label');
      if (testId) return `${tag}[data-testid="${escapeValue(testId)}"]`;
      if (id) return `#${escapeValue(id)}`;
      if (name) return `${tag}[name="${escapeValue(name)}"]`;
      if (aria) return `${tag}[aria-label="${escapeValue(aria)}"]`;
      const siblings = Array.from((el.parentElement || document.body).children).filter((child) => child.tagName === el.tagName);
      const index = Math.max(1, siblings.indexOf(el) + 1);
      return `${tag}:nth-of-type(${index})`;
    };
    const selectorFor = (el) => {
      const parts = [];
      let current = el;
      while (current && current !== document.body && parts.length < 5) {
        parts.unshift(segmentFor(current));
        if (current.id || current.getAttribute('data-testid')) break;
        current = current.parentElement;
      }
      return parts.join(' > ');
    };
    const elements = Array.from(document.querySelectorAll(selector))
      .filter((el) => isVisible(el) && normalise(el.textContent || ''))
      .slice(0, 20);
    const pageTextSample = normalise(document.body?.innerText || '').slice(0, 1200);
    return {
      currentUrl: window.location.href,
      title: document.title,
      pageTextSample,
      candidates: elements.map((el, index) => ({
        candidateId: `result-${index + 1}`,
        selector: selectorFor(el),
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        role: el.getAttribute('role') || '',
        placeholder: el.getAttribute('placeholder') || '',
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || '',
        text: normalise(el.textContent || '').slice(0, 240),
        nearbyText: normalise(el.parentElement?.textContent || '').slice(0, 240),
      })),
    };
  }, resultSelector);
}

async function chooseInputWithBrain(page, flow, item) {
  let snapshot = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    snapshot = await captureInputCandidates(page);
    if (Array.isArray(snapshot?.candidates) && snapshot.candidates.length > 0) break;
    if (attempt < 3) {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);
      await page.waitForTimeout(1200);
    }
  }
  if (!Array.isArray(snapshot?.candidates) || snapshot.candidates.length === 0) {
    const pageHint = String(snapshot?.pageTextSample || '').slice(0, 240);
    throw new Error(pageHint
      ? `No visible search inputs or search triggers were available for smart assist after retrying. Page sample: ${pageHint}`
      : 'No visible search inputs or search triggers were available for smart assist after retrying.');
  }
  const fallback = chooseDeterministicSearchCandidate(snapshot.candidates);
  let response = null;
  try {
    response = await requestBrainDecision('search_input', page, flow, item, snapshot);
  } catch (error) {
    if (fallback?.candidate) {
      return {
        candidate: fallback.candidate,
        decision: {
          action: 'use_candidate',
          candidateId: fallback.candidate.candidateId,
          confidence: 'medium',
          reason: `${fallback.reason}; brain request failed: ${describeBrainFallbackError(error)}`.slice(0, 300),
          origin: 'fallback',
        },
      };
    }
    throw error;
  }
  const decision = response?.decision || null;
  if (!decision || decision.action !== 'use_candidate' || !decision.candidateId) {
    if (fallback?.candidate) {
      return {
        candidate: fallback.candidate,
        decision: {
          action: 'use_candidate',
          candidateId: fallback.candidate.candidateId,
          confidence: 'medium',
          reason: `${fallback.reason}; brain said: ${describeBrainDecision(decision)}`.slice(0, 300),
          origin: 'fallback',
        },
      };
    }
    throw new Error(`Smart assist stopped without a safe search-field choice: ${describeBrainDecision(decision)}`);
  }
  const candidate = snapshot.candidates.find((entry) => entry.candidateId === decision.candidateId);
  if (!candidate?.selector) {
    throw new Error('Smart assist chose a search field candidate that is no longer available.');
  }
  return { candidate, decision: { ...decision, origin: 'brain' } };
}

async function chooseSearchResultWithBrain(page, flow, item) {
  const snapshot = await captureSearchResultCandidates(page, flow);
  if (!Array.isArray(snapshot?.candidates) || snapshot.candidates.length === 0) {
    throw new Error('No visible search results were available for smart assist.');
  }
  const fallback = chooseDeterministicResultCandidate(snapshot.candidates, item.policyNumber);
  let response = null;
  try {
    response = await requestBrainDecision('search_result', page, flow, item, snapshot);
  } catch (error) {
    if (fallback?.candidate) {
      return {
        candidate: fallback.candidate,
        decision: {
          action: 'use_candidate',
          candidateId: fallback.candidate.candidateId,
          confidence: 'medium',
          reason: `${fallback.reason}; brain request failed: ${describeBrainFallbackError(error)}`.slice(0, 300),
          origin: 'fallback',
        },
      };
    }
    throw error;
  }
  const decision = response?.decision || null;
  if (!decision || decision.action !== 'use_candidate' || !decision.candidateId) {
    if (fallback?.candidate) {
      return {
        candidate: fallback.candidate,
        decision: {
          action: 'use_candidate',
          candidateId: fallback.candidate.candidateId,
          confidence: 'medium',
          reason: `${fallback.reason}; brain said: ${describeBrainDecision(decision)}`.slice(0, 300),
          origin: 'fallback',
        },
      };
    }
    throw new Error(`Smart assist stopped without a safe result choice: ${describeBrainDecision(decision)}`);
  }
  const candidate = snapshot.candidates.find((entry) => entry.candidateId === decision.candidateId);
  if (!candidate?.selector) {
    throw new Error('Smart assist chose a result candidate that is no longer available.');
  }
  return { candidate, decision: { ...decision, origin: 'brain' } };
}

async function findClickableByIntent(page, selector, labels = []) {
  if (selector) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) return locator;
  }

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const labelRegex = new RegExp(escaped, 'i');
    const candidates = [
      page.getByRole('link', { name: labelRegex }).first(),
      page.getByRole('button', { name: labelRegex }).first(),
      page.locator('a, button, [role="link"], [role="button"]').filter({ hasText: labelRegex }).first(),
    ];

    for (const locator of candidates) {
      if (await locator.isVisible({ timeout: 800 }).catch(() => false)) return locator;
    }
  }

  const inferredSelector = await evaluateWithNavigationRetry(page, (labelList) => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    };
    const labelsText = normalise((labelList || []).join(' '));
    const wantsDownload = /download|pdf|statement|schedule/i.test(labelsText);
    if (!wantsDownload) return '';

    const clickables = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"]'))
      .filter(isVisible);
    const candidate = clickables.find((el) => {
      const text = [
        el.textContent,
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.getAttribute('download'),
        el.getAttribute('data-testid'),
        el.getAttribute('mattooltip'),
        el.getAttribute('ng-reflect-message'),
        ...Array.from(el.querySelectorAll('mat-icon, svg, use, i')).map((icon) => [
          icon.textContent,
          icon.getAttribute('aria-label'),
          icon.getAttribute('title'),
          icon.getAttribute('data-icon'),
          icon.getAttribute('href'),
          icon.getAttribute('xlink:href'),
          icon.getAttribute('class'),
        ].filter(Boolean).join(' ')),
      ].filter(Boolean).join(' ');
      return /download|file_download|cloud_download|picture_as_pdf|pdf|statement/i.test(text);
    }) || clickables
      .map((el) => ({ el, rect: el.getBoundingClientRect(), text: normalise(el.textContent) }))
      .filter((entry) =>
        entry.rect.top >= 80
        && entry.rect.top <= 280
        && entry.rect.left >= window.innerWidth * 0.75
        && entry.rect.width >= 24
        && entry.rect.height >= 24
        && entry.el.querySelector('svg, mat-icon, i')
        && !/zar|last\s+1\s+year|agra|account|client/i.test(entry.text)
      )
      .sort((a, b) => b.rect.left - a.rect.left)[0]?.el;
    if (!candidate) return '';

    const id = `nw-download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    candidate.setAttribute('data-nw-worker-clickable', id);
    return `[data-nw-worker-clickable="${id}"]`;
  }, labels).catch(() => '');

  if (inferredSelector) {
    const locator = page.locator(inferredSelector).first();
    if (await locator.isVisible({ timeout: 800 }).catch(() => false)) return locator;
  }

  throw new Error('Could not confidently find the policy schedule download action.');
}

async function findAllanGrayDownloadAction(page) {
  const inferredSelector = await evaluateWithNavigationRetry(page, () => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width >= 20
        && rect.height >= 20;
    };
    const clickables = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"], [tabindex]'))
      .filter(isVisible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const text = normalise([
          el.textContent,
          el.getAttribute('aria-label'),
          el.getAttribute('title'),
          el.getAttribute('download'),
          el.getAttribute('data-testid'),
          ...Array.from(el.querySelectorAll('mat-icon, svg, use, i')).map((icon) => [
            icon.textContent,
            icon.getAttribute('aria-label'),
            icon.getAttribute('title'),
            icon.getAttribute('data-icon'),
            icon.getAttribute('href'),
            icon.getAttribute('xlink:href'),
            icon.getAttribute('class'),
          ].filter(Boolean).join(' ')),
        ].filter(Boolean).join(' '));
        const toolbarPosition = rect.top >= 90
          && rect.top <= 260
          && rect.left >= window.innerWidth * 0.72;
        const iconLike = Boolean(el.querySelector('svg, mat-icon, i')) || /download|file_download|picture_as_pdf|pdf/i.test(text);
        const excluded = /zar|last\s+1\s+year|agra\d|account|client|user|profile|logout/i.test(text);
        return {
          el,
          text,
          rect,
          score: (toolbarPosition ? 100 : 0)
            + (/download|file_download|cloud_download|picture_as_pdf|pdf/i.test(text) ? 60 : 0)
            + (iconLike ? 30 : 0)
            + Math.round(rect.left / Math.max(window.innerWidth, 1) * 10)
            - (excluded ? 200 : 0),
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    const candidate = clickables[0]?.el;
    if (!candidate) return '';
    const id = `nw-allan-gray-download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    candidate.setAttribute('data-nw-worker-clickable', id);
    return `[data-nw-worker-clickable="${id}"]`;
  }).catch(() => '');

  if (!inferredSelector) return null;
  const locator = page.locator(inferredSelector).first();
  if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) return locator;
  return null;
}

function safeDownloadedPdfName(item, suggestedFilename, artifactId = 'policy_schedule') {
  const baseName = String(suggestedFilename || `${item.policyNumber || item.id}-${artifactId}.pdf`)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '');
  return baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName || 'policy_schedule'}.pdf`;
}

function normaliseArtifactStepLabels(step, fallback = []) {
  return splitLabels(step?.labels || step?.text || fallback);
}

function buildDocumentArtifacts(flow) {
  const configuredArtifacts = Array.isArray(flow.documentArtifacts)
    ? flow.documentArtifacts.filter((artifact) => artifact && artifact.enabled !== false)
    : [];
  if (configuredArtifacts.length > 0) return configuredArtifacts;

  const policySchedule = flow.policySchedule || {};
  if (!policySchedule.enabled) return [];
  const timeout = Number(policySchedule.waitForDownloadMs || 30000);
  return [{
    id: 'policy_schedule',
    label: 'Policy schedule',
    enabled: true,
    required: policySchedule.required === true,
    attachTo: 'matched_policy',
    documentType: policySchedule.documentType || 'policy_schedule',
    fileType: 'pdf',
    steps: [
      {
        action: 'click',
        target: 'download_button',
        selector: policySchedule.downloadSelector,
        labels: splitLabels(policySchedule.downloadLabels || ['Policy schedule', 'Download', 'PDF', 'Statement']),
        timeoutMs: Math.min(timeout, 10000),
      },
      {
        action: 'click_menu_item',
        target: 'menu_item',
        labels: splitLabels(policySchedule.downloadMenuLabels || ['Download PDF with company logo', 'Download PDF without company logo']),
        timeoutMs: timeout,
      },
      {
        action: 'wait_for_download',
        timeoutMs: timeout,
      },
    ],
  }];
}

function artifactStatus(artifact, status, patch = {}) {
  return {
    id: String(artifact.id || 'document'),
    label: String(artifact.label || artifact.id || 'Document'),
    status,
    updatedAt: new Date().toISOString(),
    ...patch,
  };
}

function mergeArtifactStatus(statuses, nextStatus) {
  return [
    ...statuses.filter((status) => status.id !== nextStatus.id),
    nextStatus,
  ];
}

async function captureVisibleDocumentActions(page) {
  return evaluateWithNavigationRetry(page, () => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    };
    return Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"], [role="menuitem"], [tabindex]'))
      .filter(isVisible)
      .slice(0, 80)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          title: el.getAttribute('title') || '',
          text: normalise(el.textContent || '').slice(0, 200),
          className: String(el.getAttribute('class') || '').slice(0, 160),
          rect: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      });
  }).catch(() => []);
}

async function findDocumentClickTarget(page, artifact, step) {
  const labels = normaliseArtifactStepLabels(step, ['Policy schedule', 'Download', 'PDF', 'Statement']);
  if (step?.target === 'download_button' && /allangray\.co\.za/i.test(page.url())) {
    const allanGrayAction = await findAllanGrayDownloadAction(page);
    if (allanGrayAction) return allanGrayAction;
  }
  return findClickableByIntent(page, step?.selector || '', labels);
}

async function clickDocumentMenuItem(page, artifact, step, item) {
  await page.waitForTimeout(600);
  await writeDebugScreenshot(page, item, `${artifact.id}-menu-open`);
  const labels = normaliseArtifactStepLabels(step, ['Download PDF with company logo', 'Download PDF']);
  const menuAction = await findClickableByIntent(page, step?.selector || '', labels);
  if (!menuAction) {
    const visibleActions = await captureVisibleDocumentActions(page);
    await writeDebugArtifact(item, `${artifact.id}-menu-candidates`, {
      pageUrl: page.url(),
      labels,
      visibleActions,
    });
    throw new Error(`Could not find document menu item for ${artifact.label}. Expected one of: ${labels.join(', ')}`);
  }
  return menuAction.click();
}

async function runDocumentDownloadSteps(page, artifact, item) {
  const steps = Array.isArray(artifact.steps) ? artifact.steps : [];
  const clickStep = steps.find((step) => step.action === 'click') || {};
  const menuStep = steps.find((step) => step.action === 'click_menu_item');
  const downloadStep = steps.find((step) => step.action === 'wait_for_download') || {};
  const timeout = Number(downloadStep.timeoutMs || menuStep?.timeoutMs || clickStep.timeoutMs || 30000);
  const directTimeout = Math.min(Number(clickStep.timeoutMs || 5000), 10000);
  const clickTarget = await findDocumentClickTarget(page, artifact, clickStep);
  if (!clickTarget) {
    const visibleActions = await captureVisibleDocumentActions(page);
    await writeDebugArtifact(item, `${artifact.id}-download-action-candidates`, {
      pageUrl: page.url(),
      labels: normaliseArtifactStepLabels(clickStep),
      visibleActions,
    });
    throw new Error(`Could not find document download action for ${artifact.label}.`);
  }

  let download = null;
  try {
    const directDownloadPromise = page.waitForEvent('download', { timeout: directTimeout });
    await clickTarget.click();
    download = await directDownloadPromise;
  } catch {
    if (!menuStep) {
      throw new Error(`${artifact.label} did not start a download after clicking the document action.`);
    }
    const menuDownloadPromise = page.waitForEvent('download', { timeout });
    await clickDocumentMenuItem(page, artifact, menuStep, item);
    download = await menuDownloadPromise;
  }

  const failure = await download.failure();
  if (failure) throw new Error(`Provider PDF download failed: ${failure}`);

  const filePath = await download.path();
  if (!filePath) {
    throw new Error('Provider created a PDF download, but Playwright could not access the file path.');
  }

  return {
    filePath,
    fileName: safeDownloadedPdfName(item, download.suggestedFilename(), artifact.id),
  };
}

async function uploadPolicyDocumentArtifact(item, artifact, downloaded) {
  if (!workerSecret) {
    throw new Error('Policy document attachment requires NW_PORTAL_WORKER_SECRET live worker mode.');
  }

  const buffer = await readFile(downloaded.filePath);
  const signature = buffer.subarray(0, 5).toString('utf8');
  if (!signature.startsWith('%PDF-')) {
    throw new Error(`Downloaded ${artifact.label} is not a valid PDF.`);
  }

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'application/pdf' }), downloaded.fileName);
  formData.append('fileName', downloaded.fileName);
  formData.append('documentType', artifact.documentType || 'policy_schedule');

  return apiUpload(workerJobPath(`/items/${item.id}/policy-document`), formData);
}

async function processDocumentArtifacts(page, flow, item, jobMode) {
  const artifacts = buildDocumentArtifacts(flow);
  const statuses = artifacts.length > 0
    ? artifacts.map((artifact) => artifactStatus(artifact, 'not_requested'))
    : [];
  const attachedDocuments = [];

  for (const artifact of artifacts) {
    let downloaded = null;
    try {
      const started = artifactStatus(artifact, 'started');
      statuses.splice(0, statuses.length, ...mergeArtifactStatus(statuses, started));
      await updatePolicyItem(item.id, 'in_progress', {
        currentStep: jobMode === 'dry-run' ? `checking_${artifact.id}` : `attaching_${artifact.id}`,
        message: jobMode === 'dry-run'
          ? `Checking ${artifact.label} for ${item.clientName} / ${item.policyNumber}.`
          : `Downloading and attaching ${artifact.label} for ${item.clientName} / ${item.policyNumber}.`,
        artifactStatuses: statuses,
      });

      downloaded = await runDocumentDownloadSteps(page, artifact, item);
      statuses.splice(0, statuses.length, ...mergeArtifactStatus(statuses, artifactStatus(artifact, 'downloaded', {
        fileName: downloaded.fileName,
      })));

      if (jobMode === 'dry-run') {
        statuses.splice(0, statuses.length, ...mergeArtifactStatus(statuses, artifactStatus(artifact, 'validated', {
          fileName: downloaded.fileName,
          error: 'Found during dry run; not attached.',
        })));
        continue;
      }

      const upload = await uploadPolicyDocumentArtifact(item, artifact, downloaded);
      const document = upload.document || null;
      statuses.splice(0, statuses.length, ...mergeArtifactStatus(statuses, artifactStatus(artifact, 'attached', {
        fileName: document?.fileName || downloaded.fileName,
        documentId: document?.id,
      })));
      if (document) attachedDocuments.push({ artifact, document });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      statuses.splice(0, statuses.length, ...mergeArtifactStatus(statuses, artifactStatus(artifact, 'failed', {
        error: message,
      })));
      await writeDebugArtifact(item, `${artifact.id}-artifact-failure`, {
        pageUrl: page.url(),
        artifact,
        error: message,
        visibleActions: await captureVisibleDocumentActions(page),
      });
      await writeDebugScreenshot(page, item, `${artifact.id}-artifact-failure`);
    } finally {
      if (downloaded?.filePath) {
        await unlink(downloaded.filePath).catch(() => undefined);
      }
    }
  }

  return { statuses, attachedDocuments };
}

async function findInputByIntent(page, selector, labels = [], rememberedSelectors = []) {
  if (selector) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) return locator;
  }

  for (const rememberedSelector of rememberedSelectors) {
    const locator = page.locator(rememberedSelector).first();
    if (await locator.isVisible({ timeout: 1200 }).catch(() => false)) return locator;
  }

  await page.waitForTimeout(1500);

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const candidates = [
      page.getByLabel(label).first(),
      page.getByPlaceholder(label).first(),
      page.getByRole('textbox', { name: regex }).first(),
      page.getByRole('searchbox', { name: regex }).first(),
      page.getByRole('combobox', { name: regex }).first(),
      page.locator(`input[placeholder*="${label}" i], input[name*="${label}" i], input[id*="${label}" i], input[aria-label*="${label}" i], input[title*="${label}" i], textarea[placeholder*="${label}" i], textarea[aria-label*="${label}" i], select[name*="${label}" i], [role="textbox"][aria-label*="${label}" i], [role="searchbox"][aria-label*="${label}" i], [role="combobox"][aria-label*="${label}" i], [contenteditable="true"][aria-label*="${label}" i], [contenteditable="true"][title*="${label}" i]`).first(),
    ];
    for (const locator of candidates) {
      if (await locator.isVisible({ timeout: 800 }).catch(() => false)) return locator;
    }
  }

  const genericCandidates = page.locator([
    'input[type="search"]',
    'input[placeholder*="search" i]',
    'input[name*="search" i]',
    'input[id*="search" i]',
    'input[aria-label*="search" i]',
    'input[title*="search" i]',
    'input[data-qa*="search" i]',
    'input[data-qa*="client" i]',
    'input[data-qa*="account" i]',
    'input[data-qa*="policy" i]',
    'textarea[placeholder*="search" i]',
    'textarea[aria-label*="search" i]',
    'textarea[data-qa*="search" i]',
    'select[name*="search" i]',
    'select[data-qa*="search" i]',
    '[role="textbox"]',
    '[role="searchbox"]',
    '[role="combobox"]',
    '[contenteditable="true"]',
    'input:not([type])',
    'input[type="text"]',
    'input[type="tel"]',
    'input[type="number"]',
  ].join(', '));

  const genericCount = Math.min(await genericCandidates.count().catch(() => 0), 20);
  for (let index = 0; index < genericCount; index += 1) {
    const candidate = genericCandidates.nth(index);
    if (await candidate.isVisible({ timeout: 500 }).catch(() => false)) return candidate;
  }

  const visibleInputs = page.locator('input, textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [contenteditable="true"]');
  const visibleCount = Math.min(await visibleInputs.count().catch(() => 0), 20);
  let firstVisible = null;
  let firstVisibleCount = 0;
  for (let index = 0; index < visibleCount; index += 1) {
    const candidate = visibleInputs.nth(index);
    if (!(await candidate.isVisible({ timeout: 500 }).catch(() => false))) continue;
    firstVisibleCount += 1;
    if (!firstVisible) firstVisible = candidate;
    if (firstVisibleCount > 1) break;
  }
  if (firstVisible && firstVisibleCount === 1) return firstVisible;

  const visibleSummary = [];
  for (let index = 0; index < visibleCount; index += 1) {
    const candidate = visibleInputs.nth(index);
    if (!(await candidate.isVisible({ timeout: 300 }).catch(() => false))) continue;
    const tagName = await candidate.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'unknown');
    const details = await candidate.evaluate((el) => ({
      type: el.getAttribute('type') || '',
      placeholder: el.getAttribute('placeholder') || '',
      name: el.getAttribute('name') || '',
      id: el.getAttribute('id') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
      role: el.getAttribute('role') || '',
    })).catch(() => ({}));
    visibleSummary.push(`${tagName}:${JSON.stringify(details)}`.slice(0, 220));
    if (visibleSummary.length >= 5) break;
  }

  const message = visibleSummary.length > 0
    ? `Could not confidently find the provider search box. Visible inputs: ${visibleSummary.join(' | ')}`
    : 'Could not confidently find the provider search box.';
  throw new Error(message);
}

function isClickInterceptionError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /intercepts pointer events|Timeout .* exceeded|not clickable|element is outside|another element/i.test(message);
}

async function clickWithOverlayFallback(page, locator, options = {}) {
  const timeout = Number(options.timeout || 5000);
  const afterClick = async () => {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);
    await page.waitForTimeout(Number(options.settleMs || 600));
  };

  try {
    await locator.click({ timeout });
    await afterClick();
    return 'click';
  } catch (error) {
    if (!isClickInterceptionError(error)) throw error;
  }

  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(400);

  try {
    await locator.click({ timeout });
    await afterClick();
    return 'escape_click';
  } catch (error) {
    if (!isClickInterceptionError(error)) throw error;
  }

  await locator.dispatchEvent('click');
  await afterClick();
  return 'dom_click';
}

async function waitAfterSubmit(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);
  await page.waitForTimeout(800);
}

async function pageContainsPolicyNumber(page, policyNumber) {
  const normalized = normalisePolicyNumber(policyNumber);
  if (!normalized) return false;
  const text = await page.locator('body').innerText({ timeout: 2500 }).catch(() => '');
  return normalisePolicyNumber(text).includes(normalized);
}

async function submitPolicySearch(page, search, searchInput, item) {
  if (searchInput) {
    await searchInput.press('Enter').catch(async () => page.keyboard.press('Enter'));
    await waitAfterSubmit(page);
    if (await pageContainsPolicyNumber(page, item?.policyNumber)) return;
  }

  if (search?.submitSelector) {
    const button = page.locator(search.submitSelector).first();
    if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clickWithOverlayFallback(page, button, { timeout: 5000, settleMs: 800 });
      return;
    }
  }
  await page.keyboard.press('Enter');
  await waitAfterSubmit(page);
}

async function openPolicySearchResult(page, flow, item, brain) {
  const search = flow.search || {};
  const normalizedPolicyNumber = normalisePolicyNumber(item.policyNumber);
  const noResultsText = splitLabels(search.noResultsText);
  const dataQaKey = String(item.policyNumber || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  for (const text of noResultsText) {
    if (await page.getByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first().isVisible({ timeout: 500 }).catch(() => false)) {
      throw new Error(`Provider search returned "${text}" for policy ${item.policyNumber}.`);
    }
  }

  if (dataQaKey) {
    const exactDataRow = page.locator(`[data-qa-key="${dataQaKey}"]`).first();
    if (await exactDataRow.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clickWithOverlayFallback(page, exactDataRow, { timeout: 5000 });
      return;
    }
  }

  const resultSelector = search.resultContainerSelector || 'table tbody tr, [data-testid*="result" i], a, [role="row"]';
  const containers = page.locator(resultSelector);
  const count = Math.min(await containers.count().catch(() => 0), 80);

  for (let index = 0; index < count; index += 1) {
    const container = containers.nth(index);
    const text = (await container.textContent().catch(() => '') || '').trim();
    if (!normalisePolicyNumber(text).includes(normalizedPolicyNumber)) continue;

    const linkSelector = search.resultLinkSelector || 'a, button, [role="link"], [role="button"]';
    const link = container.locator(linkSelector).first();
    if (await link.isVisible({ timeout: 800 }).catch(() => false)) {
      await clickWithOverlayFallback(page, link, { timeout: 5000 });
    } else {
      await clickWithOverlayFallback(page, container, { timeout: 5000 });
    }
    return;
  }

  const pageText = normalisePolicyNumber(await page.locator('body').innerText({ timeout: 5000 }).catch(() => ''));
  if (pageText.includes(normalizedPolicyNumber)) return;

  const smartAssist = brainAssistConfig(flow);
  const rememberedResultSelectors = rememberedSelectorsForStage(brain, 'search_result');
  if (rememberedResultSelectors.length > 0) {
    for (const selector of rememberedResultSelectors) {
      const candidate = page.locator(selector).first();
      const text = normalisePolicyNumber(await candidate.textContent().catch(() => ''));
      if (!text || !text.includes(normalizedPolicyNumber)) continue;
      const nestedAction = candidate.locator('a, button, [role="link"], [role="button"]').first();
      if (await nestedAction.isVisible({ timeout: 500 }).catch(() => false)) {
        await clickWithOverlayFallback(page, nestedAction, { timeout: 5000 });
      } else {
        await clickWithOverlayFallback(page, candidate, { timeout: 5000 });
      }
      await rememberBrainSelector('search_result', item, { selector }, 'deterministic');
      return;
    }
  }

  if (smartAssist.enabled && brain?.available) {
    const { candidate, decision } = await chooseSearchResultWithBrain(page, flow, item);
    const locator = page.locator(candidate.selector).first();
    const nestedAction = locator.locator(search.resultLinkSelector || 'a, button, [role="link"], [role="button"]').first();
    if (await nestedAction.isVisible({ timeout: 800 }).catch(() => false)) {
      await clickWithOverlayFallback(page, nestedAction, { timeout: 5000 });
    } else {
      await clickWithOverlayFallback(page, locator, { timeout: 5000 });
    }
    addItemWarning(item.id, `Smart assist chose a search result. ${describeBrainDecision(decision)}`);
    if (smartAssist.rememberSelectors) {
      await rememberBrainSelector('search_result', item, candidate, decision?.origin === 'fallback' ? 'deterministic' : 'brain');
    }
    return;
  }

  throw new Error(`Could not find an exact policy-number result for ${item.policyNumber}.`);
}

async function searchPolicyByNumber(page, flow, item, brain) {
  const search = flow.search || {};
  if (search.searchPageUrl) {
    const searchNavigation = await attemptConfiguredNavigation(page, {
      attemptedUrl: search.searchPageUrl,
      loginUrl: flow.loginUrl,
      warningPrefix: 'Configured search page URL failed; continuing with in-page search flow.',
      fallbackMessage: 'Fallback used: the worker will keep searching from the current page using the configured search box labels or selector.',
    });
    if (searchNavigation.warning) {
      addItemWarning(item.id, searchNavigation.warning);
    }
  }

  const smartAssist = brainAssistConfig(flow);
  const rememberedInputSelectors = rememberedSelectorsForStage(brain, 'search_input');
  let searchInput = null;
  let searchInputMemoryCandidate = null;
  let usedBrainDecision = null;
  let usedBrainCandidate = null;
  try {
    searchInput = await findInputByIntent(page, search.searchInputSelector, splitLabels(search.searchInputLabels), rememberedInputSelectors);
    if (!search.searchInputSelector && rememberedInputSelectors.length > 0) {
      for (const selector of rememberedInputSelectors) {
        const locator = page.locator(selector).first();
        if (await locator.isVisible({ timeout: 500 }).catch(() => false)) {
          searchInputMemoryCandidate = { selector };
          break;
        }
      }
    }
  } catch (error) {
    if (!(smartAssist.enabled && brain?.available)) {
      throw error;
    }
    let remainingDecisions = smartAssist.maxDecisionsPerItem;
    let lastBrainError = error;
    while (remainingDecisions > 0 && !searchInput) {
      const brainChoice = await chooseInputWithBrain(page, flow, item);
      usedBrainDecision = brainChoice.decision;
      usedBrainCandidate = brainChoice.candidate;
      const candidateLocator = page.locator(brainChoice.candidate.selector).first();
      const interaction = brainChoice.candidate.interaction || 'fill';

      addItemWarning(item.id, `Smart assist chose a ${interaction === 'click_then_fill' ? 'search trigger' : 'search field'}. ${describeBrainDecision(brainChoice.decision)}`);

      if (interaction === 'click_then_fill') {
        await clickWithOverlayFallback(page, candidateLocator, { timeout: 5000, settleMs: 1200 });
        await page.waitForTimeout(1200);
        if (smartAssist.rememberSelectors) {
          await rememberBrainSelector('search_input', item, brainChoice.candidate, brainChoice.decision?.origin === 'fallback' ? 'deterministic' : 'brain');
        }
        try {
          searchInput = await findInputByIntent(page, search.searchInputSelector, splitLabels(search.searchInputLabels));
          break;
        } catch (followUpError) {
          lastBrainError = followUpError;
          remainingDecisions -= 1;
          continue;
        }
      }

      searchInput = candidateLocator;
      break;
    }
    if (!searchInput) {
      throw lastBrainError instanceof Error
        ? lastBrainError
        : new Error(String(lastBrainError || 'Smart assist did not find a usable search field.'));
    }
  }

  await searchInput.fill('');
  await searchInput.fill(item.policyNumber);
  await submitPolicySearch(page, search, searchInput, item);
  await page.waitForTimeout(1500);
  if (usedBrainCandidate && smartAssist.rememberSelectors) {
    await rememberBrainSelector('search_input', item, usedBrainCandidate, usedBrainDecision?.origin === 'fallback' ? 'deterministic' : 'brain');
  } else if (searchInputMemoryCandidate) {
    await rememberBrainSelector('search_input', item, searchInputMemoryCandidate, 'deterministic');
  }
  await openPolicySearchResult(page, flow, item, brain);

  const confirmation = await waitForPolicyNumberConfirmation(page, item.policyNumber);
  if (!confirmation.confirmed) {
    const snapshot = confirmation.snapshot || {};
    throw new Error(
      `Opened page did not confirm policy number ${item.policyNumber}. `
      + `URL: ${snapshot.currentUrl || page.url()}. `
      + `Title: ${snapshot.title || 'unknown'}. `
      + `Visible text sample: ${snapshot.sample || 'none'}`,
    );
  }
}

async function extractByLabels(page, fields) {
  return evaluateWithNavigationRetry(page, (fieldDefs) => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const normaliseLabel = (value) => normalise(value).toLowerCase().replace(/\s*[:?]\s*$/, '');
    const isUseful = (value) => {
      const text = normalise(value);
      return text && text.length <= 220;
    };
    const matchesLabel = (value, label) => {
      const text = normaliseLabel(value);
      const expected = normaliseLabel(label);
      return Boolean(text && expected) && (
        text === expected
        || text.replace(/\s+[?]\s*$/, '') === expected
        || text.startsWith(`${expected} ?`)
      );
    };
    const readControl = (el) => {
      if (!el) return '';
      if ('value' in el && typeof el.value === 'string') return el.value;
      return el.textContent || '';
    };
    const cleanValue = (value, label) => normalise(value)
      .replace(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
      .replace(/^[:\-\s]+/, '')
      .trim();
    const extractInlineCurrency = (value, label) => {
      const text = normalise(value);
      const expected = normaliseLabel(label);
      if (!text || !expected) return '';
      const normalisedText = normaliseLabel(text);
      const labelIndex = normalisedText.indexOf(expected);
      if (labelIndex < 0) return '';
      const startsWithLabel = normalisedText.startsWith(expected);
      const isCompactLabelValue = text.length <= 180 && labelIndex >= 0;
      if (!startsWithLabel && !isCompactLabelValue) return '';
      const valueText = startsWithLabel
        ? cleanValue(text, label)
        : text.slice(Math.max(0, labelIndex + expected.length));
      const money = valueText.match(/R\s*[\d\s,]+(?:\.\d{1,2})?/i);
      return money ? money[0].trim() : '';
    };
    const findCurrencyNearLabel = (labelElement, label) => {
      const labelRect = labelElement.getBoundingClientRect();
      const moneyElements = elements
        .map((el) => ({ el, text: normalise(el.textContent), rect: el.getBoundingClientRect() }))
        .filter((entry) => /R\s*[\d\s,]+(?:\.\d{1,2})?/i.test(entry.text))
        .filter((entry) => entry.rect.width > 0 && entry.rect.height > 0)
        .map((entry) => ({
          ...entry,
          distance: Math.abs(entry.rect.top - labelRect.top) + Math.max(0, entry.rect.left - labelRect.right),
        }))
        .sort((a, b) => a.distance - b.distance);
      const sameLine = moneyElements.find((entry) =>
        Math.abs(entry.rect.top - labelRect.top) <= Math.max(24, labelRect.height * 1.5)
        && entry.rect.left >= labelRect.left,
      );
      const nearby = sameLine || moneyElements[0];
      if (!nearby || nearby.distance > 600) return '';
      const match = nearby.text.match(/R\s*[\d\s,]+(?:\.\d{1,2})?/i);
      return match ? match[0].trim() : '';
    };
    const elements = Array.from(document.querySelectorAll('body *'))
      .filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const text = normalise(el.textContent);
        return text && text.length <= 240;
      });

    const result = {};
    for (const field of fieldDefs) {
      const labels = Array.isArray(field.labels) ? field.labels.filter(Boolean) : [];
      let value = '';
      let sourceLabel = '';

      for (const label of labels) {
        const inlineValueElement = elements.find((el) => extractInlineCurrency(el.textContent, label));
        if (inlineValueElement) {
          value = extractInlineCurrency(inlineValueElement.textContent, label);
          sourceLabel = label;
          break;
        }

        const labelElement = elements.find((el) => matchesLabel(el.textContent, label));
        if (!labelElement) continue;

        const nearbyCurrency = findCurrencyNearLabel(labelElement, label);
        if (nearbyCurrency) {
          value = nearbyCurrency;
          sourceLabel = label;
          break;
        }

        const row = labelElement.closest('tr');
        if (row) {
          const cells = Array.from(row.querySelectorAll('th,td'));
          const labelCellIndex = cells.findIndex((cell) => matchesLabel(cell.textContent, label));
          if (labelCellIndex >= 0) {
            const nextCell = cells[labelCellIndex + 1];
            if (isUseful(nextCell?.textContent)) {
              value = cleanValue(nextCell.textContent, label);
              sourceLabel = label;
              break;
            }
          }
        }

        if (labelElement.tagName?.toLowerCase() === 'dt') {
          const detailValue = labelElement.parentElement?.querySelector('dd');
          if (isUseful(readControl(detailValue))) {
            value = cleanValue(readControl(detailValue), label);
            sourceLabel = label;
            break;
          }
        }

        const next = labelElement.nextElementSibling;
        if (isUseful(readControl(next))) {
          value = cleanValue(readControl(next), label);
          sourceLabel = label;
          break;
        }

        const parent = labelElement.parentElement;
        if (parent) {
          const children = Array.from(parent.children);
          const childIndex = children.indexOf(labelElement);
          for (const sibling of children.slice(childIndex + 1, childIndex + 4)) {
            if (isUseful(readControl(sibling))) {
              value = cleanValue(readControl(sibling), label);
              sourceLabel = label;
              break;
            }
          }
          if (value) break;
        }
      }

      const fieldKey = String(field.columnName || field.sourceHeader || '').trim();
      result[fieldKey] = { value, sourceLabel };
    }
    return result;
  }, fields);
}

async function extractAllanGraySnapshot(page, item) {
  return evaluateWithNavigationRetry(page, (policyNumber) => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const extractMoney = (value) => {
      const match = normalise(value).match(/R\s*[\d\s,]+(?:\.\d{1,2})?/i);
      return match ? match[0].trim() : '';
    };
    const extractDate = (value) => {
      const match = normalise(value).match(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/);
      return match ? match[0].trim() : '';
    };
    const rawBodyText = document.body?.innerText || document.body?.textContent || '';
    const bodyText = normalise(rawBodyText);
    const bodyLines = String(rawBodyText)
      .split(/\r?\n/)
      .map((line) => normalise(line))
      .filter(Boolean);
    const result = {
      policyNumber: normalise(policyNumber),
      productType: '',
      dateOfInception: '',
      currentValue: '',
      source: 'allan_gray_snapshot',
      currentValueSource: '',
      diagnostics: {
        url: window.location.href,
        title: document.title,
        hasPolicyNumber: Boolean(policyNumber && bodyText.includes(policyNumber)),
        labelledCandidates: [],
        amountCandidates: [],
        textSnippets: [],
      },
    };

    const labelledValue = (labelRegex, valueRegex) => {
      const labelMatch = bodyText.match(labelRegex);
      if (!labelMatch || typeof labelMatch.index !== 'number') return '';
      const segment = bodyText.slice(labelMatch.index, Math.min(bodyText.length, labelMatch.index + 260));
      const valueMatch = segment.match(valueRegex);
      result.diagnostics.textSnippets.push(segment.slice(0, 180));
      return valueMatch ? valueMatch[0].trim() : '';
    };
    const lineValueAfter = (labelRegex, valueRegex, label) => {
      for (let index = 0; index < bodyLines.length; index += 1) {
        if (!labelRegex.test(bodyLines[index])) continue;
        const segment = bodyLines.slice(index, index + 5).join(' ');
        const valueMatch = segment.match(valueRegex);
        result.diagnostics.textSnippets.push(`${label || labelRegex}: ${segment}`.slice(0, 220));
        if (valueMatch) return valueMatch[0].trim();
      }
      return '';
    };

    const ownText = (el) => Array.from(el.childNodes || [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join(' ');
    const isVisibleElement = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    };
    const visibleEntries = Array.from(document.querySelectorAll('body *')).filter(isVisibleElement).map((el) => {
      const rect = el.getBoundingClientRect();
      const text = normalise(ownText(el) || el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.textContent || '');
      return {
        text,
        rect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        },
      };
    }).filter((entry) => entry.text);

    const addCandidate = (value, source, score = 0, context = '') => {
      if (!value) return '';
      result.diagnostics.amountCandidates.push({
        value,
        source,
        score,
        context: normalise(context).slice(0, 180),
      });
      return value;
    };

    const nearestMoneyAfterLabel = (labelRegex) => {
      const labels = visibleEntries.filter((entry) => labelRegex.test(entry.text) && !extractMoney(entry.text));
      const monies = visibleEntries
        .map((entry) => ({ ...entry, money: extractMoney(entry.text) }))
        .filter((entry) => entry.money);
      const candidates = [];
      for (const label of labels) {
        for (const money of monies) {
          const sameLine = Math.abs(money.rect.top - label.rect.top) <= 36;
          const justBelow = money.rect.top >= label.rect.top && money.rect.top - label.rect.bottom <= 90;
          const toRight = money.rect.left >= label.rect.left;
          const verticalDistance = Math.abs(money.rect.top - label.rect.top);
          const horizontalDistance = Math.max(0, money.rect.left - label.rect.right);
          const belowDistance = Math.max(0, money.rect.top - label.rect.bottom);
          if ((sameLine && toRight) || justBelow) {
            candidates.push({
              value: money.money,
              label: label.text,
              context: money.text,
              distance: verticalDistance + horizontalDistance + belowDistance,
            });
          }
        }
      }
      candidates.sort((a, b) => a.distance - b.distance);
      const best = candidates[0];
      return best ? addCandidate(best.value, `near ${best.label}`, best.distance, best.context) : '';
    };

    const labelledMoney = (label, labelRegex) => {
      const value = lineValueAfter(labelRegex, /R\s*[\d\s,]+(?:\.\d{1,2})?/i, label)
        || labelledValue(labelRegex, /R\s*[\d\s,]+(?:\.\d{1,2})?/i);
      return value ? addCandidate(value, label, 0, label) : '';
    };

    result.currentValue = labelledMoney('Total value', /\bTotal\s+value\s*\??/i)
      || labelledMoney('Closing balance', /\bClosing\s+balance\b/i)
      || nearestMoneyAfterLabel(/\bTotal\s+value\s*\??/i)
      || nearestMoneyAfterLabel(/\bClosing\s+balance\b/i)
      || nearestMoneyAfterLabel(/\bValue\b/i);
    result.currentValueSource = result.diagnostics.amountCandidates[0]?.source || '';
    result.dateOfInception = lineValueAfter(/\bInception\s+date\b/i, /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/i, 'Inception date')
      || lineValueAfter(/\bDate\s+of\s+inception\b/i, /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/i, 'Date of inception')
      || labelledValue(/\bInception\s+date\b/i, /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/i)
      || labelledValue(/\bDate\s+of\s+inception\b/i, /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/i);

    const rows = Array.from(document.querySelectorAll('tr')).map((row) =>
      Array.from(row.querySelectorAll('th,td'))
        .map((cell) => normalise(cell.innerText || cell.textContent || ''))
        .filter(Boolean),
    ).filter((cells) => cells.length > 0);
    const policyRow = rows.find((cells) =>
      cells.some((cell) => policyNumber && normalise(cell).includes(policyNumber))
      || cells.some((cell) => /retirement\s+annuity/i.test(cell))
      || cells.some((cell) => extractMoney(cell)),
    );
    if (policyRow) {
      const productCell = policyRow.find((cell) =>
        /retirement\s+annuity|pension|provident|preservation|living\s+annuity/i.test(cell)
        && !extractMoney(cell)
        && !extractDate(cell)
        && !/account\s*(no|number)|value|date/i.test(cell)
      );
      const dateCell = policyRow.find((cell) => extractDate(cell));
      const valueCell = [...policyRow].reverse().find((cell) => extractMoney(cell));
      result.productType = productCell || result.productType;
      result.dateOfInception = dateCell ? extractDate(dateCell) : result.dateOfInception;
      if (valueCell && !result.currentValue) {
        result.currentValue = addCandidate(extractMoney(valueCell), 'policy row', 20, policyRow.join(' | '));
        result.currentValueSource = 'policy row';
      }
    }

    if (!result.productType) {
      const productMatch = bodyText.match(/\bRetirement\s+Annuity\s+Fund\b/i);
      result.productType = productMatch ? productMatch[0].trim() : '';
    }
    if (!result.currentValue) {
      const allAmounts = Array.from(bodyText.matchAll(/R\s*[\d\s,]+(?:\.\d{1,2})?/gi)).map((match) => match[0].trim());
      result.currentValue = addCandidate(allAmounts[0] || '', 'first page amount fallback', 100, bodyText.slice(0, 220));
      result.currentValueSource = result.currentValue ? 'first page amount fallback' : '';
    }

    result.diagnostics.labelledCandidates = visibleEntries
      .filter((entry) => /\b(total\s+value|closing\s+balance|inception\s+date|retirement\s+annuity|value)\b/i.test(entry.text))
      .slice(0, 30)
      .map((entry) => ({
        text: entry.text.slice(0, 180),
        rect: entry.rect,
        money: extractMoney(entry.text),
        date: extractDate(entry.text),
      }));

    return result;
  }, String(item?.policyNumber || '')).catch(() => ({}));
}

function getFieldColumnName(field) {
  return String(field?.columnName || field?.sourceHeader || '').trim();
}

function getFieldDisplayName(field) {
  return String(field?.targetFieldName || field?.columnName || field?.sourceHeader || field?.targetFieldId || 'Field').trim();
}

function isPolicyNumberField(field) {
  const signature = [
    field?.targetFieldId,
    field?.targetFieldName,
    field?.columnName,
    field?.sourceHeader,
  ].filter(Boolean).join(' ');
  return /policy\s*(number|no)|reference/i.test(signature);
}

function isPortalRunBlockingField(field) {
  return getFieldSemanticKind(field) === 'current_value';
}

function isAllanGrayPortalPage(page) {
  return /allangray\.co\.za/i.test(page.url());
}

function findCurrentValueField(fields = []) {
  return fields.find((field) => getFieldSemanticKind(field) === 'current_value');
}

function shouldCountAsExtractedBusinessValue(field, value) {
  if (isPolicyNumberField(field)) return false;
  return Boolean(String(value || '').trim());
}

function applyTemplateMetadata(rawData, item) {
  return {
    ...rawData,
    [TEMPLATE_METADATA_COLUMNS.templateVersion]: '',
    [TEMPLATE_METADATA_COLUMNS.policyId]: String(item?.policyId || '').trim(),
    [TEMPLATE_METADATA_COLUMNS.clientId]: String(item?.clientId || '').trim(),
    [TEMPLATE_METADATA_COLUMNS.providerId]: String(item?.providerId || '').trim(),
    [TEMPLATE_METADATA_COLUMNS.categoryId]: String(item?.categoryId || '').trim(),
    [TEMPLATE_METADATA_COLUMNS.normalizedPolicyNumber]: String(item?.normalizedPolicyNumber || '').trim(),
  };
}

function countVisibleValues(rawData) {
  return Object.entries(rawData || {})
    .filter(([key]) => !Object.values(TEMPLATE_METADATA_COLUMNS).includes(key))
    .filter(([, value]) => String(value || '').trim())
    .length;
}

async function extractPolicyRecord(page, flow, config, item) {
  const mappingHeaders = Object.keys(config?.fieldMapping || {});
  const configuredFields = Array.isArray(flow.extraction?.fields) ? flow.extraction.fields : [];
  const fieldByHeader = new Map(configuredFields.map((field) => [getFieldColumnName(field), field]));
  const fields = (mappingHeaders.length ? mappingHeaders : configuredFields.map((field) => getFieldColumnName(field)))
    .filter(Boolean)
    .map((columnName) => {
      const existing = fieldByHeader.get(columnName);
      return existing || { sourceHeader: columnName, columnName, labels: [columnName], selector: '' };
    });

  const labelExtracted = await extractByLabels(page, fields);
  const isAllanGrayProvider = isAllanGrayPortalPage(page);
  const providerFallback = isAllanGrayProvider
    ? await extractAllanGraySnapshot(page, item)
    : {};
  await writeDebugArtifact(item, 'allan-gray-snapshot', providerFallback);
  const rawData = {};
  const extractedData = {};
  const missingRunBlockingFields = [];
  let businessValueCount = 0;
  const extractedFieldNames = [];

  for (const field of fields) {
    const columnName = getFieldColumnName(field);
    let selectedValue = '';
    const semanticKind = getFieldSemanticKind(field);
    const fallbackValue = getFallbackValueForField(field, providerFallback);
    if (
      isAllanGrayProvider
      && ['current_value', 'date_of_inception', 'product_type'].includes(semanticKind)
      && isPlausibleValueForField(field, fallbackValue, item)
    ) {
      selectedValue = fallbackValue;
    }

    const selectorValue = !selectedValue && field.selector ? await readField(page, field).catch(() => '') : '';
    if (!selectedValue && isPlausibleValueForField(field, selectorValue, item)) {
      selectedValue = selectorValue;
    } else {
      const labelValue = labelExtracted[columnName]?.value || '';
      if (!selectedValue && isPlausibleValueForField(field, labelValue, item)) {
        selectedValue = labelValue;
      } else if (!selectedValue && isPlausibleValueForField(field, fallbackValue, item)) {
        selectedValue = fallbackValue;
      }
    }

    rawData[columnName] = selectedValue;
    extractedData[columnName] = selectedValue;

    if (isPolicyNumberField(field)) {
      rawData[columnName] = item.policyNumber;
      extractedData[columnName] = item.policyNumber;
    } else {
      if (shouldCountAsExtractedBusinessValue(field, selectedValue)) {
        businessValueCount += 1;
        extractedFieldNames.push(getFieldDisplayName(field));
      } else if (isPortalRunBlockingField(field)) {
        const labels = Array.isArray(field.labels) ? field.labels.filter(Boolean).join(', ') : columnName;
        missingRunBlockingFields.push(`${getFieldDisplayName(field)} (${labels || columnName})`);
      }
    }
  }

  const currentValueField = findCurrentValueField(fields);
  const fallbackCurrentValue = providerFallback.currentValue || '';
  if (
    isAllanGrayProvider
    && fallbackCurrentValue
    && currentValueField
    && !String(rawData[getFieldColumnName(currentValueField)] || '').trim()
    && isPlausibleValueForField(currentValueField, fallbackCurrentValue, item)
  ) {
    const columnName = getFieldColumnName(currentValueField);
    rawData[columnName] = fallbackCurrentValue;
    extractedData[columnName] = fallbackCurrentValue;
    businessValueCount += 1;
    extractedFieldNames.push(getFieldDisplayName(currentValueField));
  }

  if (!fields.some((field) => isPolicyNumberField(field))) {
    rawData['Policy Number'] = item.policyNumber;
    extractedData['Policy Number'] = item.policyNumber;
  }

  const hasMappedCurrentValue = currentValueField
    ? isLikelyCurrencyValue(rawData[getFieldColumnName(currentValueField)])
    : false;
  if (isAllanGrayProvider && !hasMappedCurrentValue) {
    await writeDebugArtifact(item, 'allan-gray-current-value-missing', {
      pageUrl: page.url(),
      fieldNames: fields.map((field) => ({
        columnName: getFieldColumnName(field),
        displayName: getFieldDisplayName(field),
        kind: getFieldSemanticKind(field),
        valuePresent: Boolean(String(rawData[getFieldColumnName(field)] || '').trim()),
      })),
      fallback: providerFallback,
    });
    const configuredFields = fields.map((field) => getFieldDisplayName(field)).filter(Boolean).join(', ') || 'none';
    throw new Error(
      `Allan Gray policy page did not produce a mapped current value. `
      + `Detected fallback value: ${fallbackCurrentValue ? 'yes' : 'no'}`
      + `${providerFallback.currentValueSource ? ` (${providerFallback.currentValueSource})` : ''}. `
      + `Configured mapped fields: ${configuredFields}. URL: ${page.url()}. `
      + 'The worker will not mark this policy as extracted until the current value is captured into a mapped field.',
    );
  }

  const effectiveMissingRunBlockingFields = hasMappedCurrentValue ? [] : missingRunBlockingFields;
  if (effectiveMissingRunBlockingFields.length > 0 || businessValueCount === 0) {
    const missing = effectiveMissingRunBlockingFields.length > 0
      ? `Missing portal value field(s): ${effectiveMissingRunBlockingFields.join('; ')}.`
      : 'No business values were extracted from the confirmed policy page.';
    throw new Error(
      `${missing} URL: ${page.url()}. `
      + 'The worker will not stage a completed row without an extracted policy value.',
    );
  }

  const rawDataWithMetadata = applyTemplateMetadata(rawData, item);

  return {
    rawData: rawDataWithMetadata,
    extractedData,
    extractedFieldNames,
  };
}

async function postDiscoveryReport(report) {
  return apiFetch(jobPath('/discovery-report'), {
    method: 'POST',
    body: JSON.stringify(report),
  });
}

async function captureDiscoveryReport(page, flow, options = {}) {
  const report = await evaluateWithNavigationRetry(page, () => {
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
    if (field.required) throw new Error(`Required field selector not found: ${getFieldDisplayName(field)}`);
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
        record[getFieldColumnName(field)] = await readField(row, field);
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

async function processPolicyQueue(page, flow, config, jobMode, brain) {
  let completed = 0;
  let failed = 0;
  const failureSummaries = [];

  for (;;) {
    const item = await claimNextPolicyItem();
    if (!item) break;
    itemWarnings.delete(item.id);

    try {
      await updatePolicyItem(item.id, 'in_progress', {
        currentStep: 'searching_policy',
        message: `Searching provider portal for ${item.clientName} / ${item.policyNumber}.`,
      });

      await searchPolicyByNumber(page, flow, item, brain);

      await updatePolicyItem(item.id, 'in_progress', {
        currentStep: 'extracting_policy',
        message: `Extracting values for ${item.clientName} / ${item.policyNumber}.`,
      });

      const { rawData, extractedData, extractedFieldNames } = await extractPolicyRecord(page, flow, config, item);
      console.log(`Portal item extracted ${item.clientName} / ${item.policyNumber}: ${extractedFieldNames.length ? extractedFieldNames.join(', ') : 'no mapped field names'}`);
      await writeDebugArtifact(item, 'extracted-row', {
        pageUrl: page.url(),
        extractedFieldNames,
        rawData,
        documentRequested: buildDocumentArtifacts(flow).length > 0,
      });
      const artifactResult = await processDocumentArtifacts(page, flow, item, jobMode);
      const attachedDocument = artifactResult.attachedDocuments[0]?.document || null;
      const artifactFailures = artifactResult.statuses.filter((status) => status.status === 'failed');
      const artifactMessages = artifactResult.statuses.map((status) => {
        if (status.status === 'attached') return `${status.label} attached (${status.fileName}).`;
        if (status.status === 'validated') return `${status.label} found (${status.fileName}); not attached during dry run.`;
        if (status.status === 'failed') return `${status.label} failed: ${status.error}`;
        return '';
      }).filter(Boolean);

      await updatePolicyItem(item.id, 'completed', {
        currentStep: 'completed',
        message: [
          `Extracted ${countVisibleValues(rawData)} mapped value(s).`,
          extractedFieldNames?.length ? `Fields: ${extractedFieldNames.slice(0, 6).join(', ')}.` : '',
          ...artifactMessages,
        ].filter(Boolean).join(' '),
        rawData,
        extractedData,
        matchConfidence: 'high',
        documentAttached: artifactResult.statuses.some((status) => status.status === 'attached'),
        documentFileName: attachedDocument?.fileName,
        documentUpdatedAt: attachedDocument?.uploadDate,
        artifactStatuses: artifactResult.statuses,
        warning: artifactFailures.length > 0
          ? artifactFailures.map((status) => `${status.label}: ${status.error}`).join(' ')
          : undefined,
      });
      completed += 1;
    } catch (error) {
      failed += 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const failureSummary = `${item.clientName} / ${item.policyNumber}: ${errorMessage}`;
      failureSummaries.push(failureSummary);
      console.error(`Portal policy item failed: ${failureSummary}`);
      await updatePolicyItem(item.id, 'failed', {
        currentStep: 'failed',
        message: `Could not complete ${item.clientName} / ${item.policyNumber}.`,
        error: errorMessage,
        matchConfidence: 'low',
      }).catch(() => undefined);
    }
  }

  if (jobMode === 'dry-run') {
    await updateJob('dry_run_ready', {
      currentStep: 'dry_run_ready',
      message: `Dry run finished. ${completed} policy${completed === 1 ? '' : 'ies'} extracted, ${failed} failed. No client policies were updated.`,
      extractedRows: completed,
    });
    return;
  }

  if (completed === 0) {
    const firstFailure = failureSummaries[0] || 'The provider workflow did not complete any policy items.';
    await updateJob('failed', {
      currentStep: 'failed',
      message: `Portal run finished with 0 completed policies and ${failed} failed.`,
      error: `No policy updates were staged. First failure: ${firstFailure}`.slice(0, 1000),
      extractedRows: 0,
    });
    throw new Error(`All ${failed} policy item(s) failed before staging. First failure: ${firstFailure}`);
  }

  await updateJob('staging', {
    currentStep: 'staging_completed_policy_items',
    message: `Staging ${completed} completed policy update${completed === 1 ? '' : 's'} for review.`,
    extractedRows: completed,
  });
  await stageCompletedPolicyItems();
}

async function runPolicyListSteps(page, steps = []) {
  for (const step of steps) {
    const timeout = Number(step.timeoutMs || 30000);
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: Math.min(timeout, 10000) }).catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);

      if (step.action === 'goto') {
        if (!step.url) throw new Error(`Policy list step ${step.id || ''} is missing a URL.`);
        await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout });
      } else if (step.action === 'click') {
        await clickWithOverlayFallback(page, await visibleLocator(page, step.selector, timeout), { timeout: Math.min(timeout, 8000), settleMs: 1200 });
      } else if (step.action === 'fill') {
        await (await visibleLocator(page, step.selector, timeout)).fill(step.value || '');
      } else if (step.action === 'press') {
        await (await visibleLocator(page, step.selector, timeout)).press(step.key || 'Enter');
      } else if (step.action === 'wait_for_url') {
        if (!step.url) throw new Error(`Policy list step ${step.id || ''} is missing a URL pattern.`);
        await page.waitForURL(step.url, { timeout });
      } else {
        await visibleLocator(page, step.selector, timeout);
      }
    } catch (error) {
      const message = `Provider navigation step "${step.id || step.action}" did not complete: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500);
      if (step.optional === true || step.id === 'click-clients-link') {
        addJobWarning(`${message}. Continuing with search fallback from ${page.url()}.`);
        continue;
      }
      throw error;
    }
  }
}

async function loadRuntime(jobId) {
  if (workerSecret && !authToken) {
    return apiFetch(`/portal-worker/jobs/${jobId}/runtime`);
  }

  const { job } = await apiFetch(`/portal-jobs/${jobId}`);
  const { flow } = await apiFetch(`/portal-flows/${job.providerId}`);
  return { job, flow, credentials: null, brain: { available: false, configured: false, model: '', memory: null } };
}

async function runJob(jobId, requestedMode = mode) {
  activeJobId = jobId;
  jobWarnings.splice(0, jobWarnings.length);
  itemWarnings.clear();
  let browser;
  try {
    const { job, flow, config, items, credentials, brain } = await loadRuntime(jobId);
    const jobMode = job.runMode || requestedMode;
    if (jobMode === 'run' && job.status !== 'dry_run_ready' && !forceStage && authToken) {
      throw new Error('Refusing to stage portal data before a successful dry run. Run with --mode dry-run first, or pass --force-stage after manual review.');
    }
    const credentialProfile = flow.credentialProfiles.find((profile) => profile.id === job.credentialProfileId);
    if (!credentialProfile) throw new Error('Credential profile no longer exists on the portal flow.');

    const username = credentials?.username || process.env[credentialProfile.usernameEnvVar || ''];
    const password = credentials?.password || process.env[credentialProfile.passwordEnvVar || ''];
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
      await page.waitForLoadState('domcontentloaded', { timeout: 45000 }).catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
    }

    if (flow.navigation?.postLoginUrl) {
      const postLoginNavigation = await attemptConfiguredNavigation(page, {
        attemptedUrl: flow.navigation.postLoginUrl,
        loginUrl: flow.loginUrl,
        warningPrefix: 'Configured post-login URL failed; falling back to click steps.',
        fallbackMessage: Array.isArray(flow.navigation?.policyListSteps) && flow.navigation.policyListSteps.length > 0
          ? 'Fallback used: the worker will continue with the configured click steps.'
          : 'Fallback used: the worker will continue from the current page and try the next configured navigation step.',
      });
      if (postLoginNavigation.warning) {
        addJobWarning(postLoginNavigation.warning);
      }
    }
    if (Array.isArray(flow.navigation?.policyListSteps) && flow.navigation.policyListSteps.length > 0) {
      await updateJob('running', { currentStep: 'following_policy_list_steps', message: 'Following configured provider policy navigation steps.' });
      await runPolicyListSteps(page, flow.navigation.policyListSteps);
    }

    if (jobMode === 'discover') {
      await updateJob('discovering', { currentStep: 'capturing_discovery_report', message: 'Capturing selector discovery report. No policy data will be staged.' });
      const report = await captureDiscoveryReport(page, flow, { mode: 'discover' });
      await postDiscoveryReport(report);
      return;
    }

    if (Array.isArray(items) && items.length > 0) {
      await updateJob('extracting', {
        currentStep: 'processing_policy_queue',
        message: `Processing ${items.length} Navigate Wealth polic${items.length === 1 ? 'y' : 'ies'} one by one.`,
      });
      await processPolicyQueue(page, flow, config, jobMode, brain);
      return;
    }

    await updateJob('extracting', { currentStep: jobMode === 'dry-run' ? 'dry_run_extracting_policy_rows' : 'extracting_policy_rows', message: 'Extracting provider policy rows.' });
    const rows = await extractRows(page, flow);

    if (jobMode === 'dry-run') {
      const report = await captureDiscoveryReport(page, flow, { mode: 'dry-run', extractedRowCount: rows.length });
      await postDiscoveryReport(report);
      return;
    }

    await updateJob('staging', {
      currentStep: 'staging_rows',
      message: `Extracted ${rows.length} rows. Staging policy sync run.`,
      extractedRows: rows.length,
    });
    await apiFetch(jobPath('/stage'), {
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

async function pollForJobs() {
  console.log(`Portal worker ${workerId} polling ${apiBase}`);
  for (;;) {
    const { job } = await apiFetch('/portal-worker/jobs/claim', {
      method: 'POST',
      body: JSON.stringify({ workerId }),
    });
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      continue;
    }
    console.log(`Claimed portal job ${job.id} (${job.runMode || 'discover'})`);
    await runJob(job.id, job.runMode || mode).catch((error) => {
      console.error(`Job ${job.id} failed: ${error.message}`);
    });
  }
}

(poll ? pollForJobs() : runJob(activeJobId)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
