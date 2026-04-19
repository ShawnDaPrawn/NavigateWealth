import { readFile, unlink } from 'node:fs/promises';

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
    const searchRegex = /(search|find|lookup|policy|client|investor|investment|account|portfolio|contract|member|record|practice|fund)/i;
    const navigationRegex = /(clients?|investors?|polic(?:y|ies)|funds?|portfolio|practice|member|account|records?)/i;
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
    const interactiveElements = Array.from(document.querySelectorAll(
      'button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [tabindex], [onclick], [data-testid*="search" i], [class*="search" i], [aria-label*="search" i], [title*="search" i]',
    ))
      .filter((el) => isVisible(el))
      .slice(0, 40);

    const triggerCandidates = interactiveElements.map((el) => {
      const signalText = [
        normalise(el.textContent),
        normalise(el.getAttribute('aria-label')),
        normalise(el.getAttribute('title')),
        normalise(el.getAttribute('data-testid')),
        normalise(el.getAttribute('class')),
      ].join(' ');
      return {
        signalText,
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
      };
    }).filter((candidate) => candidate.signalText || candidate.text || candidate.nearbyText);

    const searchMatchedTriggers = triggerCandidates.filter((candidate) => searchRegex.test(candidate.signalText));
    const navMatchedTriggers = triggerCandidates.filter((candidate) => navigationRegex.test(candidate.signalText));
    const selectedTriggers = (
      searchMatchedTriggers.length > 0
        ? searchMatchedTriggers
        : navMatchedTriggers.length > 0
          ? navMatchedTriggers
          : triggerCandidates
    ).slice(0, 12);

    const triggerElements = selectedTriggers.map((candidate, index) => ({
      candidateId: `trigger-${index + 1}`,
      selector: candidate.selector,
      tag: candidate.tag,
      type: candidate.type,
      role: candidate.role,
      placeholder: candidate.placeholder,
      name: candidate.name,
      id: candidate.id,
      ariaLabel: candidate.ariaLabel,
      title: candidate.title,
      text: candidate.text,
      nearbyText: candidate.nearbyText,
      interaction: candidate.interaction,
    }));
    const pageTextSample = normalise(document.body?.innerText || '').slice(0, 1200);
    return {
      currentUrl: window.location.href,
      title: document.title,
      pageTextSample,
      candidates: [...directElements, ...triggerElements],
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
  const response = await requestBrainDecision('search_input', page, flow, item, snapshot);
  const decision = response?.decision || null;
  if (!decision || decision.action !== 'use_candidate' || !decision.candidateId) {
    throw new Error(`Smart assist stopped without a safe search-field choice: ${describeBrainDecision(decision)}`);
  }
  const candidate = snapshot.candidates.find((entry) => entry.candidateId === decision.candidateId);
  if (!candidate?.selector) {
    throw new Error('Smart assist chose a search field candidate that is no longer available.');
  }
  return { candidate, decision };
}

async function chooseSearchResultWithBrain(page, flow, item) {
  const snapshot = await captureSearchResultCandidates(page, flow);
  if (!Array.isArray(snapshot?.candidates) || snapshot.candidates.length === 0) {
    throw new Error('No visible search results were available for smart assist.');
  }
  const response = await requestBrainDecision('search_result', page, flow, item, snapshot);
  const decision = response?.decision || null;
  if (!decision || decision.action !== 'use_candidate' || !decision.candidateId) {
    throw new Error(`Smart assist stopped without a safe result choice: ${describeBrainDecision(decision)}`);
  }
  const candidate = snapshot.candidates.find((entry) => entry.candidateId === decision.candidateId);
  if (!candidate?.selector) {
    throw new Error('Smart assist chose a result candidate that is no longer available.');
  }
  return { candidate, decision };
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

  throw new Error('Could not confidently find the policy schedule download action.');
}

