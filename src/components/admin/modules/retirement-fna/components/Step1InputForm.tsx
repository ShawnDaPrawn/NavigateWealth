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
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Button } from '../../../../ui/button';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../ui/tabs';
import { User, Wallet, Info, ArrowRight, Loader2, CalendarDays, TrendingUp } from 'lucide-react';
import { formatCurrencyInput, cleanCurrencyInput } from '../../../../../utils/currencyFormatter';
import { RetirementFNAInputs, RetirementFNAAdjustments } from '../types';
import { DEFAULT_RETIREMENT_ASSUMPTIONS } from '../utils/calculation-engine';
import { useFormPrefill } from '../../form-prefill/useFormPrefill';

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
  grossMonthlyIncome?: number;
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
    currentMonthlyIncome:
      Number(
        autoData.currentMonthlyIncome ?? autoData.netMonthlyIncome ?? autoData.grossMonthlyIncome,
      ) || 0,
    currentMonthlyContribution:
      Number(autoData.currentMonthlyContribution ?? autoData.totalMonthlyContribution) || 0,
    currentRetirementSavings:
      Number(autoData.currentRetirementSavings ?? autoData.totalCurrentRetirementCapital) || 0,
  };
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

  const handleCurrencyChange = (field: keyof RetirementFNAInputs, value: string) => {
    // Parse the string value back to a number for state
    const cleanValue = cleanCurrencyInput(value);
    const numericValue = cleanValue ? parseFloat(cleanValue) : 0;
    handleChange(field, numericValue);
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
                    <Input
                      id="currentAge"
                      type="number"
                      value={data.currentAge || ''}
                      onChange={(e) => handleChange('currentAge', parseInt(e.target.value))}
                      required
                      min="18"
                      max="100"
                    />
                    <p className="text-xs text-muted-foreground">Client's current age in years</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retirementAge" className="font-medium">
                      Intended Retirement Age *
                    </Label>
                    <Input
                      id="retirementAge"
                      type="number"
                      value={data.retirementAge || ''}
                      onChange={(e) => handleChange('retirementAge', parseInt(e.target.value))}
                      required
                      min={data.currentAge ? data.currentAge + 1 : 18}
                      max="100"
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
                  <Input
                    id="currentMonthlyIncome"
                    value={formatCurrencyInput(data.currentMonthlyIncome || 0)}
                    onChange={(e) => handleCurrencyChange('currentMonthlyIncome', e.target.value)}
                    placeholder="R 0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Base income for replacement ratio calculation
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentRetirementSavings" className="font-medium">
                    Current Retirement Capital
                  </Label>
                  <Input
                    id="currentRetirementSavings"
                    value={formatCurrencyInput(data.currentRetirementSavings || 0)}
                    onChange={(e) =>
                      handleCurrencyChange('currentRetirementSavings', e.target.value)
                    }
                    placeholder="R 0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Total value of existing retirement funds and investments
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentMonthlyContribution" className="font-medium">
                    Current Monthly Contribution
                  </Label>
                  <Input
                    id="currentMonthlyContribution"
                    value={formatCurrencyInput(data.currentMonthlyContribution || 0)}
                    onChange={(e) =>
                      handleCurrencyChange('currentMonthlyContribution', e.target.value)
                    }
                    placeholder="R 0.00"
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
                          <Input
                            id="inflationRate"
                            type="number"
                            step="0.1"
                            value={((assumptions.inflationRate || 0) * 100).toFixed(1)}
                            onChange={(e) =>
                              handleAssumptionChange(
                                'inflationRate',
                                parseFloat(e.target.value) / 100,
                              )
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
                          <Input
                            id="salaryEscalation"
                            type="number"
                            step="0.1"
                            value={((assumptions.salaryEscalation || 0) * 100).toFixed(1)}
                            onChange={(e) =>
                              handleAssumptionChange(
                                'salaryEscalation',
                                parseFloat(e.target.value) / 100,
                              )
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
                          <Input
                            id="preRetirementReturn"
                            type="number"
                            step="0.1"
                            value={((assumptions.preRetirementReturn || 0) * 100).toFixed(1)}
                            onChange={(e) =>
                              handleAssumptionChange(
                                'preRetirementReturn',
                                parseFloat(e.target.value) / 100,
                              )
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
                          <Input
                            id="postRetirementReturn"
                            type="number"
                            step="0.1"
                            value={((assumptions.postRetirementReturn || 0) * 100).toFixed(1)}
                            onChange={(e) =>
                              handleAssumptionChange(
                                'postRetirementReturn',
                                parseFloat(e.target.value) / 100,
                              )
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
                        <Input
                          id="yearsInRetirement"
                          type="number"
                          value={assumptions.yearsInRetirement}
                          onChange={(e) =>
                            handleAssumptionChange('yearsInRetirement', parseInt(e.target.value))
                          }
                        />
                      </div>

                      {/* Replacement Ratio */}
                      <div className="space-y-2">
                        <Label htmlFor="replacementRatio">Target Income Ratio</Label>
                        <div className="relative">
                          <Input
                            id="replacementRatio"
                            type="number"
                            step="1"
                            value={((assumptions.replacementRatio || 0) * 100).toFixed(0)}
                            onChange={(e) =>
                              handleAssumptionChange(
                                'replacementRatio',
                                parseFloat(e.target.value) / 100,
                              )
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

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t">
          <div className="text-sm text-muted-foreground">
            {intakeMode ? 'Financial discovery intake' : 'Step 1 of 4'}
          </div>
          <div className="flex gap-2">
            {intakeMode && onSaveDraft && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onSaveDraft(data as RetirementFNAInputs, assumptions)}
              >
                Save progress
              </Button>
            )}
            <Button type="submit" size="lg" className="gap-2">
              {submitLabel ?? (intakeMode ? 'Continue to submit' : 'Run Calculation')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
