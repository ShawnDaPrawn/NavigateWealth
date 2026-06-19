import { describe, expect, it } from 'vitest';
import {
  getFnaStatusDescription,
  getFnaStatusLabel,
  resolveFnaHubView,
} from '@/shared/fna-intake/fna-intake-labels';

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

  it('uses client and adviser friendly status labels', () => {
    expect(getFnaStatusLabel('submitted', 'client')).toBe('With your adviser');
    expect(getFnaStatusLabel('client_draft', 'client')).toBe('Continue');
    expect(getFnaStatusLabel('submitted', 'adviser')).toBe('Review queue');
  });
});
