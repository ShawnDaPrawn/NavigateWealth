/**
 * Portal worker — provider-neutral Playwright page utilities.
 * ===========================================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Pure page helpers with no Navigate Wealth API or state
 * dependencies: locator/visibility helpers, navigation-safe evaluation,
 * overlay-tolerant clicking, text snapshots, and normalisers.
 * Behaviour-preserving move.
 */

export async function visibleLocator(pageOrLocator, selector, timeout = 30000) {
  const locator = pageOrLocator.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout });
  return locator;
}

export async function _firstVisibleSelector(page, selectors, timeoutMs) {
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

export function getSearchScopes(page) {
  return [page, ...page.frames().filter((frame) => frame !== page.mainFrame())];
}

export function isOtpishControl(meta = {}) {
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

export async function getControlLabel(locator) {
  return locator.evaluate((element) => [
    element.getAttribute('value'),
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.textContent,
  ].filter(Boolean).join(' ')).catch(() => '');
}

export function textContainsConfiguredLabel(text, labels) {
  return labels.some((label) => label && new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text));
}

export function normalisePolicyNumber(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
    .replace(/[-_/]/g, '');
}

export function sampleText(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export async function capturePolicyConfirmationSnapshot(page) {
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

export async function waitForPolicyNumberConfirmation(page, policyNumber, timeoutMs = 25000) {
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

export function splitLabels(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isNavigationContextError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Execution context was destroyed|most likely because of a navigation|Cannot find context with specified id|navigation/i.test(message);
}

export async function evaluateWithNavigationRetry(page, pageFunction, arg, options = {}) {
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

export function providerAdapterRuntime() {
  return {
    evaluateWithNavigationRetry,
  };
}

export function isClickInterceptionError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /intercepts pointer events|Timeout .* exceeded|not clickable|element is outside|another element/i.test(message);
}

export async function clickWithOverlayFallback(page, locator, options = {}) {
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

export async function waitAfterSubmit(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);
  await page.waitForTimeout(800);
}

export async function pageContainsPolicyNumber(page, policyNumber) {
  const normalized = normalisePolicyNumber(policyNumber);
  if (!normalized) return false;
  const text = await page.locator('body').innerText({ timeout: 2500 }).catch(() => '');
  return normalisePolicyNumber(text).includes(normalized);
}
