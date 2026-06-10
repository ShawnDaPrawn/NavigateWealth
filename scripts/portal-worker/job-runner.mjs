/**
 * Portal worker — job orchestration (run + poll loops).
 * =====================================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Owns the per-job Playwright lifecycle: runtime load,
 * browser launch, login → OTP → navigation, then the mode-specific path
 * (discover / policy queue / row extraction), plus the polling loop.
 * Behaviour-preserving move.
 */
import { getProviderAdapter } from '../provider-adapters/index.mjs';
import {
  assertPortalRuntimeConfigured,
  isPortalConfigurationError,
} from '../provider-portal-runtime-validation.mjs';
import {
  apiBase,
  authToken,
  debugDir,
  forceStage,
  headed,
  liveViewIntervalMs,
  mode,
  recordTrace,
  recordVideo,
  workerId,
} from './config.mjs';
import { addJobWarning, itemWarnings, jobWarnings, setActiveJobId } from './state.mjs';
import { apiFetch, jobPath, loadRuntime, updateJob } from './api.mjs';
import { publishLiveView, resetLiveViewState } from './live-view.mjs';
import { buildDebugAssetPath, ensureDir } from './debug-artifacts.mjs';
import { sampleText } from './page-utils.mjs';
import {
  attemptConfiguredNavigation,
  resolveProviderLoginUrl,
  runPolicyListSteps,
  submitProviderCredentials,
} from './login.mjs';
import { assertPastAuthCheckpoint, waitForManualOtpCheckpointIfPresent } from './otp.mjs';
import { captureDiscoveryReport, postDiscoveryReport } from './discovery.mjs';
import { processPolicyQueue } from './queue.mjs';
import { extractRows } from './extraction.mjs';

export async function runJob(jobId, requestedMode = mode) {
  setActiveJobId(jobId);
  jobWarnings.splice(0, jobWarnings.length);
  itemWarnings.clear();
  resetLiveViewState();
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

export async function pollForJobs() {
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
