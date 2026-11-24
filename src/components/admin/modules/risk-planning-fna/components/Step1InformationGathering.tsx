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
import { useForm, useFormContext, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Tabs, TabsContent } from '../../../../ui/tabs';
import { SegmentedList, SegmentedTrigger } from '../../../layout/page';
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
import { AssumptionsForm } from './step1/AssumptionsForm';
import { useFormPrefill } from '../../form-prefill';
import { FNAStepNavigation } from '../../fna';
import { formatCurrency } from '../utils';

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

/** The three sections of Step 1 and the fields each holds (for error markers). */
const STEP1_TABS: ReadonlyArray<{
  value: string;
  label: string;
  fields: ReadonlyArray<keyof InformationGatheringFormValues>;
}> = [
  {
    value: 'income',
    label: 'Income & personal',
    fields: [
      'grossMonthlyIncome',
      'netMonthlyIncome',
      'incomeEscalationAssumption',
      'currentAge',
      'retirementAge',
      'employmentType',
      'totalOutstandingDebts',
      'totalCurrentAssets',
      'estateWorth',
      'totalHouseholdMonthlyExpenditure',
      'liquidAssetsAvailable',
    ],
  },
  {
    value: 'dependants',
    label: 'Dependants & family',
    fields: ['dependants', 'spouseFullName', 'spouseAverageMonthlyIncome'],
  },
  {
    value: 'existing',
    label: 'Existing cover',
    fields: [
      'existingCoverLifePersonal',
      'existingCoverLifeGroup',
      'existingCoverDisabilityPersonal',
      'existingCoverDisabilityGroup',
      'existingCoverSevereIllnessPersonal',
      'existingCoverSevereIllnessGroup',
      'existingCoverIPTemporaryPersonal',
      'existingCoverIPTemporaryGroup',
      'existingCoverIPPermanentPersonal',
      'existingCoverIPPermanentGroup',
      'ipTemporaryBenefitPeriod',
      'ipPermanentEscalation',
    ],
  },
  {
    value: 'assumptions',
    label: 'Assumptions',
    fields: [
      'investmentReturnAssumption',
      'incomeReplacementRatio',
      'disabilityIncomeReplacementRatio',
      'educationInflationAssumption',
    ],
  },
];

/** Adviser-only planning assumptions are not shown on the client's own intake. */
const ADVISER_ONLY_TABS = new Set(['assumptions']);

/**
 * The figures the calculation will start from, kept in view while the adviser
 * moves between sections. A row of tiles above the form on smaller screens; a
 * sticky panel beside it on wide ones. Read-only: every value is edited in the form.
 */
function RiskStep1Summary() {
  const form = useFormContext<InformationGatheringFormValues>();
  const v = form.watch();
  const num = (x: unknown) => Number(x || 0);

  const gross = num(v.grossMonthlyIncome);
  const rows: Array<{ label: string; value: string; unit?: string }> = [
    { label: 'Gross income', value: formatCurrency(gross * 12), unit: '/ yr' },
    { label: 'Net income', value: formatCurrency(num(v.netMonthlyIncome) * 12), unit: '/ yr' },
    { label: 'Net worth', value: formatCurrency(num(v.estateWorth)) },
    {
      label: 'Household income',
      value: formatCurrency(gross + num(v.spouseAverageMonthlyIncome)),
      unit: '/ mo',
    },
    { label: 'Dependants', value: String(v.dependants?.length ?? 0) },
    {
      label: 'Life cover',
      value: formatCurrency(num(v.existingCoverLifePersonal) + num(v.existingCoverLifeGroup)),
    },
  ];

  return (
    <aside
      aria-label="Summary"
      className="order-first overflow-hidden rounded-lg border border-nw-line bg-white xl:sticky xl:top-4 xl:order-none xl:w-72 xl:flex-none"
    >
      <h3 className="hidden border-b border-nw-line-soft px-5 py-3.5 text-[15px] leading-[22px] font-semibold text-nw-ink xl:block">
        Summary
      </h3>
      <dl className="grid grid-cols-2 gap-px bg-nw-line-soft sm:grid-cols-3 xl:grid-cols-1 xl:gap-0 xl:divide-y xl:divide-nw-line-soft xl:bg-white xl:px-5 xl:py-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-0.5 bg-white px-4 py-3 xl:flex-row xl:items-baseline xl:justify-between xl:gap-3 xl:px-0 xl:py-2.5"
          >
            <dt className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-nw-muted uppercase">
              {row.label}
            </dt>
            <dd className="text-[15px] whitespace-nowrap text-nw-ink tabular-nums">
              {row.value}
              {row.unit && <span className="ml-1 text-xs text-nw-muted">{row.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
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
      form.setValue('liquidAssetsAvailable', formatOptionalNumber(data.liquidAssetsAvailable));
      form.setValue(
        'investmentReturnAssumption',
        formatOptionalNumber(
          data.investmentReturnAssumption,
          DEFAULT_FORM_VALUES.investmentReturnAssumption,
        ),
      );
      form.setValue(
        'incomeReplacementRatio',
        formatOptionalNumber(
          data.incomeReplacementRatio,
          DEFAULT_FORM_VALUES.incomeReplacementRatio,
        ),
      );
      form.setValue(
        'disabilityIncomeReplacementRatio',
        formatOptionalNumber(
          data.disabilityIncomeReplacementRatio,
          DEFAULT_FORM_VALUES.disabilityIncomeReplacementRatio,
        ),
      );
      form.setValue(
        'educationInflationAssumption',
        formatOptionalNumber(
          data.educationInflationAssumption,
          DEFAULT_FORM_VALUES.educationInflationAssumption,
        ),
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
        {intakeMode && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Review suggested values from your profile. You can edit any field before continuing.
            </AlertDescription>
          </Alert>
        )}

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

        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 flex-1">
            <SegmentedList aria-label="Information sections">
              {STEP1_TABS.filter((tab) => !intakeMode || !ADVISER_ONLY_TABS.has(tab.value)).map(
                (tab) => {
                  const hasError =
                    form.formState.isSubmitted &&
                    tab.fields.some((name) => name in form.formState.errors);
                  return (
                    <SegmentedTrigger key={tab.value} value={tab.value} className="gap-1.5">
                      {tab.label}
                      {hasError && (
                        <>
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-[var(--nw-danger)]"
                            aria-hidden="true"
                          />
                          <span className="sr-only">(has errors)</span>
                        </>
                      )}
                    </SegmentedTrigger>
                  );
                },
              )}
            </SegmentedList>

            <TabsContent value="income" className="mt-5">
              <IncomeDetailsForm />
            </TabsContent>

            <TabsContent value="dependants" className="mt-5">
              <DependantsForm />
            </TabsContent>

            <TabsContent value="existing" className="mt-5">
              <ExistingCoverForm
                clientId={intakeMode ? undefined : clientId}
                isRecalculating={refreshing}
                onRecalculate={() => void refreshFromPolicies()}
              />
            </TabsContent>

            {!intakeMode && (
              <TabsContent value="assumptions" className="mt-5">
                <AssumptionsForm />
              </TabsContent>
            )}
          </Tabs>

          <RiskStep1Summary />
        </div>

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
