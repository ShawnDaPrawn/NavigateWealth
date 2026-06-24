import { describe, expect, it } from 'vitest';
import { getFnaStatusDescription, resolveFnaHubView } from '@/shared/fna-intake/fna-intake-labels';

describe('fna-intake-labels', () => {
  it('resolves hub views by batch status', () => {
    expect(resolveFnaHubView('published')).toBe('results');
    expect(resolveFnaHubView('client_draft')).toBe('start');
    expect(resolveFnaHubView('submitted')).toBe('waiting');
  });

  it('shows request-info copy when returned to client', () => {
    const description = getFnaStatusDescription('client_draft', 'client', {
      requestInfoAt: '2026-05-01T00:00:00.000Z',
    });
    expect(description).toContain('needs more information');
  });
});
