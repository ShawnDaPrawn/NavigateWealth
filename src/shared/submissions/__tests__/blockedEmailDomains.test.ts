import { describe, expect, it } from 'vitest';

import {
  extractEmailDomain,
  getBlockedEmailDomain,
  getBlockedEmailDomainWarning,
} from '../blockedEmailDomains';

describe('extractEmailDomain', () => {
  it('normalizes valid email domains', () => {
    expect(extractEmailDomain('  Person@PoisonWord.com ')).toBe('poisonword.com');
  });

  it('returns null for malformed email strings', () => {
    expect(extractEmailDomain('not-an-email')).toBeNull();
  });
});

describe('getBlockedEmailDomain', () => {
  it('blocks exact scam domains', () => {
    expect(getBlockedEmailDomain('person@test.com')).toBe('test.com');
    expect(getBlockedEmailDomain('person@poisonword.com')).toBe('poisonword.com');
  });

  it('blocks scam subdomains too', () => {
    expect(getBlockedEmailDomain('person@mail.test.com')).toBe('mail.test.com');
  });

  it('allows all other domains', () => {
    expect(getBlockedEmailDomain('person@example.com')).toBeNull();
  });
});

describe('getBlockedEmailDomainWarning', () => {
  it('returns a clear warning message', () => {
    expect(getBlockedEmailDomainWarning('test.com')).toContain('test.com');
    expect(getBlockedEmailDomainWarning('test.com')).toContain('scam activity');
  });
});
