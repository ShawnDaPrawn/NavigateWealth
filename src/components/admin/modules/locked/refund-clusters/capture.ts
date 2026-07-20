/**
 * Refund Clusters — AI invoice capture (re-export)
 *
 * Normalization + supplier matching live in the locked-owned shared module,
 * also consumed by the edge capture route.
 */

export {
  matchSupplier,
  normalizeCaptureExtraction,
} from '../../../../../shared/locked-vat/capture-extraction';
export type {
  CaptureExtraction,
  MatchableSupplier,
} from '../../../../../shared/locked-vat/capture-extraction';
