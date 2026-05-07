import { describe, expect, it } from 'vitest';
import {
  PortalConfigurationError,
  assertPortalRuntimeConfigured,
  getPortalRuntimeConfigurationIssues,
  isHttpUrl,
} from '../../../../scripts/provider-portal-runtime-validation.mjs';

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
    expect(() => assertPortalRuntimeConfigured({
      ...readyFlow,
      loginUrl: '',
    })).toThrow(PortalConfigurationError);
  });

  it('allows a complete runtime flow', () => {
    expect(() => assertPortalRuntimeConfigured(readyFlow)).not.toThrow();
  });
});
