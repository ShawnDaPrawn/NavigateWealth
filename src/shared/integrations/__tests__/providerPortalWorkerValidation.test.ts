import { beforeAll, describe, expect, it } from 'vitest';
import {
  PortalConfigurationError,
  assertPortalRuntimeConfigured,
  getPortalRuntimeConfigurationIssues,
  isHttpUrl,
} from '../../../../scripts/provider-portal-runtime-validation.mjs';
import { looksLikeSearchNoResultsText } from '../../../../scripts/portal-worker/page-utils.mjs';

let searchHelpers: Awaited<typeof import('../../../../scripts/portal-worker/search.mjs')>;

beforeAll(async () => {
  process.env.NW_PORTAL_JOB_ID = 'vitest-worker-search-safeguards';
  process.env.NW_PORTAL_WORKER_SECRET = 'vitest-worker-secret';
  searchHelpers = await import('../../../../scripts/portal-worker/search.mjs');
});

const readyFlow = {
  loginUrl: 'https://login.example.com',
  credentialProfiles: [{ id: 'example-profile' }],
  login: {
    usernameSelector: 'input[name="username"]',
    passwordSelector: 'input[type="password"]',
    submitSelector: 'button[type="submit"]',
  },
};

describe('provider portal worker runtime validation', () => {
  it('accepts http and https login URLs only', () => {
    expect(isHttpUrl('https://login.example.com')).toBe(true);
    expect(isHttpUrl('http://localhost:3000/login')).toBe(true);
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl('ftp://login.example.com')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });

  it('reports missing portal flow configuration before Playwright navigation', () => {
    const issues = getPortalRuntimeConfigurationIssues({
      ...readyFlow,
      loginUrl: '',
      login: {
        ...readyFlow.login,
        usernameSelector: '',
      },
    });

    expect(issues).toContain('Portal login URL is not configured as a valid http(s) URL.');
    expect(issues).toContain('Portal username selector is not configured.');
  });

  it('throws a configuration error for invalid runtime flow', () => {
    expect(() =>
      assertPortalRuntimeConfigured({
        ...readyFlow,
        loginUrl: '',
      }),
    ).toThrow(PortalConfigurationError);
  });

  it('allows a complete runtime flow', () => {
    expect(() => assertPortalRuntimeConfigured(readyFlow)).not.toThrow();
  });
});

describe('provider portal worker search safeguards', () => {
  it('rejects Discovery global FAQ search controls before policy search', () => {
    expect(
      searchHelpers.isLikelyGlobalSiteSearchControl({
        placeholder: "Search Discovery products' information and FAQs",
      }),
    ).toBe(true);

    const choice = searchHelpers.chooseDeterministicSearchCandidate([
      {
        candidateId: 'global-search',
        selector: 'header input[type="search"]',
        interaction: 'fill',
        placeholder: "Search Discovery products' information and FAQs",
      },
      {
        candidateId: 'client-search',
        selector: '#clientSearch',
        interaction: 'fill',
        placeholder: 'Search clients',
      },
    ]);

    expect(choice?.candidate.candidateId).toBe('client-search');
  });

  it('detects no-results pages that echo the policy number', () => {
    const discoveryNoResults =
      'Your search criteria: 1093795415 No search results found matching your search criteria.';

    expect(looksLikeSearchNoResultsText(discoveryNoResults)).toBe(true);
    expect(
      searchHelpers.chooseDeterministicResultCandidate(
        [
          {
            candidateId: 'empty-result',
            selector: '.search-results',
            text: discoveryNoResults,
            nearbyText: discoveryNoResults,
          },
        ],
        '1093795415',
      ),
    ).toBeNull();
  });

  it('does not classify a policy detail with values as a no-results page', () => {
    expect(
      looksLikeSearchNoResultsText(
        'Policy number 1093795415 Current Value R 123 456.78 Premium R 1 234.56',
      ),
    ).toBe(false);
  });
});