function safeDownloadedPdfName(item, suggestedFilename) {
  const baseName = String(suggestedFilename || `${item.policyNumber || item.id}-policy-schedule.pdf`)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '');
  return baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName || 'policy_schedule'}.pdf`;
}

async function downloadPolicySchedule(page, flow, item) {
  const policySchedule = flow.policySchedule || {};
  const labels = splitLabels(policySchedule.downloadLabels || ['Policy schedule', 'Download', 'PDF', 'Statement']);
  const timeout = Number(policySchedule.waitForDownloadMs || 30000);
  const action = await findClickableByIntent(page, policySchedule.downloadSelector, labels);

  const downloadPromise = page.waitForEvent('download', { timeout });
  await action.click();
  const download = await downloadPromise;
  const failure = await download.failure();
  if (failure) throw new Error(`Provider PDF download failed: ${failure}`);

  const filePath = await download.path();
  if (!filePath) {
    throw new Error('Provider created a PDF download, but Playwright could not access the file path.');
  }

  return {
    filePath,
    fileName: safeDownloadedPdfName(item, download.suggestedFilename()),
  };
}

async function uploadPolicyScheduleDocument(item, downloaded, documentType = 'policy_schedule') {
  if (!workerSecret) {
    throw new Error('Policy schedule attachment requires NW_PORTAL_WORKER_SECRET live worker mode.');
  }

  const buffer = await readFile(downloaded.filePath);
  const signature = buffer.subarray(0, 5).toString('utf8');
  if (!signature.startsWith('%PDF-')) {
    throw new Error('Downloaded policy schedule is not a valid PDF.');
  }

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'application/pdf' }), downloaded.fileName);
  formData.append('fileName', downloaded.fileName);
  formData.append('documentType', documentType);

  return apiUpload(workerJobPath(`/items/${item.id}/policy-document`), formData);
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
    'textarea[placeholder*="search" i]',
    'textarea[aria-label*="search" i]',
    'select[name*="search" i]',
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

async function submitPolicySearch(page, search) {
  if (search?.submitSelector) {
    const button = page.locator(search.submitSelector).first();
    if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
      await Promise.all([
        button.click(),
        page.waitForLoadState('domcontentloaded').catch(() => undefined),
      ]);
      return;
    }
  }
  await page.keyboard.press('Enter');
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
}

async function openPolicySearchResult(page, flow, item, brain) {
  const search = flow.search || {};
  const normalizedPolicyNumber = normalisePolicyNumber(item.policyNumber);
  const noResultsText = splitLabels(search.noResultsText);

  for (const text of noResultsText) {
    if (await page.getByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first().isVisible({ timeout: 500 }).catch(() => false)) {
      throw new Error(`Provider search returned "${text}" for policy ${item.policyNumber}.`);
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
      await Promise.all([
        link.click(),
        page.waitForLoadState('domcontentloaded').catch(() => undefined),
      ]);
    } else {
      await Promise.all([
        container.click(),
        page.waitForLoadState('domcontentloaded').catch(() => undefined),
      ]);
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
      await Promise.all([
        candidate.click().catch(async () => {
          const nestedAction = candidate.locator('a, button, [role="link"], [role="button"]').first();
          if (await nestedAction.isVisible({ timeout: 500 }).catch(() => false)) {
            await nestedAction.click();
          } else {
            throw new Error('Remembered result selector was not clickable.');
          }
        }),
        page.waitForLoadState('domcontentloaded').catch(() => undefined),
      ]);
      await rememberBrainSelector('search_result', item, { selector }, 'deterministic');
      return;
    }
  }

  if (smartAssist.enabled && brain?.available) {
    const { candidate, decision } = await chooseSearchResultWithBrain(page, flow, item);
    const locator = page.locator(candidate.selector).first();
    const nestedAction = locator.locator(search.resultLinkSelector || 'a, button, [role="link"], [role="button"]').first();
    if (await nestedAction.isVisible({ timeout: 800 }).catch(() => false)) {
      await Promise.all([
        nestedAction.click(),
        page.waitForLoadState('domcontentloaded').catch(() => undefined),
      ]);
    } else {
      await Promise.all([
        locator.click(),
        page.waitForLoadState('domcontentloaded').catch(() => undefined),
      ]);
    }
    addItemWarning(item.id, `Smart assist chose a search result. ${describeBrainDecision(decision)}`);
    if (smartAssist.rememberSelectors) {
      await rememberBrainSelector('search_result', item, candidate, 'brain');
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
        await Promise.all([
          candidateLocator.click(),
          page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined),
        ]);
        await page.waitForTimeout(1200);
        if (smartAssist.rememberSelectors) {
          await rememberBrainSelector('search_input', item, brainChoice.candidate, 'brain');
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
  await submitPolicySearch(page, search);
  await page.waitForTimeout(1500);
  if (usedBrainCandidate && smartAssist.rememberSelectors) {
    await rememberBrainSelector('search_input', item, usedBrainCandidate, 'brain');
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
    const isUseful = (value) => {
      const text = normalise(value);
      return text && text.length <= 220;
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
        const labelLower = label.toLowerCase();
        const labelElement = elements.find((el) => normalise(el.textContent).toLowerCase().includes(labelLower));
        if (!labelElement) continue;

        const row = labelElement.closest('tr');
        if (row) {
          const cells = Array.from(row.querySelectorAll('th,td'));
          const labelCellIndex = cells.findIndex((cell) => normalise(cell.textContent).toLowerCase().includes(labelLower));
          if (labelCellIndex >= 0) {
            const nextCell = cells[labelCellIndex + 1];
            if (isUseful(nextCell?.textContent)) {
              value = cleanValue(nextCell.textContent, label);
              sourceLabel = label;
              break;
            }
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

          const parentText = cleanValue(parent.textContent, label);
          if (isUseful(parentText) && parentText.toLowerCase() !== labelLower) {
            value = parentText;
            sourceLabel = label;
            break;
          }
        }
      }

      result[field.sourceHeader] = { value, sourceLabel };
    }
    return result;
  }, fields);
}

async function extractPolicyRecord(page, flow, config, item) {
  const mappingHeaders = Object.keys(config?.fieldMapping || {});
  const configuredFields = Array.isArray(flow.extraction?.fields) ? flow.extraction.fields : [];
  const fieldByHeader = new Map(configuredFields.map((field) => [field.sourceHeader, field]));
  const fields = (mappingHeaders.length ? mappingHeaders : configuredFields.map((field) => field.sourceHeader))
    .map((sourceHeader) => fieldByHeader.get(sourceHeader) || { sourceHeader, labels: [sourceHeader], selector: '' });

  const extracted = await extractByLabels(page, fields);
  const rawData = {};

  for (const field of fields) {
    const sourceHeader = field.sourceHeader;
    const labelValue = extracted[sourceHeader]?.value || '';
    rawData[sourceHeader] = labelValue;

    if (!rawData[sourceHeader] && field.selector) {
      const selectorValue = await readField(page, field).catch(() => '');
      rawData[sourceHeader] = selectorValue;
    }

    if (/policy\s*(number|no)|reference/i.test(sourceHeader)) {
      rawData[sourceHeader] = item.policyNumber;
    }
  }

  if (!Object.keys(rawData).some((key) => /policy\s*(number|no)|reference/i.test(key))) {
    rawData['Policy Number'] = item.policyNumber;
  }

  return {
    rawData,
    extractedData: Object.fromEntries(Object.entries(extracted).map(([key, data]) => [key, data.value])),
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

      const { rawData, extractedData } = await extractPolicyRecord(page, flow, config, item);
      let documentResult = null;
      let documentWarning = '';

      if (flow.policySchedule?.enabled) {
        try {
          await updatePolicyItem(item.id, 'in_progress', {
            currentStep: jobMode === 'dry-run' ? 'checking_policy_schedule_pdf' : 'attaching_policy_schedule_pdf',
            message: jobMode === 'dry-run'
              ? `Checking policy schedule PDF for ${item.clientName} / ${item.policyNumber}.`
              : `Downloading and replacing policy schedule PDF for ${item.clientName} / ${item.policyNumber}.`,
          });

          const downloaded = await downloadPolicySchedule(page, flow, item);
          try {
            if (jobMode === 'dry-run') {
              documentWarning = `Policy schedule PDF found (${downloaded.fileName}); not attached during dry run.`;
            } else {
              const upload = await uploadPolicyScheduleDocument(item, downloaded, flow.policySchedule.documentType || 'policy_schedule');
              documentResult = upload.document || null;
            }
          } finally {
            await unlink(downloaded.filePath).catch(() => undefined);
          }
        } catch (error) {
          if (flow.policySchedule.required === false) {
            documentWarning = `Policy schedule PDF was not attached: ${error instanceof Error ? error.message : String(error)}`;
          } else {
            throw error;
          }
        }
      }

      await updatePolicyItem(item.id, 'completed', {
        currentStep: 'completed',
        message: [
          `Extracted ${Object.values(rawData).filter((value) => String(value || '').trim()).length} mapped value(s).`,
          documentResult ? `Policy schedule PDF replaced (${documentResult.fileName}).` : '',
          documentWarning,
        ].filter(Boolean).join(' '),
        rawData,
        extractedData,
        matchConfidence: 'high',
        documentAttached: Boolean(documentResult),
        documentFileName: documentResult?.fileName,
        documentUpdatedAt: documentResult?.uploadDate,
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
    if (step.action === 'goto') {
      if (!step.url) throw new Error(`Policy list step ${step.id || ''} is missing a URL.`);
      await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout });
    } else if (step.action === 'click') {
      await (await visibleLocator(page, step.selector, timeout)).click();
      await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => undefined);
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
