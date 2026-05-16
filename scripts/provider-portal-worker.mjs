import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { getProviderAdapter } from './provider-adapters/index.mjs';
import {
  assertPortalRuntimeConfigured,
  isPortalConfigurationError,
} from './provider-portal-runtime-validation.mjs';
import {
  getFallbackValueForField,
  getFieldSemanticKind,
  isLikelyCurrencyValue,
  isPlausibleValueForField,
} from './provider-adapters/field-semantics.mjs';

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
  NW_PROVIDER_BRIGHTROCK_USERNAME      BrightRock username
  NW_PROVIDER_BRIGHTROCK_PASSWORD      BrightRock password
  NW_PLAYWRIGHT_HEADED=1               Optional visible browser mode
  NW_PLAYWRIGHT_RECORD_VIDEO=1         Optional Playwright video capture
  NW_PLAYWRIGHT_RECORD_TRACE=1         Optional Playwright trace capture
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
const recordVideo = Boolean(
  args['record-video']
  || process.env.NW_PLAYWRIGHT_RECORD_VIDEO === '1'
  || debugDir,
);
const recordTrace = Boolean(
  args['record-trace']
  || process.env.NW_PLAYWRIGHT_RECORD_TRACE === '1'
  || debugDir,
);

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

async function ensureDir(path) {
  if (!path) return;
  await mkdir(path, { recursive: true }).catch(() => undefined);
}

async function ensureDebugDir() {
  await ensureDir(debugDir);
}

function buildDebugAssetPath(name, extension) {
  if (!debugDir) return '';
  return `${debugDir}/${safeDebugFilePart(activeJobId)}-${safeDebugFilePart(name)}.${extension}`;
}

async function writeDebugArtifact(item, name, payload) {
  if (!debugDir) return;
  await ensureDebugDir();
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
  await ensureDebugDir();
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

const liveViewIntervalMs = Math.max(3000, Number(process.env.NW_PORTAL_LIVE_VIEW_INTERVAL_MS || 6000));
const cloudflareResolutionTimeoutMs = Math.max(
  15000,
  Number(process.env.NW_PORTAL_CLOUDFLARE_TIMEOUT_MS || (headed ? 300000 : 15000)),
);
let liveViewUploadPromise = null;
let lastLiveViewUploadAt = 0;

async function publishLiveView(page, options = {}) {
  if (!page || typeof page.isClosed === 'function' && page.isClosed()) return;
  const force = options.force === true;
  const now = Date.now();
  if (!force && now - lastLiveViewUploadAt < liveViewIntervalMs) return;
  if (liveViewUploadPromise && !force) return liveViewUploadPromise.catch(() => undefined);

  liveViewUploadPromise = (async () => {
    const imageBytes = await page.screenshot({
      type: 'jpeg',
      quality: 55,
      fullPage: false,
      animations: 'disabled',
    }).catch(() => null);
    if (!imageBytes) return;

    const formData = new FormData();
    formData.append('file', new File(
      [imageBytes],
      `${safeDebugFilePart(activeJobId || 'portal-job')}-live-view.jpg`,
      { type: 'image/jpeg' },
    ));
    formData.append('pageUrl', String(page.url() || '').slice(0, 1000));

    const pageTitle = await page.title().catch(() => '');
    if (pageTitle) {
      formData.append('pageTitle', pageTitle.slice(0, 240));
    }
    if (options.note) {
      formData.append('note', String(options.note).slice(0, 500));
    }

    await apiUpload(jobPath('/live-view'), formData).catch(() => undefined);
    lastLiveViewUploadAt = Date.now();
  })().finally(() => {
    liveViewUploadPromise = null;
  });

  return liveViewUploadPromise;
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

function getOtpSelectors(flow) {
  const otp = flow?.otp || {};
  return [
    ...(Array.isArray(otp.detectionSelectors) ? otp.detectionSelectors : []),
    otp.inputSelector,
    'input[autocomplete="one-time-code"]',
    'input[inputmode="numeric"]',
    'input[type="tel"]',
    'input[type="number"]',
    'input[type="text"]',
    'input[aria-label*="otp" i]',
    'input[aria-label*="code" i]',
    'input[aria-label*="pin" i]',
    'input[aria-label*="verification" i]',
    'input[title*="otp" i]',
    'input[title*="code" i]',
    'input[title*="pin" i]',
    'input[class*="otp" i]',
    'input[class*="code" i]',
    'input[class*="pin" i]',
    'input[maxlength="4"]',
    'input[maxlength="5"]',
    'input[maxlength="6"]',
    'input[maxlength="7"]',
    'input[maxlength="8"]',
    'input[name*="otp" i]',
    'input[id*="otp" i]',
    'input[placeholder*="otp" i]',
    'input[name*="code" i]',
    'input[id*="code" i]',
    'input[placeholder*="code" i]',
    'input[name*="pin" i]',
    'input[id*="pin" i]',
    'input[placeholder*="pin" i]',
    'input[name*="verification" i]',
    'input[id*="verification" i]',
    'input[placeholder*="verification" i]',
  ].map((selector) => String(selector || '').trim()).filter(Boolean);
}

function getSearchScopes(page) {
  return [page, ...page.frames().filter((frame) => frame !== page.mainFrame())];
}

async function getVisibleFillableControls(scope) {
  const locator = scope.locator([
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])',
    'textarea',
    '[role="textbox"]',
    '[contenteditable="true"]',
  ].join(', '));
  const count = Math.min(await locator.count().catch(() => 0), 20);
  const controls = [];
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    const isVisible = await candidate.isVisible({ timeout: 250 }).catch(() => false);
    if (!isVisible) continue;
    const isEnabled = await candidate.isEnabled({ timeout: 250 }).catch(() => true);
    if (!isEnabled) continue;
    const meta = await candidate.evaluate((element) => ({
      type: String(element.getAttribute('type') || '').toLowerCase(),
      name: String(element.getAttribute('name') || ''),
      id: String(element.getAttribute('id') || ''),
      placeholder: String(element.getAttribute('placeholder') || ''),
      ariaLabel: String(element.getAttribute('aria-label') || ''),
      title: String(element.getAttribute('title') || ''),
      className: String(element.getAttribute('class') || ''),
      maxLength: Number(element.getAttribute('maxlength') || element.maxLength || 0),
      readOnly: Boolean(element.readOnly),
    })).catch(() => ({}));
    if (meta.readOnly) continue;
    controls.push({ locator: candidate, meta });
  }
  return controls;
}

function isOtpishControl(meta = {}) {
  const text = [
    meta.name,
    meta.id,
    meta.placeholder,
    meta.ariaLabel,
    meta.title,
    meta.className,
  ].join(' ');
  return /otp|one[-\s]*time|verification|verify|code|pin|passcode/i.test(text)
    || ['tel', 'number'].includes(String(meta.type || '').toLowerCase())
    || (Number(meta.maxLength || 0) >= 4 && Number(meta.maxLength || 0) <= 12);
}

