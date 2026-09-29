/**
 * Step 1: Information Gathering
 *
 * Behaviour Rules:
 * - Client keys arrive only through the shared review prefill (useFormPrefill),
 *   the same path every FNA uses, including Load from Policies
 * - Changes may be edited and persisted back to client profile
 * - Derived values must be displayed but not directly editable
 * - All inputs validated before proceeding to Step 2
 */

import React, { useEffect, useCallback } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, AlertCircle } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../ui/tabs';
import { Form } from '../../../../ui/form';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { DEFAULT_FORM_VALUES } from '../constants';
import {
  InformationGatheringSchema,
  transformFormToInput,
  type InformationGatheringFormValues,
} from '../schema';
import type { InformationGatheringInput } from '../types';

import { IncomeDetailsForm } from './step1/IncomeDetailsForm';
import { DependantsForm } from './step1/DependantsForm';
import { ExistingCoverForm } from './step1/ExistingCoverForm';
import { useFormPrefill } from '../../form-prefill';
import { FNAStepNavigation } from '../../fna';

interface Step1Props {
  clientId?: string;
  initialData?: Partial<InformationGatheringInput>;
  onNext: (data: InformationGatheringInput) => void;
  intakeMode?: boolean;
  submitLabel?: string;
  onSaveDraft?: (data: InformationGatheringInput) => void;
}

function formatOptionalNumber(value: number | undefined | null, fallback = '0'): string {
  return value === undefined || value === null ? fallback : String(value);
}

function hasPersistedRiskIntake(data?: Partial<InformationGatheringInput>): boolean {
  return !!data && Object.keys(data).length > 0;
}

