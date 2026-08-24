/**
 * Opens the correct admin FNA wizard at Step 2 after accepting a client intake.
 */

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { FnaIntakeDomain } from '../../../../../services/fna-intake-api';
import { RiskPlanningFNAWizard as LazyRiskWizard } from '../../risk-planning-fna';
import { MedicalFNAWizard as LazyMedicalWizard } from '../../medical-fna';
import { RetirementFNAWizard as LazyRetirementWizard } from '../../retirement-fna';
import { TaxPlanningFNAWizard as LazyTaxWizard } from '../../tax-planning-fna';
import { InvestmentINAWizard as LazyInvestmentWizard } from '../../investment-ina';
import { EstatePlanningFNAWizard as LazyEstateWizard } from '../../estate-planning-fna';

export interface IntakeHandoffState {
  clientId: string;
  clientName?: string;
  domain: FnaIntakeDomain;
  linkedFnaId: string;
  initialStep: number;
  inputs: Record<string, unknown>;
}

interface IntakeWizardHandoffProps {
  handoff: IntakeHandoffState | null;
  onClose: () => void;
}

function WizardFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-gray-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Opening adviser wizard…
    </div>
  );
}

export function IntakeWizardHandoff({ handoff, onClose }: IntakeWizardHandoffProps) {
  if (!handoff) return null;

  const { clientId, clientName, domain, inputs, initialStep } = handoff;
  const open = true;

  return (
    <Suspense fallback={<WizardFallback />}>
      {domain === 'risk' && (
        <LazyRiskWizard
          clientId={clientId}
          clientName={clientName}
          open={open}
          onClose={onClose}
          startAtStep={initialStep}
          intakePrefill={inputs}
        />
      )}
      {domain === 'medical' && (
        <LazyMedicalWizard
          clientId={clientId}
          clientName={clientName}
          open={open}
          onClose={onClose}
          startAtStep={initialStep}
          intakePrefill={inputs}
        />
      )}
      {domain === 'retirement' && (
        <LazyRetirementWizard
          clientId={clientId}
          clientName={clientName}
          open={open}
          onClose={onClose}
          startAtStep={initialStep}
          intakePrefill={inputs}
        />
      )}
      {domain === 'tax' && (
        <LazyTaxWizard
          clientId={clientId}
          clientName={clientName}
          open={open}
          onClose={onClose}
          startAtStep={initialStep}
          intakePrefill={inputs}
        />
      )}
      {domain === 'investment' && (
        <LazyInvestmentWizard
          clientId={clientId}
          open={open}
          onClose={onClose}
          startAtStep={initialStep}
          intakePrefill={inputs}
        />
      )}
      {domain === 'estate' && (
        <LazyEstateWizard
          clientId={clientId}
          open={open}
          onClose={onClose}
          onFNAComplete={() => onClose()}
          intakePrefill={inputs}
        />
      )}
    </Suspense>
  );
}
