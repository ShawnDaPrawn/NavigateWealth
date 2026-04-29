import { describe, expect, it } from 'vitest';

import {
  extractClientIp,
  getBlockedClientIp,
  getBlockedIpAddress,
  getBlockedIpAddressWarning,
  normalizeIpAddress,
} from '../blockedIpAddresses';

describe('normalizeIpAddress', () => {
  it('normalizes IPv4 values from proxy headers', () => {
    expect(normalizeIpAddress(' 105.224.67.241 ')).toBe('105.224.67.241');
    expect(normalizeIpAddress('105.224.67.241, 10.0.0.1')).toBe('105.224.67.241');
    expect(normalizeIpAddress('::ffff:105.224.67.241')).toBe('105.224.67.241');
    expect(normalizeIpAddress('105.224.67.241:443')).toBe('105.224.67.241');
  });

  it('returns null for empty values', () => {
    expect(normalizeIpAddress('')).toBeNull();
    expect(normalizeIpAddress(undefined)).toBeNull();
  });
});

describe('extractClientIp', () => {
  it('prefers the first populated proxy header', () => {
    const ipAddress = extractClientIp((headerName) => {
      if (headerName === 'CF-Connecting-IP') return '';
      if (headerName === 'X-Forwarded-For') return '105.224.67.241, 10.0.0.1';
      if (headerName === 'X-Real-IP') return '41.0.0.1';
      return null;
    });

    expect(ipAddress).toBe('105.224.67.241');
  });
});

describe('getBlockedIpAddress', () => {
  it('blocks configured abusive IP addresses', () => {
    expect(getBlockedIpAddress('105.224.67.241')).toBe('105.224.67.241');
    expect(getBlockedIpAddress('::ffff:105.224.67.241')).toBe('105.224.67.241');
  });

  it('allows other IP addresses', () => {
    expect(getBlockedIpAddress('41.132.12.8')).toBeNull();
  });
});

describe('getBlockedClientIp', () => {
  it('blocks matching client IP headers', () => {
    const blockedIpAddress = getBlockedClientIp((headerName) => (
      headerName === 'True-Client-IP' ? '105.224.67.241' : null
    ));

    expect(blockedIpAddress).toBe('105.224.67.241');
  });
});

describe('getBlockedIpAddressWarning', () => {
  it('returns a clear warning message', () => {
    expect(getBlockedIpAddressWarning('105.224.67.241')).toContain('105.224.67.241');
    expect(getBlockedIpAddressWarning('105.224.67.241')).toContain('abuse activity');
  });
});
