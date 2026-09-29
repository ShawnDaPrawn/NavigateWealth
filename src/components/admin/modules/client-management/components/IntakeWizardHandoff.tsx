/**
 * Opens the correct admin FNA wizard at Step 2 after accepting a client intake.
 *
 * Every wizard takes the same props (FNAWizardProps), so the hand-off treats
 * all six domains identically.
 */

import { Suspense, type ComponentType } from 'react';
import { Loader2 } from 'lucide-react';
import type { FnaIntakeDomain } from '../../../../../services/fna-intake-api';
import type { FNAWizardProps } from '../../fna';
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

const WIZARDS: Record<FnaIntakeDomain, ComponentType<FNAWizardProps>> = {
  risk: LazyRiskWizard,
  medical: LazyMedicalWizard,
  retirement: LazyRetirementWizard,
  tax: LazyTaxWizard,
  investment: LazyInvestmentWizard,
  estate: LazyEstateWizard,
};

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
  const Wizard = WIZARDS[domain];

  return (
    <Suspense fallback={<WizardFallback />}>
      <Wizard
        open
        onClose={onClose}
        clientId={clientId}
        clientName={clientName}
        startAtStep={initialStep}
        intakePrefill={inputs}
      />
    </Suspense>
  );
}
