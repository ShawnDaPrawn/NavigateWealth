import { describe, expect, it } from 'vitest';
import { resolveFnaHubView } from '@/shared/fna-intake/fna-intake-labels';

describe('ClientFNAHub view resolution', () => {
  it('routes submitted status to waiting until user opens view', () => {
    expect(resolveFnaHubView('submitted')).toBe('waiting');
    expect(resolveFnaHubView('published')).toBe('results');
    expect(resolveFnaHubView('client_draft')).toBe('start');
  });
});
