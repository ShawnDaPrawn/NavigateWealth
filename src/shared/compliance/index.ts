/**
 * Compliance domain — shared barrel.
 *
 * Today this holds the client compliance record kept on the profile. It is the
 * seam the self-built compliance engine will plug into: see
 * `clientCompliance.ts` for what moves and how.
 */
export * from './clientCompliance';
