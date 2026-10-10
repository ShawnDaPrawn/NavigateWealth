/**
 * Where each FNA type lives in the client drawer: the Policy Details subtab
 * whose FNA list shows it. Publishing an FNA lands the adviser there.
 */

import type { FNAConfig } from './types';

export type FNAType = FNAConfig['type'];

export const FNA_POLICY_CATEGORY: Record<FNAType, string> = {
  risk: 'risk-planning',
  medical: 'medical-aid',
  retirement: 'retirement',
  investment: 'investments',
  tax: 'tax-planning',
  estate: 'estate-planning',
};

/** Open the client drawer on a category's FNA list, with one FNA highlighted. */
export interface FNAListFocus {
  /** Policy Details subtab id, e.g. 'retirement'. */
  categorySubtabId: string;
  /** The FNA to highlight — the one just published. */
  fnaId?: string;
}
