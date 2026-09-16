/**
 * Portal worker — the navigator agent loop.
 * =========================================
 *
 * The selector walk asks "which element matches my configured selector?".
 * The navigator asks "given this page and this goal, what should I do next?",
 * performs one action, looks again, and repeats. That is the difference
 * between a provider that needs a hand-written adapter and one that does not.
 *
 * Three things keep this honest:
 *
 *   1. CREDENTIALS NEVER LEAVE THE WORKER. The server returns an action with
 *      a `valueRef` ("username" | "password" | "policy_number"); the real
 *      string is substituted here, locally. The observation sent to the model
 *      describes what a control IS, never what is typed in it.
 *   2. THE MODEL CANNOT INVENT A TARGET. Every observed element is tagged with
 *      a `data-nw-agent` attribute, and actions address that tag. A candidate
 *      id that was not in the observation is rejected server-side before it
 *      ever gets here.
 *   3. OTP AND PUSH APPROVAL REUSE THE TESTED PATH. The navigator decides WHEN
 *      a checkpoint is present; otp.mjs still does the HOW.
 *
 * A stage that succeeds is recorded as a playbook: the next run replays those
 * steps directly and only falls back to the model when a step no longer
 * matches, which is what keeps the cost flat as providers are added.
 */
import { workerJobPath, apiFetch } from './api.mjs';
import { publishLiveView } from './live-view.mjs';
import { addItemWarning } from './state.mjs';
import { handleManualOtpCheckpoint, waitForPushApprovalToClear } from './otp.mjs';
import { pageContainsPolicyNumber, sampleText } from './page-utils.mjs';

const AGENT_TAG = 'data-nw-agent';
const DEFAULT_MAX_STEPS = 12;

/**
 * Tag every interactive element on the page and describe it.
 *
 * Deliberately returns no element VALUES — only what a control is and the
 * text around it. Anything personal in that text is redacted server-side
 * before it reaches the model.
 */