function looksLikeOtpPage(text) {
  return /otp|one[-\s]*time|verification|verify|code|pin|passcode|send\s+otp|sms/i.test(text || '');
}

function looksLikeOtpDeliveryChoice(text) {
  return /how\s+would\s+you\s+like\s+to\s+receive\s+your\s+otp|email\s+sms|send\s+otp/i.test(text || '');
}

function looksLikeOtpSentConfirmation(text) {
  return /otp\s+(has\s+been\s+)?sent|code\s+(has\s+been\s+)?sent|sms\s+(has\s+been\s+)?sent|sent\s+(to|via)\s+(your\s+)?(mobile|cell|phone|sms)|message\s+(has\s+been\s+)?sent/i.test(text || '');
}

function looksLikeBrightRockOtpInfoModal(text) {
  return /information[\s\S]*an\s+sms\s+will\s+be\s+sent\s+containing\s+your\s+otp/i.test(text || '')
    || /if\s+you\s+have\s+a\s+registered\s+account\s+with\s+a\s+contact\s+number\s+linked\s+to\s+it,\s+an\s+sms\s+will\s+be\s+sent\s+containing\s+your\s+otp/i.test(text || '');
}

function looksLikeBrightRockRegistrationSuccess(text) {
  return /you\s+have\s+been\s+successfully\s+registered/i.test(text || '')
    || /you\s+will\s+be\s+redirected\s+to\s+the\s+login\s+page/i.test(text || '');
}

function looksLikeOtpEntryPrompt(text) {
  return /enter\s+(the\s+)?(otp|code|pin|passcode)|verification\s+(otp|code|pin|passcode)/i.test(text || '');
}

function looksLikePendingOtpSendAction(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value || /\bresend\b/i.test(value)) return false;
  return /\bsend\s+(otp|code|pin|passcode|sms)\b/i.test(value)
    || /^(send|go|continue|next|submit)$/i.test(value);
}

function looksLikeOtpSubmitAction(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return false;
  if (/\b(back|request\s+new\s+otp|new\s+otp|resend|send\s+otp|send\s+code|send\s+pin)\b/i.test(value)) {
    return false;
  }
  return /^(confirm|verify|continue|submit|go|next)$/i.test(value)
    || /\b(confirm|verify|continue|submit)\b/i.test(value);
}

function getSearchReadyLabels(flow) {
  return splitLabels(flow?.search?.searchInputLabels)
    .filter((label) => label.length >= 8 && !/^search$/i.test(label))
    .concat(['Search by reference number', 'Policy details', 'Policy structure', 'Cover summary', 'FSP Junction']);
}

function textContainsConfiguredLabel(text, labels) {
  return labels.some((label) => label && new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text));
}

async function writePageDiagnostics(page, name, payload = {}) {
  const snapshot = await capturePolicyConfirmationSnapshot(page).catch(() => ({
    currentUrl: page.url(),
    title: '',
    sample: '',
  }));
  await writeDebugArtifact(null, name, {
    ...payload,
    snapshot: {
      currentUrl: snapshot.currentUrl || page.url(),
      title: snapshot.title || '',
      sample: snapshot.sample || '',
    },
    createdAt: new Date().toISOString(),
  });
  await writeDebugScreenshot(page, null, name);
}

async function writeOtpDiagnostics(page, name, payload = {}) {
  await writePageDiagnostics(page, name, payload);
}

async function getControlLabel(locator) {
  return locator.evaluate((element) => [
    element.getAttribute('value'),
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.textContent,
  ].filter(Boolean).join(' ')).catch(() => '');
}

function getOtpSendActionCandidates(page, flow) {
  const candidates = [
    page.getByRole('button', { name: /send\s+(otp|code|pin|passcode)|send\s+sms|\bsend\b/i }).first(),
    page.getByRole('button', { name: /^(go|continue|next|submit)$/i }).first(),
    page.locator('button, input[type="submit"], input[type="button"], [role="button"]')
      .filter({ hasText: /send\s+(otp|code|pin|passcode)|send\s+sms|\bsend\b|^(go|continue|next|submit)$/i })
      .first(),
    page.locator('input[type="submit"][value*="send" i], input[type="button"][value*="send" i]').first(),
    page.locator('input[type="submit"][value="GO" i], input[type="button"][value="GO" i]').first(),
    page.locator('input[type="submit"][value="Continue" i], input[type="button"][value="Continue" i]').first(),
    page.locator('input[type="submit"][value="Next" i], input[type="button"][value="Next" i]').first(),
    page.locator('input[type="submit"][value="Submit" i], input[type="button"][value="Submit" i]').first(),
  ];

  const submitSelector = String(flow?.otp?.submitSelector || '').trim();
  if (submitSelector) {
    candidates.push(page.locator(submitSelector).first());
  }

  return candidates;
}

function getOtpSubmitActionCandidates(scope, flow) {
  const candidates = [
    scope.getByRole('button', { name: /^(confirm|verify|continue|submit|go|next)$/i }).first(),
    scope.locator('button, input[type="submit"], input[type="button"], [role="button"]')
      .filter({ hasText: /^(confirm|verify|continue|submit|go|next)$/i })
      .first(),
    scope.locator('input[type="submit"][value="Confirm" i], input[type="button"][value="Confirm" i]').first(),
    scope.locator('input[type="submit"][value="Verify" i], input[type="button"][value="Verify" i]').first(),
    scope.locator('input[type="submit"][value="Continue" i], input[type="button"][value="Continue" i]').first(),
    scope.locator('input[type="submit"][value="Submit" i], input[type="button"][value="Submit" i]').first(),
    scope.locator('input[type="submit"][value="GO" i], input[type="button"][value="GO" i]').first(),
  ];

  const submitSelector = String(flow?.otp?.submitSelector || '').trim();
  if (submitSelector) {
    for (const selector of submitSelector.split(',').map((part) => part.trim()).filter(Boolean)) {
      candidates.push(scope.locator(selector).first());
    }
  }

  return candidates;
}

async function clickVisibleOtpSubmitAction(page, scope, flow) {
  const visibleLabels = [];
  const disabledLabels = [];

  for (const candidate of getOtpSubmitActionCandidates(scope, flow)) {
    if (!(await candidate.isVisible({ timeout: 500 }).catch(() => false))) continue;
    const label = sampleText(await getControlLabel(candidate), 120);
    if (!looksLikeOtpSubmitAction(label)) continue;
    visibleLabels.push(label);

    if (!(await candidate.isEnabled({ timeout: 500 }).catch(() => true))) {
      disabledLabels.push(label);
      continue;
    }

    await publishLiveView(page, {
      force: true,
      note: `Submitting provider OTP with ${label || 'the visible confirmation action'}.`,
    }).catch(() => undefined);
    await clickWithOverlayFallback(page, candidate, { timeout: 5000, settleMs: 1500 });
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
    return { clicked: true, label };
  }

  if (disabledLabels.length > 0) {
    throw new Error(
      `BrightRock OTP entry was visible, but the provider confirmation action stayed disabled after code entry. `
      + `Visible actions: ${uniqueWarnings(disabledLabels).join(', ')}`,
    );
  }

  return { clicked: false, visibleLabels: uniqueWarnings(visibleLabels) };
}

