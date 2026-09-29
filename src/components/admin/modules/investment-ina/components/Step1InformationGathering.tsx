/**
 * Investment INA — Step 1: Information Gathering
 *
 * Client values come from the client keys through the shared review prefill
 * (form id `investment-ina-step1`), the same path every FNA uses. The list of
 * discretionary investments comes from the client's policy records, loaded by
 * the wizard. Nothing is applied without the adviser seeing it.
 */

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { FNAStepNavigation } from '../../fna';
import { useFormPrefill } from '../../form-prefill';
import type { InvestmentINAInputs } from '../types';
import {
  ClientOverviewSection,
  DiscretionaryInvestmentsSection,
  GoalsSection,
  RiskProfileSection,
} from './step1/INAInformationSections';
import { findINAStep1Problem, INA_STEP1_TABS, type INAStep1Tab } from './step1/inaStep1Validation';

interface Step1Props {
  clientId: string;
  inputs: Partial<InvestmentINAInputs>;
  onChange: (updates: Partial<InvestmentINAInputs>) => void;
  onNext: () => void;
  /** False once the adviser has already reviewed the client record in this wizard. */
  autoStartPrefill: boolean;
  isCalculating?: boolean;
}

export function Step1InformationGathering({
  clientId,
  inputs,
  onChange,
  onNext,
  autoStartPrefill,
  isCalculating = false,
}: Step1Props) {
  const [activeTab, setActiveTab] = useState<INAStep1Tab>('overview');
  const [prefillStarted, setPrefillStarted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // The review stays available throughout; only the automatic start is gated.
  const { PrefillUI, startPrefill } = useFormPrefill({
    clientId,
    formId: 'investment-ina-step1',
    currentValues: inputs as Record<string, unknown>,
    onApplyValues: (values) => onChange(values as Partial<InvestmentINAInputs>),
  });

  useEffect(() => {
    if (autoStartPrefill && clientId && !prefillStarted) {
      setPrefillStarted(true);
      void startPrefill();
    }
  }, [autoStartPrefill, clientId, prefillStarted, startPrefill]);

  const handleNext = () => {
    const found = findINAStep1Problem(inputs);
    if (found) {
      setActiveTab(found.tab);
      setProblem(found.message);
      toast.error(found.message);
      return;
    }
    setProblem(null);
    onNext();
  };

  return (
    <div className="space-y-6">
      {PrefillUI}

      {problem && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{problem}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(tab) => setActiveTab(tab as INAStep1Tab)}
        className="w-full"
      >
        <TabsList className="w-full h-auto p-1">
          {INA_STEP1_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-sm px-6 py-2.5">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ClientOverviewSection inputs={inputs} updateInputs={onChange} />
        </TabsContent>
        <TabsContent value="investments" className="mt-6">
          <DiscretionaryInvestmentsSection inputs={inputs} />
        </TabsContent>
        <TabsContent value="risk-profile" className="mt-6">
          <RiskProfileSection inputs={inputs} updateInputs={onChange} />
        </TabsContent>
        <TabsContent value="goals" className="mt-6">
          <GoalsSection inputs={inputs} updateInputs={onChange} />
        </TabsContent>
      </Tabs>

      <FNAStepNavigation step={1} onNext={handleNext} isBusy={isCalculating} />
    </div>
  );
}
