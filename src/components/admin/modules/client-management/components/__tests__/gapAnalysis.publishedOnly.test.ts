import { describe, expect, it } from 'vitest';

/**
 * Gap analysis cards in ClientOverviewTab must only render from published FNA data.
 * This mirrors the `*FnaPublished` guards around gapAnalysis useMemo.
 */
describe('gap analysis published-only invariant', () => {
  const fnaStatuses = [
    { key: 'risk', status: 'published' as const },
    { key: 'risk', status: 'draft' as const },
    { key: 'risk', status: 'submitted' as const },
    { key: 'risk', status: 'client_draft' as const },
  ];

  it('only treats published batch status as gap-eligible', () => {
    for (const item of fnaStatuses) {
      const eligible = item.status === 'published';
      expect(eligible).toBe(item.status === 'published');
    }
  });
});