async function hasVisibleOtpSendAction(page) {
  for (const candidate of getOtpSendActionCandidates(page)) {
    if (!(await candidate.isVisible({ timeout: 250 }).catch(() => false))) continue;
    if (!(await candidate.isEnabled({ timeout: 250 }).catch(() => true))) continue;
    const label = await getControlLabel(candidate);
    if (!looksLikePendingOtpSendAction(label)) continue;
    return true;
  }
  return false;
}

async function clickVisibleOtpSendAction(page, flow) {
  for (const candidate of getOtpSendActionCandidates(page, flow)) {
    if (!(await candidate.isVisible({ timeout: 500 }).catch(() => false))) continue;
    if (!(await candidate.isEnabled({ timeout: 500 }).catch(() => true))) continue;
    const label = await getControlLabel(candidate);
    if (!looksLikePendingOtpSendAction(label)) continue;
    await clickWithOverlayFallback(page, candidate, { timeout: 5000, settleMs: 1500 });
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await waitForBrightRockOtpDeliveryProgress(page, flow, 20000);
    return true;
  }
  return false;
}

async function dismissBrightRockOtpInfoModal(page) {
  const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
  if (!looksLikeBrightRockOtpInfoModal(bodyText)) return false;

  const okCandidates = [
    page.getByRole('button', { name: /^ok$/i }).first(),
    page.locator('button, input[type="button"], input[type="submit"], [role="button"]')
      .filter({ hasText: /^\s*ok\s*$/i })
      .first(),
    page.locator('input[type="button"][value="OK" i], input[type="submit"][value="OK" i]').first(),
  ];

  for (const candidate of okCandidates) {
    if (!(await candidate.isVisible({ timeout: 500 }).catch(() => false))) continue;
    if (!(await candidate.isEnabled({ timeout: 500 }).catch(() => true))) continue;
    await clickWithOverlayFallback(page, candidate, { timeout: 5000, settleMs: 1200 });
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
    return true;
  }

  return false;
}

async function dismissBrightRockRegistrationSuccessModal(page) {
  const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
  if (!looksLikeBrightRockRegistrationSuccess(bodyText)) return false;

  const okCandidates = [
    page.getByRole('button', { name: /^ok$/i }).first(),
    page.locator('button, input[type="button"], input[type="submit"], [role="button"]')
      .filter({ hasText: /^\s*ok\s*$/i })
      .first(),
    page.locator('input[type="button"][value="OK" i], input[type="submit"][value="OK" i]').first(),
  ];

  for (const candidate of okCandidates) {
    if (!(await candidate.isVisible({ timeout: 500 }).catch(() => false))) continue;
    if (!(await candidate.isEnabled({ timeout: 500 }).catch(() => true))) continue;
    await clickWithOverlayFallback(page, candidate, { timeout: 5000, settleMs: 1200 });
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
    return true;
  }

  return false;
}

async function findOtpEntryTarget(page, flow, preferredSelector, timeoutMs = 60000) {
  const selectors = preferredSelector ? [preferredSelector, ...getOtpSelectors(flow)] : getOtpSelectors(flow);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const scopes = getSearchScopes(page);
    for (const scope of scopes) {
      for (const selector of selectors) {
        const locator = scope.locator(selector).first();
        if (await locator.isVisible({ timeout: 250 }).catch(() => false)) {
          return { kind: 'single', locator, scope };
        }
      }

      const roleCandidates = [
        scope.getByRole('textbox', { name: /otp|one[-\s]*time|verification|verify|code|pin|passcode/i }).first(),
        scope.getByLabel(/otp|one[-\s]*time|verification|verify|code|pin|passcode/i).first(),
      ];
      for (const locator of roleCandidates) {
        if (await locator.isVisible({ timeout: 250 }).catch(() => false)) {
          return { kind: 'single', locator, scope };
        }
      }

      const bodyText = await scope.locator('body').innerText({ timeout: 750 }).catch(() => '');
      const controls = await getVisibleFillableControls(scope);
      const otpControls = controls.filter((control) => isOtpishControl(control.meta));
      if (otpControls.length === 1) {
        return { kind: 'single', locator: otpControls[0].locator, scope };
      }
      if (otpControls.length > 1 && otpControls.length <= 12) {
        const singleDigitControls = otpControls.filter((control) => Number(control.meta.maxLength || 0) === 1);
        if (singleDigitControls.length >= 4) {
          return { kind: 'digits', locators: singleDigitControls.map((control) => control.locator), scope };
        }
        return { kind: 'single', locator: otpControls[0].locator, scope };
      }

      if (looksLikeOtpPage(bodyText) && controls.length === 1) {
        return { kind: 'single', locator: controls[0].locator, scope };
      }
      if (looksLikeOtpPage(bodyText) && controls.length > 1 && controls.length <= 12) {
        const singleDigitControls = controls.filter((control) => Number(control.meta.maxLength || 0) === 1);
        if (singleDigitControls.length >= 4) {
          return { kind: 'digits', locators: singleDigitControls.map((control) => control.locator), scope };
        }
      }
    }
    await page.waitForTimeout(1000);
  }
  return null;
}

async function fillOtpTarget(target, code) {
  if (target.kind === 'digits') {
    const digits = String(code || '').trim().split('');
    const count = Math.min(digits.length, target.locators.length);
    for (let index = 0; index < count; index += 1) {
      await target.locators[index].click({ timeout: 2000 }).catch(() => undefined);
      await target.locators[index].fill('');
      await target.locators[index].type(digits[index], { delay: 60 }).catch(async () => {
        await target.locators[index].fill(digits[index]);
      });
    }
    return;
  }
  const value = String(code || '').trim();
  await target.locator.click({ timeout: 2000 }).catch(() => undefined);
  await target.locator.fill('');
  await target.locator.type(value, { delay: 60 }).catch(async () => {
    await target.locator.fill(value);
  });
  await target.locator.dispatchEvent('input').catch(() => undefined);
  await target.locator.dispatchEvent('change').catch(() => undefined);
  await target.locator.press('Tab').catch(() => undefined);
}

