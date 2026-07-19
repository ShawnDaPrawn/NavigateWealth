/**
 * Portal worker — policy search + brain (smart assist) client.
 * ============================================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Owns search-input discovery, the server-side brain
 * decision/memory calls, deterministic fallbacks, result selection, and the
 * policy-number confirmation journey. Behaviour-preserving move.
 */
import { apiFetch, workerJobPath } from './api.mjs';
import { addItemWarning } from './state.mjs';
import { publishLiveView } from './live-view.mjs';
import { assertPastAuthCheckpoint } from './otp.mjs';
import { attemptConfiguredNavigation } from './login.mjs';
import {
  clickWithOverlayFallback,
  evaluateWithNavigationRetry,
  isOtpishControl,
  looksLikeSearchNoResultsText,
  normalisePolicyNumber,
  pageContainsPolicyNumber,
  splitLabels,
  waitAfterSubmit,
  waitForPolicyNumberConfirmation,
} from './page-utils.mjs';

export function candidateSearchText(candidate) {
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

export function isLikelyGlobalSiteSearchControl(candidate = {}) {
  const text = candidateSearchText(candidate);
  return /\bsearch\s+discovery\s+products?\b.*\b(?:information|faqs?)\b/i.test(text)
    || /\bproducts?['’]?\s+information\s+and\s+faqs?\b/i.test(text)
    || /\b(?:global|site|header)\s+search\b/i.test(text)
    || /\b(?:faqs?|frequently\s+asked\s+questions)\b/i.test(text);
}

export function isUsableSearchControl(candidate = {}) {
  return !isOtpishControl(candidate) && !isLikelyGlobalSiteSearchControl(candidate);
}

export function chooseDeterministicSearchCandidate(candidates = []) {
  const usable = candidates.filter((candidate) => {
    const text = candidateSearchText(candidate);
    return !/password|otp|one[-\s]*time|verification|username|log\s*in|login|sign\s*in|home|legal|help|contact/i.test(text)
      && !isLikelyGlobalSiteSearchControl(candidate);
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

export function chooseDeterministicResultCandidate(candidates = [], policyNumber = '') {
  const normalizedPolicyNumber = normalisePolicyNumber(policyNumber);
  const scored = candidates
    .filter((candidate) => candidate?.selector)
    .filter((candidate) => !looksLikeSearchNoResultsText(candidateSearchText(candidate)))
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

export function brainAssistConfig(flow) {
  const brain = flow?.search?.brain || {};
  return {
    enabled: brain.enabled === true,
    maxDecisionsPerItem: Math.max(1, Math.min(Number(brain.maxDecisionsPerItem || 2), 5)),
    rememberSelectors: brain.rememberSelectors !== false,
  };
}

export function rememberedSelectorsForStage(brain, stage) {
  const memory = brain?.memory || {};
  const list = stage === 'search_result' ? memory.searchResultHints : memory.searchInputHints;
  return Array.isArray(list)
    ? list.map((entry) => String(entry?.selector || '').trim()).filter(Boolean)
    : [];
}

export function describeBrainDecision(decision) {
  if (!decision) return 'no decision';
  return `${decision.action || 'stop_uncertain'} (${decision.confidence || 'low'}): ${decision.reason || 'No reason supplied.'}`;
}

export function describeBrainFallbackError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.replace(/\s+/g, ' ').trim().slice(0, 160) || 'unknown error';
}

export async function rememberBrainSelector(stage, item, candidate, source = 'brain') {
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

export async function requestBrainDecision(stage, page, flow, item, snapshot) {
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

export async function captureInputCandidates(page) {
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

export async function captureSearchResultCandidates(page, flow) {
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

export async function chooseInputWithBrain(page, flow, item) {
  let snapshot = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    snapshot = await captureInputCandidates(page);
    if (Array.isArray(snapshot?.candidates)) {
      snapshot = {
        ...snapshot,
        candidates: snapshot.candidates.filter((candidate) => !isLikelyGlobalSiteSearchControl(candidate)),
      };
    }
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
  let response;
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

export async function chooseSearchResultWithBrain(page, flow, item) {
  const snapshot = await captureSearchResultCandidates(page, flow);
  if (!Array.isArray(snapshot?.candidates) || snapshot.candidates.length === 0) {
    throw new Error('No visible search results were available for smart assist.');
  }
  const fallback = chooseDeterministicResultCandidate(snapshot.candidates, item.policyNumber);
  let response;
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

export async function findInputByIntent(page, selector, labels = [], rememberedSelectors = []) {
  if (selector) {
    const locators = page.locator(selector);
    const count = Math.min(await locators.count().catch(() => 0), 20);
    for (let index = 0; index < count; index += 1) {
      const locator = locators.nth(index);
      if (!(await locator.isVisible({ timeout: 1500 }).catch(() => false))) continue;
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
      if (isUsableSearchControl(meta)) return locator;
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
      if (isUsableSearchControl(meta)) return locator;
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
      if (isUsableSearchControl(meta)) return locator;
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
    if (isUsableSearchControl(meta)) return candidate;
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
    if (!isUsableSearchControl(meta)) continue;
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

export async function submitPolicySearch(page, search, searchInput, item) {
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

export async function openPolicySearchResult(page, flow, item, brain) {
  const search = flow.search || {};
  const normalizedPolicyNumber = normalisePolicyNumber(item.policyNumber);
  const noResultsText = splitLabels(search.noResultsText);
  const dataQaKey = String(item.policyNumber || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  for (const text of noResultsText) {
    if (await page.getByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first().isVisible({ timeout: 500 }).catch(() => false)) {
      throw new Error(`Provider search returned "${text}" for policy ${item.policyNumber}.`);
    }
  }
  const bodyText = await page.locator('body').innerText({ timeout: 2500 }).catch(() => '');
  if (looksLikeSearchNoResultsText(bodyText)) {
    const sample = bodyText.replace(/\s+/g, ' ').trim().slice(0, 220);
    throw new Error(
      `Provider search returned no results for policy ${item.policyNumber}. `
      + `Visible text sample: ${sample || 'none'}`,
    );
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

export async function searchPolicyByNumber(page, flow, item, brain) {
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