export async function observePage(page) {
  return page.evaluate((tagName) => {
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return false;
      const style = window.getComputedStyle(el);
      return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') > 0.05;
    };

    const nearby = (el) => {
      const parent = el.closest('label, td, th, li, tr, div, section, fieldset') || el.parentElement;
      const text = String(parent?.innerText || '').replace(/\s+/g, ' ').trim();
      return text.slice(0, 200);
    };

    document.querySelectorAll(`[${tagName}]`).forEach((el) => el.removeAttribute(tagName));

    const selector = 'input, select, textarea, button, a[href], [role="button"], [role="link"], [role="tab"], [role="option"], [onclick]';
    const elements = Array.from(document.querySelectorAll(selector)).filter(isVisible);

    const candidates = [];
    elements.slice(0, 60).forEach((el, index) => {
      const candidateId = `c${index + 1}`;
      el.setAttribute(tagName, candidateId);
      candidates.push({
        candidateId,
        tag: el.tagName.toLowerCase(),
        type: String(el.getAttribute('type') || ''),
        role: String(el.getAttribute('role') || ''),
        name: String(el.getAttribute('name') || ''),
        id: String(el.id || ''),
        placeholder: String(el.getAttribute('placeholder') || ''),
        ariaLabel: String(el.getAttribute('aria-label') || ''),
        text: String(el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        nearbyText: nearby(el),
        disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      });
    });

    const heading = document.querySelector('h1, h2, [role="heading"]');
    return {
      url: String(location.href || ''),
      title: String(document.title || ''),
      heading: String(heading?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      pageTextSample: String(document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 2500),
      candidates,
    };
  }, AGENT_TAG);
}

/**
 * A selector worth writing into the playbook — stable across runs, unlike the
 * observation tag, which is reassigned on every look.
 */
export function durableSelector(candidate) {
  if (!candidate) return '';
  if (candidate.id) return `#${candidate.id}`;
  if (candidate.name) return `${candidate.tag}[name="${candidate.name}"]`;
  if (candidate.ariaLabel) return `${candidate.tag}[aria-label="${candidate.ariaLabel}"]`;
  if (candidate.placeholder) return `${candidate.tag}[placeholder="${candidate.placeholder}"]`;
  if (candidate.text) return `${candidate.tag}:has-text("${candidate.text.slice(0, 40)}")`;
  return '';
}

/** Resolve a valueRef to a real string. The model never sees these. */
function resolveValue(action, secrets) {
  switch (action.valueRef) {
    case 'policy_number':
      return String(secrets.policyNumber || '');
    case 'username':
      return String(secrets.username || '');
    case 'password':
      return String(secrets.password || '');
    case 'literal':
      return String(action.literalValue || '');
    default:
      return '';
  }
}

/** Never log or warn with a credential in it. */
function describeAction(action) {
  const target = action.candidateId ? ` on ${action.candidateId}` : '';
  if (action.action === 'fill' || action.action === 'select') {
    const what = action.valueRef === 'literal' ? `"${action.literalValue}"` : `the ${action.valueRef.replace('_', ' ')}`;
    return `${action.action}${target} with ${what}`;
  }
  if (action.action === 'press') return `press ${action.key}`;
  if (action.action === 'goto') return `goto ${action.url}`;
  return `${action.action}${target}`;
}

/**
 * Perform one navigator action.
 *
 * Returns { ok, note } — a failed action is not fatal; it goes into the
 * history so the next decision can route around it.
 */
export async function applyAgentAction(page, action, flow, secrets) {
  const locator = action.candidateId ? page.locator(`[${AGENT_TAG}="${action.candidateId}"]`).first() : null;

  switch (action.action) {
    case 'click': {
      await locator.click({ timeout: 15000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => undefined);
      return { ok: true, note: 'clicked' };
    }
    case 'fill': {
      const value = resolveValue(action, secrets);
      if (!value) return { ok: false, note: `no value available for ${action.valueRef}` };
      await locator.fill(value, { timeout: 15000 });
      return { ok: true, note: 'filled' };
    }
    case 'select': {
      const value = resolveValue(action, secrets);
      if (!value) return { ok: false, note: `no value available for ${action.valueRef}` };
      await locator.selectOption(value, { timeout: 15000 });
      return { ok: true, note: 'selected' };
    }
    case 'press': {
      if (locator) await locator.press(action.key, { timeout: 15000 });
      else await page.keyboard.press(action.key);
      await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => undefined);
      return { ok: true, note: `pressed ${action.key}` };
    }
    case 'goto': {
      await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      return { ok: true, note: 'navigated' };
    }
    case 'wait': {
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
      return { ok: true, note: 'waited' };
    }
    case 'await_otp': {
      // The navigator spotted the checkpoint; the tested OTP path handles it.
      await handleManualOtpCheckpoint(page, flow);
      return { ok: true, note: 'handled the one-time PIN checkpoint' };
    }
    case 'await_push_approval': {
      await waitForPushApprovalToClear(page, flow);
      return { ok: true, note: 'push approval cleared' };
    }
    default:
      return { ok: false, note: `unsupported action ${action.action}` };
  }
}

async function requestDecision(stage, observation, item, history, playbookHint) {
  const data = await apiFetch(workerJobPath('/agent/decide'), {
    method: 'POST',
    body: JSON.stringify({
      stage,
      policyNumber: item?.policyNumber || '',
      observation,
      history,
      playbookHint: playbookHint || null,
    }),
  });
  return data;
}

export async function loadAgentPlaybook() {
  try {
    return await apiFetch(workerJobPath('/agent/playbook'));
  } catch {
    return { agent: { enabled: false }, playbook: { stages: {} } };
  }
}

async function recordAgentPlaybook(stage, steps, repaired) {
  if (!steps.length) return;
  try {
    await apiFetch(workerJobPath('/agent/playbook'), {
      method: 'POST',
      body: JSON.stringify({ stage, steps, repaired: repaired === true }),
    });
  } catch (error) {
    console.warn(`Could not record the ${stage} playbook: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Replay a recorded playbook step. Returns true when it still matches the
 * page, false when the portal has changed and the model has to take over.
 */
async function replayStep(page, step, flow, secrets) {
  if (!step.selector) return false;
  const locator = page.locator(step.selector).first();
  const visible = await locator.isVisible({ timeout: 4000 }).catch(() => false);
  if (!visible) return false;

  try {
    if (step.action === 'click') {
      await locator.click({ timeout: 10000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => undefined);
      return true;
    }
    if (step.action === 'fill') {
      const value = resolveValue({ valueRef: step.valueRef, literalValue: '' }, secrets);
      if (!value) return false;
      await locator.fill(value, { timeout: 10000 });
      return true;
    }
    if (step.action === 'press') {
      await locator.press('Enter', { timeout: 10000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => undefined);
      return true;
    }
    if (step.action === 'await_otp') {
      await handleManualOtpCheckpoint(page, flow);
      return true;
    }
    if (step.action === 'await_push_approval') {
      await waitForPushApprovalToClear(page, flow);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Drive one stage to its goal.
 *
 * Replays the recorded playbook first (cheap, no model calls), then hands to
 * the navigator from the first step that no longer matches. Returns
 * { status: 'done' | 'stuck' | 'exhausted', reason, steps, usedAgent }.
 */
export async function runAgentStage(page, options) {
  const {
    stage,
    flow,
    item,
    secrets,
    playbook = {},
    maxSteps = DEFAULT_MAX_STEPS,
    agentConfig = {},
  } = options;

  const recordedSteps = Array.isArray(playbook?.stages?.[stage]) ? playbook.stages[stage] : [];
  const performed = [];
  const history = [];
  let usedAgent = false;
  let repaired = false;

  // 1. Replay what worked last time.
  let replayIndex = 0;
  if (agentConfig.replayPlaybook !== false) {
    for (const step of recordedSteps) {
      const ok = await replayStep(page, step, flow, secrets);
      if (!ok) break;
      performed.push(step);
      history.push(`replayed ${step.action} (${step.note || step.selector})`);
      replayIndex += 1;
    }
    if (replayIndex > 0) {
      console.log(`Navigator replayed ${replayIndex}/${recordedSteps.length} recorded step(s) for ${stage}.`);
    }
    if (replayIndex > 0 && replayIndex < recordedSteps.length) repaired = true;
  }

  // 2. If the stage goal is already met, stop before spending a model call.
  if (stage === 'confirm_policy' && item?.policyNumber) {
    const confirmed = await pageContainsPolicyNumber(page, item.policyNumber).catch(() => false);
    if (confirmed) {
      if (performed.length) await recordAgentPlaybook(stage, performed, repaired);
      return { status: 'done', reason: 'Policy number confirmed on the open page.', steps: performed, usedAgent };
    }
  }

  // 3. Hand over to the navigator.
  for (let step = 0; step < maxSteps; step += 1) {
    const observation = await observePage(page);
    const hint = recordedSteps[replayIndex + step] || null;
    let response;
    try {
      response = await requestDecision(stage, observation, item, history, hint);
    } catch (error) {
      return {
        status: 'stuck',
        reason: `Navigator request failed: ${error instanceof Error ? error.message : String(error)}`,
        steps: performed,
        usedAgent,
      };
    }

    if (response.available === false) {
      return { status: 'stuck', reason: response.decision?.reason || 'Navigator unavailable.', steps: performed, usedAgent };
    }

    const decision = response.decision || {};
    usedAgent = true;
    repaired = true;

    if (decision.action === 'done') {
      await recordAgentPlaybook(stage, performed, repaired);
      return { status: 'done', reason: decision.reason || 'Stage goal met.', steps: performed, usedAgent };
    }
    if (decision.action === 'stuck') {
      return { status: 'stuck', reason: decision.reason || 'Navigator could not make progress.', steps: performed, usedAgent };
    }

    const summary = describeAction(decision);
    console.log(`Navigator (${stage}) step ${step + 1}: ${summary} — ${decision.reason}`);
    await publishLiveView(page, { note: `Navigator: ${summary}` }).catch(() => undefined);

    let result;
    try {
      result = await applyAgentAction(page, decision, flow, secrets);
    } catch (error) {
      result = { ok: false, note: error instanceof Error ? error.message : String(error) };
    }

    history.push(`${summary} → ${result.ok ? result.note : `FAILED: ${result.note}`}`);
    if (result.ok) {
      const candidate = observation.candidates.find((entry) => entry.candidateId === decision.candidateId);
      performed.push({
        action: decision.action,
        selector: durableSelector(candidate),
        valueRef: decision.valueRef,
        note: candidate ? (candidate.ariaLabel || candidate.placeholder || candidate.text || candidate.name || '') : decision.reason,
      });
    } else if (item?.id) {
      addItemWarning(item.id, `Navigator step did not apply: ${sampleText(result.note, 160)}`);
    }
  }

  return {
    status: 'exhausted',
    reason: `The navigator used its ${maxSteps}-step budget for ${stage} without reaching the goal.`,
    steps: performed,
    usedAgent,
  };
}