async function waitForBrightRockOtpDeliveryProgress(page, flow, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    const dismissedInfoModal = await dismissBrightRockOtpInfoModal(page);
    if (dismissedInfoModal) {
      await publishLiveView(page, {
        force: true,
        note: 'BrightRock confirmed SMS delivery in an information popup. Waiting for the OTP entry screen.',
      }).catch(() => undefined);
    }

    const pendingSendAction = await hasVisibleOtpSendAction(page, flow);
    const target = await findOtpEntryTarget(page, flow, undefined, 1000);
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    latest = {
      pendingSendAction,
      hasOtpInput: Boolean(target),
      hasDeliveryChoice: looksLikeOtpDeliveryChoice(bodyText),
      hasSentConfirmation: looksLikeOtpSentConfirmation(bodyText),
      hasInfoModal: looksLikeBrightRockOtpInfoModal(bodyText),
      hasEntryPrompt: looksLikeOtpEntryPrompt(bodyText),
      sample: sampleText(bodyText),
    };

    if ((latest.hasOtpInput || latest.hasEntryPrompt) && !pendingSendAction) return true;
    if ((latest.hasSentConfirmation || dismissedInfoModal) && !pendingSendAction) return true;

    await page.waitForTimeout(1000);
  }

  const snapshot = await capturePolicyConfirmationSnapshot(page).catch(() => ({ sample: '' }));
  await writeOtpDiagnostics(page, 'brightrock-otp-delivery-unconfirmed', { latest });
  throw new Error(
    'BrightRock did not confirm that the SMS OTP was sent. '
    + 'The worker will not wait for a phone code until BrightRock shows a sent confirmation. '
    + `Visible page sample: ${snapshot.sample || 'none'}`,
  );
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

async function isLoginFormVisible(page, flow) {
  const username = page.locator(flow?.login?.usernameSelector || 'input[type="email"], input[type="text"], input[name*="user" i]').first();
  const password = page.locator(flow?.login?.passwordSelector || 'input[type="password"]').first();
  return (
    await username.isVisible({ timeout: 500 }).catch(() => false)
    && await password.isVisible({ timeout: 500 }).catch(() => false)
  );
}

function looksLikeCloudflareChallenge(text) {
  return /cloudflare|verify\s+you\s+are\s+human|performing\s+security\s+verification|security\s+service\s+to\s+protect\s+against\s+malicious\s+bots|not\s+a\s+bot|ray\s+id/i.test(text || '');
}

async function detectCloudflareChallenge(page) {
  const snapshot = await capturePolicyConfirmationSnapshot(page).catch(() => ({
    currentUrl: page.url(),
    title: '',
    text: '',
    sample: '',
  }));
  const text = [
    snapshot.currentUrl,
    snapshot.title,
    snapshot.text,
    snapshot.sample,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!looksLikeCloudflareChallenge(text)) return '';
  return sampleText(snapshot.sample || snapshot.text || text, 260);
}

async function waitForLoginReady(page, flow, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastCloudflareSample = '';
  while (Date.now() < deadline) {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);

    if (await isLoginFormVisible(page, flow)) {
      return { status: 'ready', checkpoint: '' };
    }

    const cloudflareCheckpoint = await detectCloudflareChallenge(page);
    if (cloudflareCheckpoint) {
      return { status: 'cloudflare', checkpoint: cloudflareCheckpoint };
    }

    await page.waitForTimeout(1000);
  }

  lastCloudflareSample = await detectCloudflareChallenge(page);
  return {
    status: lastCloudflareSample ? 'cloudflare' : 'timeout',
    checkpoint: lastCloudflareSample,
  };
}

async function resolveCloudflareChallenge(page, flow, initialCheckpoint = '') {
  const checkpoint = initialCheckpoint || await detectCloudflareChallenge(page);
  if (!checkpoint) return;

  const message = headed
    ? 'Cloudflare human verification is blocking the provider login. Complete it in the visible browser to continue.'
    : 'Cloudflare human verification is blocking the provider login. The hosted headless worker cannot complete this step automatically.';
  const warning = 'Cloudflare human verification detected before provider login.';

  await updateJob('running', {
    currentStep: 'manual_cloudflare_verification',
    message,
    warning,
  });
  await publishLiveView(page, {
    force: true,
    note: message,
  }).catch(() => undefined);

  if (!headed) {
    await writePageDiagnostics(page, 'cloudflare-human-verification-required', {
      checkpoint,
      headed,
    });
    throw new Error(
      'Cloudflare human verification blocked the provider login. '
      + 'The hosted headless worker cannot complete this step automatically or be taken over in place. '
      + 'Run the job locally in watch mode so a person can complete the verification in a visible browser, '
      + 'or ask Capital Legacy to allowlist the worker path or provide an automation-safe access route. '
      + `Visible page sample: ${checkpoint}`,
    );
  }

  const deadline = Date.now() + cloudflareResolutionTimeoutMs;
  let latestCheckpoint = checkpoint;
  while (Date.now() < deadline) {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);

    if (await isLoginFormVisible(page, flow)) {
      await updateJob('running', {
        currentStep: 'opening_login',
        message: 'Cloudflare verification completed. Resuming provider login.',
      });
      await publishLiveView(page, {
        force: true,
        note: 'Cloudflare verification completed. Provider login form is visible again.',
      }).catch(() => undefined);
      return;
    }

    latestCheckpoint = await detectCloudflareChallenge(page);
    if (!latestCheckpoint) {
      const readiness = await waitForLoginReady(page, flow, 15000);
      if (readiness.status === 'ready') {
        await updateJob('running', {
          currentStep: 'opening_login',
          message: 'Cloudflare verification completed. Resuming provider login.',
        });
        return;
      }
      latestCheckpoint = readiness.checkpoint || '';
    }

    await page.waitForTimeout(1000);
  }

  await writePageDiagnostics(page, 'cloudflare-human-verification-timeout', {
    checkpoint: latestCheckpoint || checkpoint,
    headed,
    timeoutMs: cloudflareResolutionTimeoutMs,
  });
  throw new Error(
    'Timed out waiting for manual Cloudflare verification before provider login could continue. '
    + 'Complete the verification in the visible browser and rerun the job if needed. '
    + `Visible page sample: ${latestCheckpoint || checkpoint || 'none'}`,
  );
}

async function waitForAuthCheckpointToClear(page, flow, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let latestCheckpoint = '';
  let sawRegistrationSuccess = false;
  while (Date.now() < deadline) {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);
    const dismissedRegistrationSuccess = await dismissBrightRockRegistrationSuccessModal(page);
    if (dismissedRegistrationSuccess) {
      sawRegistrationSuccess = true;
      await publishLiveView(page, {
        force: true,
        note: 'BrightRock completed registration and is returning to the login page.',
      }).catch(() => undefined);
    }
    if (await isLoginFormVisible(page, flow)) {
      return { checkpoint: '', requiresCredentialResubmit: sawRegistrationSuccess };
    }
    const checkpoint = await detectAuthCheckpoint(page, flow);
    if (!checkpoint) return { checkpoint: '', requiresCredentialResubmit: false };
    latestCheckpoint = checkpoint;
    await page.waitForTimeout(1000);
  }
  return { checkpoint: latestCheckpoint, requiresCredentialResubmit: false };
}

