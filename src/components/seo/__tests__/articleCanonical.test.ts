import { describe, expect, it } from 'vitest';
import { knownArticleCanonicalUrl } from '../articleCanonical';

describe('knownArticleCanonicalUrl', () => {
  it('maps the Easter holiday-scam duplicate onto the surviving article', () => {
    expect(
      knownArticleCanonicalUrl(
        'holiday-scams-fake-deals-and-banking-fraud-how-to-protect-yourself-this-easter',
        'https://www.navigatewealth.co',
      ),
    ).toBe(
      'https://www.navigatewealth.co/resources/article/holiday-scams-fake-deals-and-banking-fraud-how-to-protect-yourself',
    );
  });

  it('returns null for articles that are not known duplicates', () => {
    expect(knownArticleCanonicalUrl('tfsa-guide', 'https://www.navigatewealth.co')).toBeNull();
  });
});
