import { describe, expect, it } from 'vitest';
import { readResourcesSearchQuery, writeResourcesSearchQuery } from '../resourcesSearch';

describe('resourcesSearch', () => {
  it('reads and trims the sitelinks q param', () => {
    expect(readResourcesSearchQuery(new URLSearchParams('q=tax-free'))).toBe('tax-free');
    expect(readResourcesSearchQuery(new URLSearchParams('q=%20retirement%20'))).toBe('retirement');
    expect(readResourcesSearchQuery(new URLSearchParams('section=insights'))).toBe('');
  });

  it('writes q without dropping other params', () => {
    const next = writeResourcesSearchQuery(new URLSearchParams('section=market-updates'), 'TFSA');
    expect(next.get('section')).toBe('market-updates');
    expect(next.get('q')).toBe('TFSA');
  });

  it('trims the stored q param and removes it when the query is cleared', () => {
    expect(writeResourcesSearchQuery(new URLSearchParams(), 'tax ').get('q')).toBe('tax');
    const next = writeResourcesSearchQuery(new URLSearchParams('section=insights&q=oil'), '  ');
    expect(next.get('q')).toBeNull();
    expect(next.get('section')).toBe('insights');
  });
});