async function fillManualOtp(page, flow, code, preferredSelector, existingTarget) {
  const otp = flow?.otp || {};
  const target = existingTarget || await findOtpEntryTarget(page, flow, preferredSelector, 90000);
  if (!target) {
    const snapshot = await capturePolicyConfirmationSnapshot(page).catch(() => ({ sample: '' }));
    throw new Error(
      'The SMS OTP was submitted in Navigate Wealth, but the provider OTP input was not visible. '
      + `Visible page sample: ${snapshot.sample || 'none'}`,
    );
  }

  await fillOtpTarget(target, code);
  const submitScope = target.scope || page;
  const submitResult = await clickVisibleOtpSubmitAction(page, submitScope, flow);
  if (!submitResult.clicked) {
    await page.keyboard.press('Enter');
  }
  await page.waitForLoadState('domcontentloaded', { timeout: 45000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const transition = await waitForAuthCheckpointToClear(page, flow, 15000);
  if (transition.checkpoint) {
    await publishLiveView(page, {
      force: true,
      note: 'OTP was submitted, but BrightRock stayed on the verification screen.',
    }).catch(() => undefined);
    throw new Error(
      'The SMS OTP was submitted, but BrightRock stayed on the verification screen instead of continuing into the portal. '
      + `Visible page sample: ${transition.checkpoint}`,
    );
  }
  return {
    requiresCredentialResubmit: transition.requiresCredentialResubmit === true,
  };
}

async function promptForManualOtp(page, flow, preferredSelector, existingTarget) {
  const otp = flow?.otp || {};
  const timeoutMs = otp.timeoutMs || 600000;
  await updateJob('waiting_for_otp', {
    currentStep: 'manual_sms_otp',
    message: otp.instructions || 'Waiting for manual SMS OTP.',
  });
  await publishLiveView(page, {
    force: true,
    note: otp.instructions || 'Waiting for manual SMS OTP.',
  });
  let code;
  try {
    code = await waitForManualOtp(timeoutMs);
  } catch (error) {
    await writeOtpDiagnostics(page, 'manual-otp-timeout', {
      timeoutMs,
      instructions: otp.instructions || 'Waiting for manual SMS OTP.',
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      'Timed out waiting for manual OTP. The provider showed an OTP step, but no code was submitted in Navigate Wealth before the timeout. '
      + 'Worker diagnostics were captured for the OTP screen when debug artifacts are enabled.',
    );
  }
  return fillManualOtp(page, flow, code, preferredSelector, existingTarget);
}

async function completeManualOtpIfPresent(page, flow, timeoutMs = 45000) {
  const target = await findOtpEntryTarget(page, flow, undefined, timeoutMs);
  if (!target) return false;
  return promptForManualOtp(page, flow, undefined, target);
}

async function completeManualOtpAfterDelivery(page, flow) {
  return promptForManualOtp(page, flow);
}

async function forceSmsSelectionInDom(page) {
  return page.evaluate(() => {
    const normalise = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const matchesSms = (value) => /\bSMS\b/i.test(normalise(value));
    const clickElement = (element) => {
      if (!element) return false;
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      element.click();
      return true;
    };

    const smsInputs = Array.from(document.querySelectorAll('input, [role="radio"], [role="option"], [aria-label], [data-value], [value]'))
      .filter((element) => matchesSms([
        element.getAttribute('value'),
        element.getAttribute('id'),
        element.getAttribute('name'),
        element.getAttribute('aria-label'),
        element.getAttribute('data-value'),
        element.textContent,
      ].join(' ')));

    for (const element of smsInputs) {
      const input = element instanceof HTMLInputElement ? element : null;
      if (input && ['radio', 'checkbox'].includes(String(input.type || '').toLowerCase())) {
        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        clickElement(input);
        return 'input_checked';
      }
      if (clickElement(element)) return 'option_clicked';
    }

    const textNodes = Array.from(document.querySelectorAll('label, button, [role="radio"], [role="option"], [role="button"], li, div, span'))
      .filter((element) => /^SMS$/i.test(normalise(element.textContent)));
    for (const element of textNodes) {
      const target = element.closest('label, button, [role="radio"], [role="option"], [role="button"], li, div') || element;
      if (clickElement(target)) return 'text_control_clicked';
    }
    return '';
  }).catch(() => '');
}

async function detectSmsSelectionState(page) {
  return page.evaluate(() => {
    const normalise = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const matchesSms = (value) => /\bSMS\b/i.test(normalise(value));
    const smsControls = Array.from(document.querySelectorAll('input, [role="radio"], [role="option"], [aria-checked], [aria-selected], [value], [data-value]'))
      .filter((element) => matchesSms([
        element.getAttribute('value'),
        element.getAttribute('id'),
        element.getAttribute('name'),
        element.getAttribute('aria-label'),
        element.getAttribute('data-value'),
        element.textContent,
      ].join(' ')));

    if (!smsControls.length) return 'unknown';
    for (const element of smsControls) {
      if (element instanceof HTMLInputElement && element.checked) return 'selected';
      if (String(element.getAttribute('aria-checked') || '').toLowerCase() === 'true') return 'selected';
      if (String(element.getAttribute('aria-selected') || '').toLowerCase() === 'true') return 'selected';
      const className = String(element.getAttribute('class') || '');
      if (/\b(selected|active|checked)\b/i.test(className)) return 'selected';
    }
    return 'unselected';
  }).catch(() => 'unknown');
}

async function selectBrightRockSmsOtpOption(page) {
  const smsCandidates = [
    page.getByRole('radio', { name: /\bSMS\b/i }).first(),
    page.getByLabel(/\bSMS\b/i).first(),
    page.locator('input[value*="sms" i], input[id*="sms" i], input[name*="sms" i]').first(),
    page.locator('label').filter({ hasText: /^\s*SMS\s*$/i }).first(),
    page.getByText(/^\s*SMS\s*$/i).first(),
  ];

  for (const candidate of smsCandidates) {
    const exists = await candidate.count().then((count) => count > 0).catch(() => false);
    if (!exists) continue;
    const tagName = await candidate.evaluate((element) => element.tagName.toLowerCase()).catch(() => '');
    const type = await candidate.evaluate((element) => String(element.getAttribute('type') || '').toLowerCase()).catch(() => '');
    if (tagName === 'input' && ['radio', 'checkbox'].includes(type)) {
      await candidate.check({ force: true, timeout: 5000 }).catch(async () => {
        await candidate.evaluate((element) => {
          element.checked = true;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    } else {
      await clickWithOverlayFallback(page, candidate, { timeout: 5000, settleMs: 600 });
    }
    await page.waitForTimeout(500);
    const state = await detectSmsSelectionState(page);
    if (state !== 'unselected') return true;
  }

  const strategy = await forceSmsSelectionInDom(page);
  await page.waitForTimeout(700);
  const state = await detectSmsSelectionState(page);
  return Boolean(strategy) && state !== 'unselected';
}

async function chooseSmsOtpDeliveryIfPresent(page, flow) {
  const bodyText = await page.locator('body').innerText({ timeout: 2500 }).catch(() => '');
  if (!looksLikeOtpDeliveryChoice(bodyText)) {
    return false;
  }

  const selectedSms = await selectBrightRockSmsOtpOption(page);
  if (!selectedSms) {
    const snapshot = await capturePolicyConfirmationSnapshot(page).catch(() => ({ sample: '' }));
    throw new Error(
      'BrightRock asked how to receive the OTP, but the worker could not positively select SMS. '
      + `Visible page sample: ${snapshot.sample || 'none'}`,
    );
  }

  const sendCandidates = [
    ...getOtpSendActionCandidates(page, flow),
    page.getByRole('button', { name: /resend\s+(otp|code|pin|passcode)/i }).first(),
    page.locator('button, input[type="submit"], input[type="button"], [role="button"]').filter({ hasText: /resend\s+(otp|code|pin|passcode)/i }).first(),
  ];
  const sendDeadline = Date.now() + 10000;
  const seenCandidates = [];
  while (Date.now() < sendDeadline) {
    for (const candidate of sendCandidates) {
      if (!(await candidate.isVisible({ timeout: 500 }).catch(() => false))) continue;
      if (!(await candidate.isEnabled({ timeout: 500 }).catch(() => true))) continue;
      const label = await getControlLabel(candidate);
      seenCandidates.push(sampleText(label, 120));
      if (!looksLikePendingOtpSendAction(label)) continue;
      await clickWithOverlayFallback(page, candidate, { timeout: 5000, settleMs: 1500 });
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(1000);
      await waitForBrightRockOtpDeliveryProgress(page, flow, 20000);
      return true;
    }
    await page.waitForTimeout(700);
  }

  await writeOtpDiagnostics(page, 'brightrock-otp-send-action-missing', {
    seenCandidates: uniqueWarnings(seenCandidates),
  });
  throw new Error('BrightRock SMS OTP option was selected, but the Send OTP action was not visible or was still disabled.');
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

function resolveProviderLoginUrl(flow, providerAdapter) {
  const candidate = String(flow?.loginUrl || providerAdapter?.defaultLoginUrl || '').trim();
  if (!candidate) {
    throw new Error('Provider portal flow is missing a login URL. Configure the provider loginUrl before running this job.');
  }

  try {
    return new URL(candidate).toString();
  } catch {
    throw new Error(`Provider portal flow has an invalid login URL: ${candidate}`);
  }
}

async function detectAuthCheckpoint(page, flow) {
  const snapshot = await page.evaluate(() => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const bodyText = normalise(document.body?.innerText || '');
    const visibleInputs = Array.from(document.querySelectorAll('input, textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"]'))
      .filter((el) => {
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map((el) => [
        el.getAttribute('type'),
        el.getAttribute('name'),
        el.getAttribute('id'),
        el.getAttribute('placeholder'),
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.parentElement?.textContent,
      ].map(normalise).join(' '))
      .slice(0, 8);
    return {
      url: window.location.href,
      title: document.title || '',
      bodyText,
      visibleInputs,
    };
  }).catch(() => ({ url: page.url(), title: '', bodyText: '', visibleInputs: [] }));

  const text = [
    snapshot.url,
    snapshot.title,
    snapshot.bodyText,
    ...(Array.isArray(snapshot.visibleInputs) ? snapshot.visibleInputs : []),
  ].join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  if (textContainsConfiguredLabel(text, getSearchReadyLabels(flow))) {
    return '';
  }

  const hasAuthCheckpoint = /login\s*verification|verify\s+(your\s+)?(identity|login|account)|verification\s+(code|step)|one[-\s]*time\s*(pin|password|code)|\botp\b|two[-\s]*factor|multi[-\s]*factor|authenticator|security\s+code|passcode|enter\s+(the\s+)?code|send\s+(code|otp|pin)/i.test(text);
  if (!hasAuthCheckpoint) return '';

  const sample = String(snapshot.bodyText || text).replace(/\s+/g, ' ').trim().slice(0, 260);
  return sample || 'provider page is still asking for login verification';
}

async function handleManualOtpCheckpoint(page, flow) {
  const requestedSmsOtp = await chooseSmsOtpDeliveryIfPresent(page, flow);
  if (requestedSmsOtp) {
    const result = await completeManualOtpAfterDelivery(page, flow);
    return { handled: true, requiresCredentialResubmit: result?.requiresCredentialResubmit === true };
  }

  const sentVisibleOtp = await clickVisibleOtpSendAction(page, flow);
  if (sentVisibleOtp) {
    const result = await completeManualOtpAfterDelivery(page, flow);
    return { handled: true, requiresCredentialResubmit: result?.requiresCredentialResubmit === true };
  }

  const handledOtp = await completeManualOtpIfPresent(page, flow, 5000);
  return {
    handled: Boolean(handledOtp),
    requiresCredentialResubmit: Boolean(handledOtp && handledOtp?.requiresCredentialResubmit === true),
  };
}

async function waitForManualOtpCheckpointIfPresent(page, flow, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);

    const checkpoint = await detectAuthCheckpoint(page, flow);
    if (checkpoint) {
      const outcome = await handleManualOtpCheckpoint(page, flow);
      if (!outcome.handled) {
        return { handled: false, checkpoint, requiresCredentialResubmit: false };
      }
      return { handled: true, checkpoint, requiresCredentialResubmit: outcome.requiresCredentialResubmit === true };
    }

    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    if (textContainsConfiguredLabel([page.url(), bodyText].join(' '), getSearchReadyLabels(flow))) {
      return { handled: false, checkpoint: '', requiresCredentialResubmit: false };
    }

    await page.waitForTimeout(1000);
  }

  return { handled: false, checkpoint: '', requiresCredentialResubmit: false };
}

async function assertPastAuthCheckpoint(page, flow, stageLabel) {
  const checkpoint = await detectAuthCheckpoint(page, flow);
  if (!checkpoint) return;

  const outcome = await handleManualOtpCheckpoint(page, flow);
  if (outcome.handled && !outcome.requiresCredentialResubmit) return;

  throw new Error(
    `Provider is still on a login verification step before ${stageLabel}. `
    + `Complete the BrightRock verification/OTP step before policy search can continue. `
    + `Visible page sample: ${checkpoint}`,
  );
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

function providerAdapterRuntime() {
  return {
    evaluateWithNavigationRetry,
  };
}

async function findDocumentClickTarget(page, artifact, step, providerAdapter) {
  const labels = normaliseArtifactStepLabels(step, ['Policy schedule', 'Download', 'PDF', 'Statement']);
  const adapterTarget = await providerAdapter?.findDocumentClickTarget?.(page, {
    artifact,
    step,
    labels,
  }, providerAdapterRuntime());
  if (adapterTarget) {
    return adapterTarget;
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

async function runDocumentDownloadSteps(page, artifact, item, providerAdapter) {
  const steps = Array.isArray(artifact.steps) ? artifact.steps : [];
  const clickStep = steps.find((step) => step.action === 'click') || {};
  const menuStep = steps.find((step) => step.action === 'click_menu_item');
  const downloadStep = steps.find((step) => step.action === 'wait_for_download') || {};
  const timeout = Number(downloadStep.timeoutMs || menuStep?.timeoutMs || clickStep.timeoutMs || 30000);
  const directTimeout = Math.min(Number(clickStep.timeoutMs || 5000), 10000);
  const clickTarget = await findDocumentClickTarget(page, artifact, clickStep, providerAdapter);
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

async function uploadEstateDocumentArtifact(item, artifact, downloaded) {
  if (!workerSecret) {
    throw new Error('Estate document attachment requires NW_PORTAL_WORKER_SECRET live worker mode.');
  }

  const buffer = await readFile(downloaded.filePath);
  const signature = buffer.subarray(0, 5).toString('utf8');
  if (!signature.startsWith('%PDF-')) {
    throw new Error(`Downloaded ${artifact.label} is not a valid PDF.`);
  }

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'application/pdf' }), downloaded.fileName);
  formData.append('fileName', downloaded.fileName);
  formData.append('documentType', artifact.documentType || 'other');
  formData.append('artifactId', artifact.id || 'estate_document');
  formData.append('artifactLabel', artifact.label || 'Estate document');
  formData.append('title', artifact.documentType === 'last_will_scanned'
    ? `Last Will & Testament - ${item.clientName}`
    : `${artifact.label || 'Estate document'} - ${item.clientName}`);

  return apiUpload(workerJobPath(`/items/${item.id}/estate-document`), formData);
}

async function processDocumentArtifacts(page, flow, item, jobMode, providerAdapter) {
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

      downloaded = await runDocumentDownloadSteps(page, artifact, item, providerAdapter);
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

      const upload = artifact.attachTo === 'estate_documents'
        ? await uploadEstateDocumentArtifact(item, artifact, downloaded)
        : await uploadPolicyDocumentArtifact(item, artifact, downloaded);
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
    if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) {
      const meta = await locator.evaluate((el) => ({
        type: el.getAttribute('type') || '',
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || '',
        className: el.getAttribute('class') || '',
        maxLength: Number(el.getAttribute('maxlength') || el.maxLength || 0),
      })).catch(() => ({}));
      if (!isOtpishControl(meta)) return locator;
    }
  }

  for (const rememberedSelector of rememberedSelectors) {
    const locator = page.locator(rememberedSelector).first();
    if (await locator.isVisible({ timeout: 1200 }).catch(() => false)) {
      const meta = await locator.evaluate((el) => ({
        type: el.getAttribute('type') || '',
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || '',
        className: el.getAttribute('class') || '',
        maxLength: Number(el.getAttribute('maxlength') || el.maxLength || 0),
      })).catch(() => ({}));
      if (!isOtpishControl(meta)) return locator;
    }
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
      if (!(await locator.isVisible({ timeout: 800 }).catch(() => false))) continue;
      const meta = await locator.evaluate((el) => ({
        type: el.getAttribute('type') || '',
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || '',
        className: el.getAttribute('class') || '',
        maxLength: Number(el.getAttribute('maxlength') || el.maxLength || 0),
      })).catch(() => ({}));
      if (!isOtpishControl(meta)) return locator;
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
    if (!(await candidate.isVisible({ timeout: 500 }).catch(() => false))) continue;
    const meta = await candidate.evaluate((el) => ({
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      id: el.getAttribute('id') || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
      className: el.getAttribute('class') || '',
      maxLength: Number(el.getAttribute('maxlength') || el.maxLength || 0),
    })).catch(() => ({}));
    if (!isOtpishControl(meta)) return candidate;
  }

  const visibleInputs = page.locator('input, textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [contenteditable="true"]');
  const visibleCount = Math.min(await visibleInputs.count().catch(() => 0), 20);
  let firstVisible = null;
  let firstVisibleCount = 0;
  for (let index = 0; index < visibleCount; index += 1) {
    const candidate = visibleInputs.nth(index);
    if (!(await candidate.isVisible({ timeout: 500 }).catch(() => false))) continue;
    const meta = await candidate.evaluate((el) => ({
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      id: el.getAttribute('id') || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
      className: el.getAttribute('class') || '',
      maxLength: Number(el.getAttribute('maxlength') || el.maxLength || 0),
    })).catch(() => ({}));
    if (isOtpishControl(meta)) continue;
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
  await assertPastAuthCheckpoint(page, flow, 'policy search');
  await publishLiveView(page, {
    force: true,
    note: `Starting policy search for ${item.policyNumber}.`,
  }).catch(() => undefined);

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

async function extractPolicyRecord(page, flow, config, item, providerAdapter) {
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
  const providerFallback = await providerAdapter?.extractSnapshot?.(page, item, providerAdapterRuntime()) || {};
  if (providerAdapter?.snapshotDebugArtifactName) {
    await writeDebugArtifact(item, providerAdapter.snapshotDebugArtifactName, providerFallback);
  }
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
      providerAdapter?.requiresMappedCurrentValue
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
    providerAdapter?.requiresMappedCurrentValue
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
  if (providerAdapter?.requiresMappedCurrentValue && !hasMappedCurrentValue) {
    await writeDebugArtifact(item, providerAdapter.currentValueMissingArtifactName || 'provider-current-value-missing', {
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
    throw providerAdapter.buildMissingMappedCurrentValueError?.({
      fallbackCurrentValue,
      providerFallback,
      configuredFields,
      pageUrl: page.url(),
    }) || new Error(
      `Provider policy page did not produce a mapped current value. `
      + `Configured mapped fields: ${configuredFields}. URL: ${page.url()}.`,
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

async function processPolicyQueue(page, flow, config, jobMode, brain, providerAdapter) {
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
      await publishLiveView(page, {
        force: true,
        note: `Searching provider portal for ${item.clientName} / ${item.policyNumber}.`,
      });

      await searchPolicyByNumber(page, flow, item, brain);
      await publishLiveView(page, {
        force: true,
        note: `Policy search landed on ${item.clientName} / ${item.policyNumber}.`,
      });

      await updatePolicyItem(item.id, 'in_progress', {
        currentStep: 'extracting_policy',
        message: `Extracting values for ${item.clientName} / ${item.policyNumber}.`,
      });
      await publishLiveView(page, {
        force: true,
        note: `Extracting values for ${item.clientName} / ${item.policyNumber}.`,
      });

      const { rawData, extractedData, extractedFieldNames } = await extractPolicyRecord(page, flow, config, item, providerAdapter);
      console.log(`Portal item extracted ${item.clientName} / ${item.policyNumber}: ${extractedFieldNames.length ? extractedFieldNames.join(', ') : 'no mapped field names'}`);
      await writeDebugArtifact(item, 'extracted-row', {
        pageUrl: page.url(),
        extractedFieldNames,
        rawData,
        documentRequested: buildDocumentArtifacts(flow).length > 0,
      });
      const artifactResult = await processDocumentArtifacts(page, flow, item, jobMode, providerAdapter);
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
      await publishLiveView(page, {
        force: true,
        note: `Completed ${item.clientName} / ${item.policyNumber}.`,
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
      await publishLiveView(page, {
        force: true,
        note: `Failed ${item.clientName} / ${item.policyNumber}: ${errorMessage}`.slice(0, 500),
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
  await publishLiveView(page, {
    force: true,
    note: `Staging ${completed} completed policy update${completed === 1 ? '' : 's'} for review.`,
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

async function submitProviderCredentials(page, flow, username, password, options = {}) {
  const message = options.message || 'Submitting provider credentials.';
  const note = options.note || 'Provider credentials submitted.';
  await updateJob('running', { currentStep: 'submitting_credentials', message });

  const loginReady = await waitForLoginReady(page, flow, 30000);
  if (loginReady.status === 'cloudflare') {
    await resolveCloudflareChallenge(page, flow, loginReady.checkpoint);
  } else if (loginReady.status === 'timeout') {
    throw new Error(
      'Provider login form did not become visible before credentials could be submitted. '
      + `Current URL: ${page.url()}`,
    );
  }

  await (await visibleLocator(page, flow.login.usernameSelector, 10000)).fill(username);
  await (await visibleLocator(page, flow.login.passwordSelector, 10000)).fill(password);
  await (await visibleLocator(page, flow.login.submitSelector)).click();
  await publishLiveView(page, { force: true, note });
}

async function runJob(jobId, requestedMode = mode) {
  activeJobId = jobId;
  jobWarnings.splice(0, jobWarnings.length);
  itemWarnings.clear();
  lastLiveViewUploadAt = 0;
  liveViewUploadPromise = null;
  let browser;
  let context;
  let page;
  let liveViewTicker;
  try {
    const { job, flow, config, items, credentials, brain } = await loadRuntime(jobId);
    assertPortalRuntimeConfigured(flow);
    const providerAdapter = getProviderAdapter({ job, flow });
    flow.loginUrl = resolveProviderLoginUrl(flow, providerAdapter);
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
    const contextOptions = {
      viewport: { width: 1440, height: 900 },
      ...(recordVideo && debugDir
        ? {
          recordVideo: {
            dir: `${debugDir}/videos`,
            size: { width: 1440, height: 900 },
          },
        }
        : {}),
    };
    if (recordVideo && debugDir) {
      await ensureDir(`${debugDir}/videos`);
    }
    if (recordTrace && debugDir) {
      await ensureDir(`${debugDir}/traces`);
    }
    context = await browser.newContext(contextOptions);
    if (recordTrace && debugDir) {
      await context.tracing.start({ screenshots: true, snapshots: true });
    }
    page = await context.newPage();
    liveViewTicker = setInterval(() => {
      publishLiveView(page).catch(() => undefined);
    }, liveViewIntervalMs);
    liveViewTicker.unref?.();

    await page.goto(flow.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await publishLiveView(page, { force: true, note: 'Provider login page opened.' });
    await submitProviderCredentials(page, flow, username, password);

    const otpCheckpoint = await waitForManualOtpCheckpointIfPresent(page, flow, 12000);
    if (otpCheckpoint.requiresCredentialResubmit) {
      await submitProviderCredentials(page, flow, username, password, {
        message: 'Re-submitting provider credentials after BrightRock registration redirect.',
        note: 'Provider credentials re-submitted after BrightRock registration redirect.',
      });
      await waitForManualOtpCheckpointIfPresent(page, flow, 12000);
    }
    await assertPastAuthCheckpoint(page, flow, 'post-login navigation');

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
      await publishLiveView(page, { force: true, note: 'Provider policy navigation steps completed.' });
    }

    if (jobMode === 'discover') {
      await updateJob('discovering', { currentStep: 'capturing_discovery_report', message: 'Capturing selector discovery report. No policy data will be staged.' });
      await publishLiveView(page, { force: true, note: 'Capturing selector discovery report.' });
      const report = await captureDiscoveryReport(page, flow, { mode: 'discover' });
      await postDiscoveryReport(report);
      return;
    }

    if (Array.isArray(items) && items.length > 0) {
      await updateJob('extracting', {
        currentStep: 'processing_policy_queue',
        message: `Processing ${items.length} Navigate Wealth polic${items.length === 1 ? 'y' : 'ies'} one by one.`,
      });
      await publishLiveView(page, { force: true, note: 'Processing policy queue.' });
      await processPolicyQueue(page, flow, config, jobMode, brain, providerAdapter);
      return;
    }

    await updateJob('extracting', { currentStep: jobMode === 'dry-run' ? 'dry_run_extracting_policy_rows' : 'extracting_policy_rows', message: 'Extracting provider policy rows.' });
    await publishLiveView(page, { force: true, note: 'Extracting provider policy rows.' });
    const rows = await extractRows(page, flow);

    if (jobMode === 'dry-run') {
      await publishLiveView(page, { force: true, note: `Dry run extracted ${rows.length} provider row${rows.length === 1 ? '' : 's'}.` });
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
    if (page) {
      await publishLiveView(page, {
        force: true,
        note: `Worker failed: ${sampleText(error instanceof Error ? error.message : String(error), 400)}`,
      }).catch(() => undefined);
    }
    const configurationError = isPortalConfigurationError(error);
    await updateJob('failed', {
      currentStep: 'failed',
      message: configurationError
        ? 'Portal flow is not configured for automation.'
        : 'Portal worker failed.',
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    if (configurationError) {
      console.warn(error instanceof Error ? error.message : String(error));
      return;
    }
    throw error;
  } finally {
    if (page) {
      await publishLiveView(page, {
        force: true,
        note: 'Worker session ended on this provider screen.',
      }).catch(() => undefined);
    }
    if (liveViewTicker) clearInterval(liveViewTicker);
    if (context && recordTrace && debugDir) {
      await context.tracing.stop({
        path: buildDebugAssetPath(`trace-${Date.now()}`, 'zip'),
      }).catch(() => undefined);
    }
    if (context) await context.close().catch(() => undefined);
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
