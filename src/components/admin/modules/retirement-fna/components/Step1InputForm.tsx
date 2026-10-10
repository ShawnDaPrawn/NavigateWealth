/**
 * Step 1: Information Gathering
 *
 * Behaviour Rules:
 * - Auto-populate from client profile if data exists
 * - All inputs validated before proceeding to Step 2
 * - Financial data organized in clear sections
 * - Allows initial assumptions to be set directly in Step 1
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Label } from '../../../../ui/label';
import { Button } from '../../../../ui/button';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../ui/tabs';
import { User, Wallet, Info, Loader2, CalendarDays, TrendingUp } from 'lucide-react';
import { CurrencyInputField } from '../../../../ui/currency-input';
import { NumberInputField } from '../../../../ui/number-input';
import { RetirementFNAInputs, RetirementFNAAdjustments } from '../types';
import { DEFAULT_RETIREMENT_ASSUMPTIONS } from '../utils/calculation-engine';
import { useFormPrefill } from '../../form-prefill';
import { FNAStepNavigation } from '../../fna';

interface Step1InputFormProps {
  clientId?: string;
  initialData: Partial<RetirementFNAInputs>;
  initialAssumptions?: Partial<RetirementFNAAdjustments>;
  onNext: (data: RetirementFNAInputs, assumptions: RetirementFNAAdjustments) => void;
  /** Client intake mode — hides adviser-only assumptions and changes CTA copy */
  intakeMode?: boolean;
  hideAssumptionsTab?: boolean;
  submitLabel?: string;
  onSaveDraft?: (data: RetirementFNAInputs, assumptions: RetirementFNAAdjustments) => void;
}

// Backend response shape for auto-population (legacy field names)
interface AutoPopulateResponse {
  currentAge?: number;
  intendedRetirementAge?: number;
  netMonthlyIncome?: number;
  totalMonthlyContribution?: number;
  totalCurrentRetirementCapital?: number;
  [key: string]: unknown;
}

function mapPrefillToRetirementInputs(
  values: Record<string, unknown>,
): Partial<RetirementFNAInputs> {
  const autoData = values as AutoPopulateResponse;
  return {
    currentAge: Number(autoData.currentAge) || undefined,
    retirementAge: Number(autoData.retirementAge ?? autoData.intendedRetirementAge) || 65,
    // Net income only: gross is a different client key and must not stand in for it.
    currentMonthlyIncome: Number(autoData.currentMonthlyIncome ?? autoData.netMonthlyIncome) || 0,
    currentMonthlyContribution:
      Number(autoData.currentMonthlyContribution ?? autoData.totalMonthlyContribution) || 0,
    currentRetirementSavings:
      Number(autoData.currentRetirementSavings ?? autoData.totalCurrentRetirementCapital) || 0,
  };
}

/** A stored fraction (0.065) as the percentage the adviser types (6.5). */
function toPercent(fraction: number | undefined): number {
  return Math.round((fraction ?? 0) * 10000) / 100;
}

