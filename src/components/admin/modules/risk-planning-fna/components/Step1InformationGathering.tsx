/**
 * Step 1: Information Gathering
 *
 * Behaviour Rules:
 * - Auto-populate from client profile if data exists
 * - Changes may be edited and persisted back to client profile
 * - Derived values must be displayed but not directly editable
 * - All inputs validated before proceeding to Step 2
 */

import React, { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ArrowLeft, Info, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../ui/tabs';
import { Form } from '../../../../ui/form';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { clientApi } from '../../client-management/api';
import { useClientProfile, useClientKeys } from '../hooks';
import { DEFAULT_FORM_VALUES, QUERY_KEYS } from '../constants';
import {
  InformationGatheringSchema,
  transformFormToInput,
  type InformationGatheringFormValues,
} from '../schema';
import type { InformationGatheringInput } from '../types';

import { IncomeDetailsForm } from './step1/IncomeDetailsForm';
import { DependantsForm } from './step1/DependantsForm';
import { ExistingCoverForm } from './step1/ExistingCoverForm';
import { useFormPrefill } from '../../form-prefill/useFormPrefill';

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
  const { data: _profileData, isLoading: isLoadingProfile } = useClientProfile(clientId);
  const { data: clientKeys, isError: isClientKeysError } = useClientKeys(clientId);
  const queryClient = useQueryClient();
  const [isRecalculating, setIsRecalculating] = React.useState(false);

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

  const { PrefillUI, startPrefill } = useFormPrefill({
    clientId: hasPersistedRiskIntake(initialData) ? undefined : clientId,
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

  // Auto-populate from saved intake / handoff data only
  useEffect(() => {
    if (hasPersistedRiskIntake(initialData)) {
      populateFromInitialData(initialData!);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  const populateFromInitialData = (data: Partial<InformationGatheringInput>) => {
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
  };

  const onSubmit = (formValues: InformationGatheringFormValues) => {
    const inputData = transformFormToInput(formValues);
    onNext(inputData);
  };

  const handleRecalculateTotals = async () => {
    if (!clientId) return;

    setIsRecalculating(true);
    try {
      // 1. Trigger recalculation on backend
      await clientApi.recalculateClientKeys(clientId);

      // 2. Invalidate query to refresh cache
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CLIENT_KEYS(clientId) });

      // 3. Explicitly fetch new keys to update form immediately
      const newKeys = await clientApi.getClientKeys(clientId);

      if (newKeys && newKeys.keys && newKeys.keys.length > 0) {
        // Map of client key IDs to form field names
        const keyToFieldMap: Record<string, keyof InformationGatheringFormValues> = {
          risk_life_cover_total: 'existingCoverLifePersonal',
          risk_disability_total: 'existingCoverDisabilityPersonal',
          risk_severe_illness_total: 'existingCoverSevereIllnessPersonal',
          risk_temporary_icb_total: 'existingCoverIPTemporaryPersonal',
          risk_permanent_icb_total: 'existingCoverIPPermanentPersonal',
        };

        let updatedCount = 0;

        // Populate each field from its corresponding client key
        Object.entries(keyToFieldMap).forEach(([keyId, fieldName]) => {
          const keyData = newKeys.keys.find((k) => k.keyId === keyId);

          if (keyData && Number(keyData.value) > 0) {
            form.setValue(fieldName, String(keyData.value));
            updatedCount++;
          }
        });

        if (updatedCount > 0) {
          toast.success('Existing cover updated from policies');
        } else {
          toast.info('Recalculation complete, but no matching non-zero totals found');
        }
      } else {
        toast.info('Recalculation complete. No totals found.');
      }
    } catch (error) {
      console.error('Recalculation failed:', error);
      toast.error('Failed to recalculate existing cover');
    } finally {
      setIsRecalculating(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading client profile data...</div>
        </CardContent>
      </Card>
    );
  }

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
              clientId={clientId}
              isRecalculating={isRecalculating}
              onRecalculate={handleRecalculateTotals}
              hasClientKeys={!!clientKeys?.keys?.length}
              isClientKeysError={isClientKeysError}
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

        {/* Submit */}
        <div className="flex justify-between pt-6 border-t">
          <Button type="button" variant="outline" disabled>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2">
            {intakeMode && onSaveDraft && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onSaveDraft(transformFormToInput(form.getValues()))}
              >
                Save draft
              </Button>
            )}
            <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90">
              {submitLabel ?? (intakeMode ? 'Continue to submit' : 'Continue to Calculations')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
