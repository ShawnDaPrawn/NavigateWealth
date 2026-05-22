/**
 * Opens the correct admin FNA wizard at Step 2 after accepting a client intake.
 */

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { FnaIntakeDomain } from '../../../../../services/fna-intake-api';

const LazyRiskWizard = React.lazy(() =>
  import('../../risk-planning-fna/components/RiskPlanningFNAWizard').then((m) => ({
    default: m.RiskPlanningFNAWizard,
  })),
);
const LazyMedicalWizard = React.lazy(() =>
  import('../../medical-fna/components/MedicalFNAWizard').then((m) => ({
    default: m.MedicalFNAWizard,
  })),
);
const LazyRetirementWizard = React.lazy(() =>
  import('../../retirement-fna/components/RetirementFNAWizard').then((m) => ({
    default: m.RetirementFNAWizard,
  })),
);
const LazyTaxWizard = React.lazy(() =>
  import('../../tax-planning-fna/components/TaxPlanningFNAWizard').then((m) => ({
    default: m.TaxPlanningFNAWizard,
  })),
);
const LazyInvestmentWizard = React.lazy(() =>
  import('../../investment-ina/components/InvestmentINAWizard').then((m) => ({
    default: m.InvestmentINAWizard,
  })),
);
const LazyEstateWizard = React.lazy(() =>
  import('../../estate-planning-fna/components/EstatePlanningFNAWizard').then((m) => ({
    default: m.EstatePlanningFNAWizard,
  })),
);

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
