/**
 * The accepted-intake hand-off: what the intake queue passes to the wizard,
 * and the clean-up once the wizard has published.
 */

import type { FnaIntakeDomain } from '../../../../../services/fna-intake-api';
import type { FNAConfig } from '../../fna';
import { logger } from '../../../../../utils/logger';

export interface IntakeHandoffState {
  clientId: string;
  clientName?: string;
  domain: FnaIntakeDomain;
  /** The draft FNA the accept made from the client's answers. */
  linkedFnaId: string;
  initialStep: number;
  inputs: Record<string, unknown>;
}

/**
 * Removes the intake's draft once the published FNA exists. A failure leaves a
 * stray draft in the list, not a broken publish, so it is logged, not raised.
 */
export async function removeIntakeDraft(
  config: FNAConfig,
  handoff: IntakeHandoffState,
  publishedFnaId: string,
): Promise<void> {
  const draftId = handoff.linkedFnaId;
  if (!draftId || draftId === publishedFnaId) return;
  try {
    await config.deleteFNA(draftId, handoff.clientId);
  } catch (error) {
    logger.warn('Could not remove the intake draft after publishing', {
      domain: handoff.domain,
      draftId,
      error,
    });
  }
}
