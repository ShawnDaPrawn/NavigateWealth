import { describe, expect, it } from 'vitest';
import { resolveFnaHubView, getFnaStatusLabel } from '../fna-intake-labels';

describe('fna-intake-labels', () => {
  it('routes published status to results view', () => {
    expect(resolveFnaHubView('published')).toBe('results');
  });

  it('routes client_draft to start hub (Continue CTA), not auto-open wizard', () => {
    expect(resolveFnaHubView('client_draft')).toBe('start');
  });

  it('routes submitted and adviser draft to waiting state', () => {
    expect(resolveFnaHubView('submitted')).toBe('waiting');
    expect(resolveFnaHubView('draft')).toBe('waiting');
  });

  it('uses client-friendly status labels', () => {
    expect(getFnaStatusLabel('submitted', 'client')).toBe('With your adviser');
    expect(getFnaStatusLabel('client_draft', 'client')).toBe('Continue');
    expect(getFnaStatusLabel('submitted', 'adviser')).toBe('Review queue');
  });
});
