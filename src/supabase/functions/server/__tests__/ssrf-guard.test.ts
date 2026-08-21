import { describe, expect, it } from 'vitest';
import { assertPublicHttpUrl, assertPublicHttpsUrl } from '../ssrf-guard.ts';

describe('server-side URL guard', () => {
  it.each([
    'http://127.0.0.1/admin',
    'http://10.0.0.1/',
    'http://172.16.0.1/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/',
    'http://[fd00::1]/',
    'file:///etc/passwd',
  ])('rejects non-public target %s', (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow();
  });

  it('accepts a public HTTPS URL and rejects HTTP for webhooks', () => {
    expect(assertPublicHttpsUrl('https://hooks.example.com/events').hostname).toBe(
      'hooks.example.com',
    );
    expect(() => assertPublicHttpsUrl('http://hooks.example.com/events')).toThrow('Only https');
  });
});