export function Step1InputForm({
  clientId,
  initialData,
  initialAssumptions,
  onNext,
  intakeMode = false,
  hideAssumptionsTab = false,
  submitLabel,
  onSaveDraft,
}: Step1InputFormProps) {
  const [data, setData] = useState<Partial<RetirementFNAInputs>>(initialData);

  // Initialize assumptions with passed values or system defaults
  const [assumptions, setAssumptions] = useState<RetirementFNAAdjustments>({
    inflationRate:
      initialAssumptions?.inflationRate ?? DEFAULT_RETIREMENT_ASSUMPTIONS.inflationRate,
    preRetirementReturn:
      initialAssumptions?.preRetirementReturn ?? DEFAULT_RETIREMENT_ASSUMPTIONS.preRetirementReturn,
    postRetirementReturn:
      initialAssumptions?.postRetirementReturn ??
      DEFAULT_RETIREMENT_ASSUMPTIONS.postRetirementReturn,
    salaryEscalation:
      initialAssumptions?.salaryEscalation ?? DEFAULT_RETIREMENT_ASSUMPTIONS.salaryEscalation,
    premiumEscalation:
      initialAssumptions?.premiumEscalation ?? DEFAULT_RETIREMENT_ASSUMPTIONS.premiumEscalation,
    yearsInRetirement:
      initialAssumptions?.yearsInRetirement ?? DEFAULT_RETIREMENT_ASSUMPTIONS.yearsInRetirement,
    replacementRatio:
      initialAssumptions?.replacementRatio ?? DEFAULT_RETIREMENT_ASSUMPTIONS.replacementRatio,
    ...initialAssumptions, // Spread any others
  });

  const [loading, _setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [prefillStarted, setPrefillStarted] = useState(false);

  const { PrefillUI, startPrefill } = useFormPrefill({
    clientId: intakeMode ? undefined : clientId,
    formId: 'retirement-fna-step1',
    currentValues: data as Record<string, unknown>,
    onApplyValues: (values) => {
      setData((prev) => ({ ...prev, ...mapPrefillToRetirementInputs(values) }));
    },
    autoOpenReview: !intakeMode,
  });

  useEffect(() => {
    if (clientId && !intakeMode && !prefillStarted && Object.keys(initialData).length === 0) {
      setPrefillStarted(true);
      void startPrefill();
    }
  }, [clientId, intakeMode, prefillStarted, initialData, startPrefill]);

  const handleChange = (field: keyof RetirementFNAInputs, value: string | number | boolean) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAssumptionChange = (
    field: keyof RetirementFNAAdjustments,
    value: string | number | boolean,
  ) => {
    setAssumptions((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    if (!data.currentAge || data.currentAge < 18) {
      setError('Please enter a valid current age (must be 18+)');
      return;
    }
    if (!data.retirementAge || data.retirementAge <= data.currentAge) {
      setError('Retirement age must be greater than current age');
      return;
    }

    onNext(data as RetirementFNAInputs, assumptions);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading client data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!intakeMode && PrefillUI}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Review client information below. Use &quot;Review matches&quot; to prefill from the client
          record where available.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">
              <CalendarDays className="h-4 w-4 mr-2" />
              Client Profile
            </TabsTrigger>
            <TabsTrigger value="financial">
              <Wallet className="h-4 w-4 mr-2" />
              Financial Position
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Retirement Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentAge" className="font-medium">
                      Current Age *
                    </Label>
                    <NumberInputField
                      id="currentAge"
                      value={data.currentAge}
                      onValueChange={(v) => handleChange('currentAge', v ?? 0)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Client's current age in years</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retirementAge" className="font-medium">
                      Intended Retirement Age *
                    </Label>
                    <NumberInputField
                      id="retirementAge"
                      value={data.retirementAge}
                      onValueChange={(v) => handleChange('retirementAge', v ?? 0)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Target age for retirement</p>
                  </div>
                </div>

                {data.currentAge && data.retirementAge && data.retirementAge > data.currentAge && (
                  <Alert className="bg-primary/10 border-primary/20">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm">
                      Years until retirement:{' '}
                      <strong>{data.retirementAge - data.currentAge} years</strong>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Current Financial Position
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="currentMonthlyIncome" className="font-medium">
                    Net Monthly Income
                  </Label>
                  <CurrencyInputField
                    id="currentMonthlyIncome"
                    value={data.currentMonthlyIncome}
                    onValueChange={(v) => handleChange('currentMonthlyIncome', v ?? 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Base income for replacement ratio calculation
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentRetirementSavings" className="font-medium">
                    Current Retirement Capital
                  </Label>
                  <CurrencyInputField
                    id="currentRetirementSavings"
                    value={data.currentRetirementSavings}
                    onValueChange={(v) => handleChange('currentRetirementSavings', v ?? 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total value of existing retirement funds and investments
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentMonthlyContribution" className="font-medium">
                    Current Monthly Contribution
                  </Label>
                  <CurrencyInputField
                    id="currentMonthlyContribution"
                    value={data.currentMonthlyContribution}
                    onValueChange={(v) => handleChange('currentMonthlyContribution', v ?? 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total monthly contributions to retirement savings
                  </p>
                </div>
              </CardContent>
            </Card>

            {!hideAssumptionsTab && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Assumptions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Inflation */}
                      <div className="space-y-2">
                        <Label htmlFor="inflationRate">Inflation Rate (CPI)</Label>
                        <div className="relative">
                          <NumberInputField
                            id="inflationRate"
                            decimals={2}
                            value={toPercent(assumptions.inflationRate)}
                            onValueChange={(v) =>
                              handleAssumptionChange('inflationRate', (v ?? 0) / 100)
                            }
                          />
                          <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>

                      {/* Salary Escalation */}
                      <div className="space-y-2">
                        <Label htmlFor="salaryEscalation">Salary Escalation</Label>
                        <div className="relative">
                          <NumberInputField
                            id="salaryEscalation"
                            decimals={2}
                            value={toPercent(assumptions.salaryEscalation)}
                            onValueChange={(v) =>
                              handleAssumptionChange('salaryEscalation', (v ?? 0) / 100)
                            }
                          />
                          <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>

                      {/* Pre-Retirement Return */}
                      <div className="space-y-2">
                        <Label htmlFor="preRetirementReturn">Pre-Retirement Return</Label>
                        <div className="relative">
                          <NumberInputField
                            id="preRetirementReturn"
                            decimals={2}
                            value={toPercent(assumptions.preRetirementReturn)}
                            onValueChange={(v) =>
                              handleAssumptionChange('preRetirementReturn', (v ?? 0) / 100)
                            }
                          />
                          <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>

                      {/* Post-Retirement Return */}
                      <div className="space-y-2">
                        <Label htmlFor="postRetirementReturn">Post-Retirement Return</Label>
                        <div className="relative">
                          <NumberInputField
                            id="postRetirementReturn"
                            decimals={2}
                            value={toPercent(assumptions.postRetirementReturn)}
                            onValueChange={(v) =>
                              handleAssumptionChange('postRetirementReturn', (v ?? 0) / 100)
                            }
                          />
                          <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>

                      {/* Years in Retirement */}
                      <div className="space-y-2">
                        <Label htmlFor="yearsInRetirement">Years in Retirement</Label>
                        <NumberInputField
                          id="yearsInRetirement"
                          value={assumptions.yearsInRetirement}
                          onValueChange={(v) => handleAssumptionChange('yearsInRetirement', v ?? 0)}
                        />
                      </div>

                      {/* Replacement Ratio */}
                      <div className="space-y-2">
                        <Label htmlFor="replacementRatio">Target Income Ratio</Label>
                        <div className="relative">
                          <NumberInputField
                            id="replacementRatio"
                            value={toPercent(assumptions.replacementRatio)}
                            onValueChange={(v) =>
                              handleAssumptionChange('replacementRatio', (v ?? 0) / 100)
                            }
                          />
                          <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    These assumptions will be used for the initial calculation. You can refine them
                    further in Step 3.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </TabsContent>
        </Tabs>

        <FNAStepNavigation
          step={1}
          nextType="submit"
          nextLabel={submitLabel ?? (intakeMode ? 'Continue to submit' : undefined)}
          secondaryActions={
            intakeMode && onSaveDraft ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onSaveDraft(data as RetirementFNAInputs, assumptions)}
              >
                Save progress
              </Button>
            ) : undefined
          }
        />
      </form>
    </div>
  );
}