export function Step1InformationGathering({
  clientId,
  initialData,
  onNext,
  intakeMode = false,
  submitLabel,
  onSaveDraft,
}: Step1Props) {
  // Tab state management
  const [activeTab, setActiveTab] = React.useState<string>('income');

  // Scroll to top when changing tabs
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const form = useForm<InformationGatheringFormValues>({
    // zodResolver infers the schema INPUT type (defaulted fields optional);
    // the form operates on the OUTPUT shape, so assert to that.
    resolver: zodResolver(
      InformationGatheringSchema,
    ) as unknown as Resolver<InformationGatheringFormValues>,
    defaultValues: DEFAULT_FORM_VALUES as unknown as InformationGatheringFormValues,
    mode: 'onChange',
  });

  const [prefillStarted, setPrefillStarted] = React.useState(false);

  // Client keys reach this form only through the shared review prefill. The
  // review stays available throughout; only the automatic start is gated.
  const { PrefillUI, startPrefill, refreshFromPolicies, refreshing } = useFormPrefill({
    clientId,
    formId: 'risk-fna-step1',
    currentValues: form.getValues() as Record<string, unknown>,
    autoOpenReview: !intakeMode,
    onApplyValues: (values) => {
      Object.entries(values).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (key in DEFAULT_FORM_VALUES) {
          form.setValue(key as keyof InformationGatheringFormValues, String(value) as never);
        }
      });
    },
  });

  React.useEffect(() => {
    if (clientId && !hasPersistedRiskIntake(initialData) && !prefillStarted) {
      setPrefillStarted(true);
      void startPrefill();
    }
  }, [clientId, initialData, prefillStarted, startPrefill]);

  const populateFromInitialData = useCallback(
    (data: Partial<InformationGatheringInput>) => {
      form.setValue('grossMonthlyIncome', formatOptionalNumber(data.grossMonthlyIncome, ''));
      form.setValue('netMonthlyIncome', formatOptionalNumber(data.netMonthlyIncome, ''));
      form.setValue(
        'incomeEscalationAssumption',
        formatOptionalNumber(data.incomeEscalationAssumption, '6'),
      );
      form.setValue('currentAge', formatOptionalNumber(data.currentAge, ''));
      form.setValue('retirementAge', formatOptionalNumber(data.retirementAge, '65'));
      form.setValue('employmentType', data.employmentType ?? DEFAULT_FORM_VALUES.employmentType);
      form.setValue('totalOutstandingDebts', formatOptionalNumber(data.totalOutstandingDebts));
      form.setValue('totalCurrentAssets', formatOptionalNumber(data.totalCurrentAssets));
      form.setValue(
        'totalHouseholdMonthlyExpenditure',
        formatOptionalNumber(data.totalHouseholdMonthlyExpenditure),
      );
      form.setValue('spouseFullName', data.spouseFullName || '');
      form.setValue(
        'spouseAverageMonthlyIncome',
        formatOptionalNumber(data.spouseAverageMonthlyIncome, ''),
      );
      form.setValue(
        'dependants',
        (data.dependants ?? []).map((dep) => ({
          id: dep.id,
          relationship: dep.relationship,
          dependencyTerm: formatOptionalNumber(dep.dependencyTerm),
          monthlyEducationCost: formatOptionalNumber(dep.monthlyEducationCost),
        })),
      );

      const existing = data.existingCover;
      form.setValue('existingCoverLifePersonal', formatOptionalNumber(existing?.life?.personal));
      form.setValue('existingCoverLifeGroup', formatOptionalNumber(existing?.life?.group));
      form.setValue(
        'existingCoverDisabilityPersonal',
        formatOptionalNumber(existing?.disability?.personal),
      );
      form.setValue(
        'existingCoverDisabilityGroup',
        formatOptionalNumber(existing?.disability?.group),
      );
      form.setValue(
        'existingCoverSevereIllnessPersonal',
        formatOptionalNumber(existing?.severeIllness?.personal),
      );
      form.setValue(
        'existingCoverSevereIllnessGroup',
        formatOptionalNumber(existing?.severeIllness?.group),
      );
      form.setValue(
        'existingCoverIPTemporaryPersonal',
        formatOptionalNumber(existing?.incomeProtection?.temporary?.personal),
      );
      form.setValue(
        'existingCoverIPTemporaryGroup',
        formatOptionalNumber(existing?.incomeProtection?.temporary?.group),
      );
      form.setValue(
        'existingCoverIPPermanentPersonal',
        formatOptionalNumber(existing?.incomeProtection?.permanent?.personal),
      );
      form.setValue(
        'existingCoverIPPermanentGroup',
        formatOptionalNumber(existing?.incomeProtection?.permanent?.group),
      );

      const ipSettings = data.incomeProtectionSettings;
      if (ipSettings?.temporary?.benefitPeriod) {
        form.setValue('ipTemporaryBenefitPeriod', ipSettings.temporary.benefitPeriod);
      }
      if (ipSettings?.permanent?.escalation) {
        form.setValue('ipPermanentEscalation', ipSettings.permanent.escalation);
      }
    },
    [form],
  );

  // Auto-populate from saved intake / handoff data only
  useEffect(() => {
    if (hasPersistedRiskIntake(initialData)) {
      populateFromInitialData(initialData!);
    }
  }, [initialData, populateFromInitialData]);

  const onSubmit = (formValues: InformationGatheringFormValues) => {
    const inputData = transformFormToInput(formValues);
    onNext(inputData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {!intakeMode && PrefillUI}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {intakeMode
              ? 'Review suggested values from your profile. You can edit any field before continuing.'
              : 'Use "Review matches" to prefill from the client record. You can edit any field before continuing.'}
          </AlertDescription>
        </Alert>

        {/* Validation Summary - show errors if form is submitted */}
        {Object.keys(form.formState.errors).length > 0 && form.formState.isSubmitted && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="font-semibold mb-1">Please fix the following errors:</div>
              <ul className="list-disc list-inside space-y-1 text-xs">
                {Object.entries(form.formState.errors).map(([key, error]) => (
                  <li key={key}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}: {error.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto p-1">
            <TabsTrigger value="income" className="text-sm px-6 py-2.5">
              Income & Personal
            </TabsTrigger>
            <TabsTrigger value="dependants" className="text-sm px-6 py-2.5">
              Dependants & Family
            </TabsTrigger>
            <TabsTrigger value="existing" className="text-sm px-6 py-2.5">
              Existing Cover
            </TabsTrigger>
          </TabsList>

          <TabsContent value="income" className="mt-6">
            <IncomeDetailsForm />
          </TabsContent>

          <TabsContent value="dependants" className="mt-6">
            <DependantsForm />
          </TabsContent>

          <TabsContent value="existing" className="mt-6">
            <ExistingCoverForm
              clientId={intakeMode ? undefined : clientId}
              isRecalculating={refreshing}
              onRecalculate={() => void refreshFromPolicies()}
            />
          </TabsContent>
        </Tabs>

        {!intakeMode && (
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900">
              <strong>Next Step:</strong> The system will automatically calculate risk needs based
              on the information you&apos;ve entered. You&apos;ll be able to review all calculations
              in detail before making any manual adjustments.
            </AlertDescription>
          </Alert>
        )}

        <FNAStepNavigation
          step={1}
          nextType="submit"
          nextLabel={submitLabel ?? (intakeMode ? 'Continue to submit' : undefined)}
          secondaryActions={
            intakeMode && onSaveDraft ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onSaveDraft(transformFormToInput(form.getValues()))}
              >
                Save progress
              </Button>
            ) : undefined
          }
        />
      </form>
    </Form>
  );
}
