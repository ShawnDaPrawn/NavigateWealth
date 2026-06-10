/**
 * Portal worker — OTP + auth-checkpoint orchestration.
 * ====================================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Owns OTP detection/entry/submission, the manual-SMS pause
 * loop, auth-checkpoint detection, and the BrightRock-specific delivery
 * choreography (SMS option, info modal, registration redirect). The
 * BrightRock-named helpers are a known provider quirk that should migrate
 * behind the adapter boundary in a later phase. Behaviour-preserving move.
 */
import { apiFetch, jobPath, updateJob } from './api.mjs';
import { publishLiveView } from './live-view.mjs';
import { writeOtpDiagnostics } from './debug-artifacts.mjs';
import { uniqueWarnings } from './state.mjs';
import {
  capturePolicyConfirmationSnapshot,
  clickWithOverlayFallback,
  getControlLabel,
  getSearchScopes,
  isOtpishControl,
  sampleText,
  splitLabels,
  textContainsConfiguredLabel,
} from './page-utils.mjs';
import { isLoginFormVisible } from './login.mjs';

export function getOtpSelectors(flow) {
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

export async function getVisibleFillableControls(scope) {
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

export function looksLikeOtpPage(text) {
  return /otp|one[-\s]*time|verification|verify|code|pin|passcode|send\s+otp|sms/i.test(text || '');
}

export function looksLikeOtpDeliveryChoice(text) {
  return /how\s+would\s+you\s+like\s+to\s+receive\s+your\s+otp|email\s+sms|send\s+otp/i.test(text || '');
}

export function looksLikeOtpSentConfirmation(text) {
  return /otp\s+(has\s+been\s+)?sent|code\s+(has\s+been\s+)?sent|sms\s+(has\s+been\s+)?sent|sent\s+(to|via)\s+(your\s+)?(mobile|cell|phone|sms)|message\s+(has\s+been\s+)?sent/i.test(text || '');
}

export function looksLikeBrightRockOtpInfoModal(text) {
  return /information[\s\S]*an\s+sms\s+will\s+be\s+sent\s+containing\s+your\s+otp/i.test(text || '')
    || /if\s+you\s+have\s+a\s+registered\s+account\s+with\s+a\s+contact\s+number\s+linked\s+to\s+it,\s+an\s+sms\s+will\s+be\s+sent\s+containing\s+your\s+otp/i.test(text || '');
}

export function looksLikeBrightRockRegistrationSuccess(text) {
  return /you\s+have\s+been\s+successfully\s+registered/i.test(text || '')
    || /you\s+will\s+be\s+redirected\s+to\s+the\s+login\s+page/i.test(text || '');
}

export function looksLikeOtpEntryPrompt(text) {
  return /enter\s+(the\s+)?(otp|code|pin|passcode)|verification\s+(otp|code|pin|passcode)/i.test(text || '');
}

export function looksLikePendingOtpSendAction(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value || /\bresend\b/i.test(value)) return false;
  return /\bsend\s+(otp|code|pin|passcode|sms)\b/i.test(value)
    || /^(send|go|continue|next|submit)$/i.test(value);
}

export function looksLikeOtpSubmitAction(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return false;
  if (/\b(back|request\s+new\s+otp|new\s+otp|resend|send\s+otp|send\s+code|send\s+pin)\b/i.test(value)) {
    return false;
  }
  return /^(confirm|verify|continue|submit|go|next)$/i.test(value)
    || /\b(confirm|verify|continue|submit)\b/i.test(value);
}

export function getSearchReadyLabels(flow) {
  return splitLabels(flow?.search?.searchInputLabels)
    .filter((label) => label.length >= 8 && !/^search$/i.test(label))
    .concat(['Search by reference number', 'Policy details', 'Policy structure', 'Cover summary', 'FSP Junction']);
}

export function getOtpSendActionCandidates(page, flow) {
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

export function getOtpSubmitActionCandidates(scope, flow) {
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

export async function clickVisibleOtpSubmitAction(page, scope, flow) {
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

export async function hasVisibleOtpSendAction(page) {
  for (const candidate of getOtpSendActionCandidates(page)) {
    if (!(await candidate.isVisible({ timeout: 250 }).catch(() => false))) continue;
    if (!(await candidate.isEnabled({ timeout: 250 }).catch(() => true))) continue;
    const label = await getControlLabel(candidate);
    if (!looksLikePendingOtpSendAction(label)) continue;
    return true;
  }
  return false;
}

export async function clickVisibleOtpSendAction(page, flow) {
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

export async function dismissBrightRockOtpInfoModal(page) {
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

export async function dismissBrightRockRegistrationSuccessModal(page) {
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

export async function findOtpEntryTarget(page, flow, preferredSelector, timeoutMs = 60000) {
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

export async function fillOtpTarget(target, code) {
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

export async function waitForBrightRockOtpDeliveryProgress(page, flow, timeoutMs = 20000) {
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

export async function waitForManualOtp(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const data = await apiFetch(jobPath('/otp'));
    if (data.otp) return data.otp;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error('Timed out waiting for manual OTP.');
}

export async function waitForAuthCheckpointToClear(page, flow, timeoutMs = 20000) {
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

export async function fillManualOtp(page, flow, code, preferredSelector, existingTarget) {
  const _otp = flow?.otp || {};
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

export async function promptForManualOtp(page, flow, preferredSelector, existingTarget) {
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
      { cause: error },
    );
  }
  return fillManualOtp(page, flow, code, preferredSelector, existingTarget);
}

export async function completeManualOtpIfPresent(page, flow, timeoutMs = 45000) {
  const target = await findOtpEntryTarget(page, flow, undefined, timeoutMs);
  if (!target) return false;
  return promptForManualOtp(page, flow, undefined, target);
}

export async function completeManualOtpAfterDelivery(page, flow) {
  return promptForManualOtp(page, flow);
}

export async function forceSmsSelectionInDom(page) {
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

export async function detectSmsSelectionState(page) {
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

export async function selectBrightRockSmsOtpOption(page) {
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

export async function chooseSmsOtpDeliveryIfPresent(page, flow) {
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

export async function detectAuthCheckpoint(page, flow) {
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

export async function handleManualOtpCheckpoint(page, flow) {
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

export async function waitForManualOtpCheckpointIfPresent(page, flow, timeoutMs = 12000) {
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

export async function assertPastAuthCheckpoint(page, flow, stageLabel) {
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
