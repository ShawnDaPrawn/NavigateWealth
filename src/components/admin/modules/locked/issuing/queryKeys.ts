/**
 * Issuing — React Query key factory.
 *
 * Local to the locked module (NOT in utils/queryKeys.ts) so the feature stays
 * independently deletable. See ../../README.md.
 */

export const issuingKeys = {
  all: ['issuing'] as const,
  cardholders: () => [...issuingKeys.all, 'cardholders'] as const,
  cards: () => [...issuingKeys.all, 'cards'] as const,
} as const;
