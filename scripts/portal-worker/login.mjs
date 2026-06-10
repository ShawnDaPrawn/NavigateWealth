/**
 * Portal worker — login, Cloudflare, and configured navigation.
 * =============================================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Owns the provider login form, Cloudflare human-verification
 * handling, configured URL navigation with landing checks, and the policy-list
 * navigation steps. Behaviour-preserving move.
 */
import { cloudflareResolutionTimeoutMs, headed } from './config.mjs';
import { addJobWarning } from './state.mjs';
import { updateJob } from './api.mjs';
import { publishLiveView } from './live-view.mjs';
import { writePageDiagnostics } from './debug-artifacts.mjs';
import {
  capturePolicyConfirmationSnapshot,
  clickWithOverlayFallback,
  sampleText,
  visibleLocator,
} from './page-utils.mjs';

export async function isLoginFormVisible(page, flow) {
  const username = page.locator(flow?.login?.usernameSelector || 'input[type="email"], input[type="text"], input[name*="user" i]').first();
  const password = page.locator(flow?.login?.passwordSelector || 'input[type="password"]').first();
  return (
    await username.isVisible({ timeout: 500 }).catch(() => false)
    && await password.isVisible({ timeout: 500 }).catch(() => false)
  );
}

export function looksLikeCloudflareChallenge(text) {
  return /cloudflare|verify\s+you\s+are\s+human|performing\s+security\s+verification|security\s+service\s+to\s+protect\s+against\s+malicious\s+bots|not\s+a\s+bot|ray\s+id/i.test(text || '');
}

export async function detectCloudflareChallenge(page) {
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

export async function waitForLoginReady(page, flow, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
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

  const lastCloudflareSample = await detectCloudflareChallenge(page);
  return {
    status: lastCloudflareSample ? 'cloudflare' : 'timeout',
    checkpoint: lastCloudflareSample,
  };
}

export async function resolveCloudflareChallenge(page, flow, initialCheckpoint = '') {
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

export function describeNavigationFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/net::ERR_ABORTED/i.test(message)) return 'the provider aborted the page load';
  if (/Timeout/i.test(message)) return 'the page did not load before the timeout';
  return message;
}

export function buildNavigationWarning(prefix, attemptedUrl, reason, fallbackMessage) {
  return `${prefix} Attempted URL: ${attemptedUrl}. Reason: ${reason}. ${fallbackMessage}`.slice(0, 500);
}

export async function detectNavigationLandingIssue(page, loginUrl, attemptedUrl) {
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

export async function attemptConfiguredNavigation(page, options) {
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

export function resolveProviderLoginUrl(flow, providerAdapter) {
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

export async function runPolicyListSteps(page, steps = []) {
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

export async function submitProviderCredentials(page, flow, username, password, options = {}) {
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
