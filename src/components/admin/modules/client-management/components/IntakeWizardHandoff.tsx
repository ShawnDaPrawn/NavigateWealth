/**
 * Opens the correct admin FNA wizard at Step 2 after accepting a client intake.
 *
 * The wizard comes from the FNA registry, like every other place that opens
 * one, so the hand-off treats all six domains identically.
 *
 * Accepting an intake made a draft FNA from the client's answers
 * (`linkedFnaId`). Publishing from the wizard creates the published FNA, so the
 * draft has served its purpose: it is removed before the adviser lands on the
 * FNA list, which would otherwise show the leftover draft beside the published
 * FNA.
 */

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { FNA_POLICY_CATEGORY } from '../../fna';
import { getFNAConfig } from '../../../profile-sections/fna-config';
import { removeIntakeDraft, type IntakeHandoffState } from './intakeHandoff';

export type { IntakeHandoffState };

interface IntakeWizardHandoffProps {
  handoff: IntakeHandoffState | null;
  onClose: () => void;
  /** Called with the published FNA's id, so the caller can land on it. */
  onFNAComplete?: (fnaId: string, handoff: IntakeHandoffState) => void;
}

function WizardFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-gray-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Opening adviser wizard…
    </div>
  );
}

export function IntakeWizardHandoff({ handoff, onClose, onFNAComplete }: IntakeWizardHandoffProps) {
  if (!handoff) return null;

  const config = getFNAConfig(FNA_POLICY_CATEGORY[handoff.domain]);
  if (!config) return null;
  const { Wizard } = config;

  const handlePublished = async (fnaId: string) => {
    await removeIntakeDraft(config, handoff, fnaId);
    onFNAComplete?.(fnaId, handoff);
  };

  return (
    <Suspense fallback={<WizardFallback />}>
      <Wizard
        open
        onClose={onClose}
        clientId={handoff.clientId}
        clientName={handoff.clientName}
        startAtStep={handoff.initialStep}
        intakePrefill={handoff.inputs}
        onFNAComplete={(fnaId) => void handlePublished(fnaId)}
      />
    </Suspense>
  );
}
