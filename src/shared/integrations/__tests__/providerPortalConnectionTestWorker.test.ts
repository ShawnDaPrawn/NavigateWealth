/**
 * What a connection test is allowed to start without
 * ==================================================
 *
 * A connection test runs at the one moment a provider is least configured: an
 * adviser has typed in a portal address and a password and wants to know
 * whether they work. The runtime gate was written for a real sync run and
 * demands three CSS selectors before a browser will open — which makes the
 * cheap diagnostic impossible exactly when it is the only useful thing to do.
 *
 * So a connection test may start without them and the worker falls back to
 * generic sign-in field guesses. A real run keeps the strict gate, because
 * there a guessed field gets filled with something that may not belong in it
 * and the run goes on to write to the book. That asymmetry is what this pins.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertPortalRuntimeConfigured,
  getPortalRuntimeConfigurationIssues,
} from '../../../../scripts/provider-portal-runtime-validation.mjs';

const unconfiguredFlow = {
  loginUrl: 'https://login.example.com',
  credentialProfiles: [{ id: 'example-profile' }],
  login: {},
};

const repoRoot = resolve(__dirname, '../../../..');
const jobRunnerSource = readFileSync(
  resolve(repoRoot, 'scripts/portal-worker/job-runner.mjs'),
  'utf8',
);
// `login.mjs` cannot be imported here: it pulls in `config.mjs`, which parses
// worker CLI arguments at module load and throws without a job id. The runtime
// validation module has no such dependency, so it is imported for real above
// and only the worker's own source is read as text.
const loginSource = readFileSync(resolve(repoRoot, 'scripts/portal-worker/login.mjs'), 'utf8');

const fallbackSelector = (name: string) => {
  const match = loginSource.match(new RegExp(`${name}\\s*=\\s*\n?\\s*'([^']+)'`));
  if (!match) throw new Error(`Could not read ${name} from login.mjs`);
  return match[1];
};

const FALLBACK_USERNAME_SELECTOR = fallbackSelector('FALLBACK_USERNAME_SELECTOR');
const FALLBACK_PASSWORD_SELECTOR = fallbackSelector('FALLBACK_PASSWORD_SELECTOR');
const FALLBACK_SUBMIT_SELECTOR = fallbackSelector('FALLBACK_SUBMIT_SELECTOR');

describe('a connection test may start before selectors are configured', () => {
  it('raises no selector issues when they are not required', () => {
    expect(
      getPortalRuntimeConfigurationIssues(unconfiguredFlow, { requireLoginSelectors: false }),
    ).toEqual([]);
  });

  it('starts without throwing', () => {
    expect(() =>
      assertPortalRuntimeConfigured(unconfiguredFlow, { requireLoginSelectors: false }),
    ).not.toThrow();
  });

  it('still refuses without a sign-in address — there is nothing to open', () => {
    expect(
      getPortalRuntimeConfigurationIssues(
        { ...unconfiguredFlow, loginUrl: '' },
        { requireLoginSelectors: false },
      ),
    ).toContain('Portal login URL is not configured as a valid http(s) URL.');
  });

  it('still refuses without a credential profile — there is nothing to sign in as', () => {
    expect(
      getPortalRuntimeConfigurationIssues(
        { ...unconfiguredFlow, credentialProfiles: [] },
        { requireLoginSelectors: false },
      ),
    ).toContain('Portal credential profile is not configured.');
  });
});

describe('a real run keeps the strict gate', () => {
  it('still demands the login selectors by default', () => {
    const issues = getPortalRuntimeConfigurationIssues(unconfiguredFlow);
    expect(issues).toContain('Portal username selector is not configured.');
    expect(issues).toContain('Portal password selector is not configured.');
    expect(issues).toContain('Portal login submit selector is not configured.');
  });

  it('only relaxes the gate for a connection test', () => {
    expect(jobRunnerSource).toContain(
      'assertPortalRuntimeConfigured(flow, { requireLoginSelectors: !job.connectionTest })',
    );
    expect(jobRunnerSource).toContain(
      'const loginOptions = job.connectionTest ? { allowSelectorFallback: true } : {};',
    );
  });
});

describe('the fallback field guesses', () => {
  it('guesses the password field as narrowly as possible', () => {
    // A mis-guessed username lands in some harmless text box. A mis-guessed
    // password field would put the firm's portal password somewhere it does not
    // belong, so this guess is allowed to match nothing rather than guess wide.
    expect(FALLBACK_PASSWORD_SELECTOR).toBe('input[type="password"]');
  });

  it('guesses a username field without ever matching a password input', () => {
    expect(FALLBACK_USERNAME_SELECTOR).not.toContain('password');
  });

  it('guesses a submit control rather than any button on the page', () => {
    expect(FALLBACK_SUBMIT_SELECTOR).toContain('type="submit"');
  });
});

describe('a connection test stops at the signed-in page', () => {
  it('returns before post-login navigation, so an unmapped portal still passes', () => {
    const shortCircuit = jobRunnerSource.indexOf('if (job.connectionTest) {');
    const postLoginNavigation = jobRunnerSource.indexOf('if (flow.navigation?.postLoginUrl) {');
    const discovery = jobRunnerSource.indexOf("if (jobMode === 'discover') {");

    expect(shortCircuit).toBeGreaterThan(-1);
    expect(shortCircuit).toBeLessThan(postLoginNavigation);
    expect(shortCircuit).toBeLessThan(discovery);
  });

  it('reports a terminal status, so the connection record is written', () => {
    const shortCircuit = jobRunnerSource.slice(
      jobRunnerSource.indexOf('if (job.connectionTest) {'),
      jobRunnerSource.indexOf('if (flow.navigation?.postLoginUrl) {'),
    );
    expect(shortCircuit).toContain("updateJob('discovery_ready'");
    expect(shortCircuit).toContain('connection_verified');
  });

  it('never reaches the policy queue or row extraction', () => {
    const shortCircuit = jobRunnerSource.indexOf('if (job.connectionTest) {');
    expect(jobRunnerSource.indexOf('processPolicyQueue(')).toBeGreaterThan(shortCircuit);
    expect(jobRunnerSource.indexOf('await extractRows(')).toBeGreaterThan(shortCircuit);
  });
});
