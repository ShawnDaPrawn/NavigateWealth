import { describe, expect, it } from 'vitest';

import { normalizeNavigateWealthUrl, SITE_ORIGIN, siteAbsoluteUrl } from '../siteOrigin';

describe('siteOrigin helpers', () => {
  it('builds canonical site URLs', () => {
    expect(siteAbsoluteUrl('/links')).toBe(`${SITE_ORIGIN}/links`);
    expect(siteAbsoluteUrl('contact')).toBe(`${SITE_ORIGIN}/contact`);
  });

  it('normalizes Navigate Wealth web hosts to the canonical www domain', () => {
    expect(normalizeNavigateWealthUrl('https://navigatewealth.co.za')).toBe(SITE_ORIGIN);
    expect(normalizeNavigateWealthUrl('https://navigatewealth.co.za/contact')).toBe(
      `${SITE_ORIGIN}/contact`,
    );
    expect(normalizeNavigateWealthUrl('http://www.navigatewealth.co.za/services?x=1#quote')).toBe(
      `${SITE_ORIGIN}/services?x=1#quote`,
    );
    expect(normalizeNavigateWealthUrl('navigatewealth.co/resources')).toBe(
      `${SITE_ORIGIN}/resources`,
    );
  });

  it('does not rewrite non-web or external URLs', () => {
    expect(normalizeNavigateWealthUrl('mailto:info@navigatewealth.co.za')).toBe(
      'mailto:info@navigatewealth.co.za',
    );
    expect(normalizeNavigateWealthUrl('https://linkedin.com/company/navigate-wealth')).toBe(
      'https://linkedin.com/company/navigate-wealth',
    );
  });
});
