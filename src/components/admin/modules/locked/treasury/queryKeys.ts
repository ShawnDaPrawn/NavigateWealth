/**
 * Treasury — React Query key factory.
 *
 * Deliberately local to the locked module (NOT in utils/queryKeys.ts): the
 * Locked module is a standalone unit that must stay deletable without touching
 * shared registries. See ../../README.md.
 */

export const treasuryKeys = {
  all: ['treasury'] as const,
  account: () => [...treasuryKeys.all, 'account'] as const,
  balance: () => [...treasuryKeys.all, 'balance'] as const,
  platformBalance: () => [...treasuryKeys.all, 'platform-balance'] as const,
  transactions: () => [...treasuryKeys.all, 'transactions'] as const,
} as const;
