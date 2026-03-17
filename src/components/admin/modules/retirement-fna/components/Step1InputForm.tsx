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
import { RetirementFnaAPI } from '../api';
import { DEFAULT_RETIREMENT_ASSUMPTIONS } from '../utils/calculation-engine';

interface Step1InputFormProps {
  clientId?: string;
  initialData: Partial<RetirementFNAInputs>;
  initialAssumptions?: Partial<RetirementFNAAdjustments>;
  onNext: (data: RetirementFNAInputs, assumptions: RetirementFNAAdjustments) => void;
}

// Backend response shape for auto-population
interface AutoPopulateResponse {
  currentAge?: number;
  intendedRetirementAge?: number;
  netMonthlyIncome?: number;
  grossMonthlyIncome?: number;
  totalMonthlyContribution?: number;
  totalCurrentRetirementCapital?: number;
  [key: string]: unknown; // Allow other properties
}

export function Step1InputForm({ clientId, initialData, initialAssumptions, onNext }: Step1InputFormProps) {
  const [data, setData] = useState<Partial<RetirementFNAInputs>>(initialData);
  
  // Initialize assumptions with passed values or system defaults
  const [assumptions, setAssumptions] = useState<RetirementFNAAdjustments>({
    inflationRate: initialAssumptions?.inflationRate ?? DEFAULT_RETIREMENT_ASSUMPTIONS.inflationRate,
    preRetirementReturn: initialAssumptions?.preRetirementReturn ?? DEFAULT_RETIREMENT_ASSUMPTIONS.preRetirementReturn,
    postRetirementReturn: initialAssumptions?.postRetirementReturn ?? DEFAULT_RETIREMENT_ASSUMPTIONS.postRetirementReturn,
    salaryEscalation: initialAssumptions?.salaryEscalation ?? DEFAULT_RETIREMENT_ASSUMPTIONS.salaryEscalation,
    premiumEscalation: initialAssumptions?.premiumEscalation ?? DEFAULT_RETIREMENT_ASSUMPTIONS.premiumEscalation,
    yearsInRetirement: initialAssumptions?.yearsInRetirement ?? DEFAULT_RETIREMENT_ASSUMPTIONS.yearsInRetirement,
    replacementRatio: initialAssumptions?.replacementRatio ?? DEFAULT_RETIREMENT_ASSUMPTIONS.replacementRatio,
    ...initialAssumptions // Spread any others
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [hasLoadedData, setHasLoadedData] = useState(false);

  // Auto-populate on mount if client ID exists and we haven't loaded data yet
  useEffect(() => {
    if (clientId && !hasLoadedData) {
      loadProfileData();
    }
  }, [clientId, hasLoadedData]);

  const loadProfileData = async () => {
    if (!clientId || hasLoadedData) return;
    setLoading(true);
    setError(null);
    try {
      // Cast to unknown first then to expected shape to allow property access
      // The API returns Partial<RetirementFNAInputs> but actually returns the backend shape
      const response = await RetirementFnaAPI.getAutoPopulatedInputs(clientId);
      const autoData = response as unknown as AutoPopulateResponse;
      
      const populatedData: Partial<RetirementFNAInputs> = {
        currentAge: autoData.currentAge,
        retirementAge: autoData.intendedRetirementAge || 65,
        // Prefer net income, fall back to gross, or 0
        currentMonthlyIncome: autoData.netMonthlyIncome || autoData.grossMonthlyIncome || 0,
        currentMonthlyContribution: autoData.totalMonthlyContribution || 0,
        currentRetirementSavings: autoData.totalCurrentRetirementCapital || 0,
      };
      
      setData(populatedData);
      setHasLoadedData(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to load client data: ${errorMsg}. Please enter details manually.`);
      setHasLoadedData(true); // Mark as attempted even if failed
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof RetirementFNAInputs, value: string | number | boolean) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleCurrencyChange = (field: keyof RetirementFNAInputs, value: string) => {
    // Parse the string value back to a number for state
    const cleanValue = cleanCurrencyInput(value);
    const numericValue = cleanValue ? parseFloat(cleanValue) : 0;
    handleChange(field, numericValue);
  };
  
  const handleAssumptionChange = (field: keyof RetirementFNAAdjustments, value: string | number | boolean) => {
    setAssumptions(prev => ({ ...prev, [field]: value }));
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
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Please review and confirm all client information below. Data has been pre-populated from the client profile where available.
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
                    <p className="text-xs text-muted-foreground">
                      Client's current age in years
                    </p>
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
                    <p className="text-xs text-muted-foreground">
                      Target age for retirement
                    </p>
                  </div>
                </div>

                {data.currentAge && data.retirementAge && data.retirementAge > data.currentAge && (
                  <Alert className="bg-primary/10 border-primary/20">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm">
                      Years until retirement: <strong>{data.retirementAge - data.currentAge} years</strong>
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
                    onChange={(e) => handleCurrencyChange('currentRetirementSavings', e.target.value)}
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
                    onChange={(e) => handleCurrencyChange('currentMonthlyContribution', e.target.value)}
                    placeholder="R 0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Total monthly contributions to retirement savings
                  </p>
                </div>
              </CardContent>
            </Card>

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
                        onChange={(e) => handleAssumptionChange('inflationRate', parseFloat(e.target.value) / 100)}
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
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
                        onChange={(e) => handleAssumptionChange('salaryEscalation', parseFloat(e.target.value) / 100)}
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
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
                        onChange={(e) => handleAssumptionChange('preRetirementReturn', parseFloat(e.target.value) / 100)}
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
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
                        onChange={(e) => handleAssumptionChange('postRetirementReturn', parseFloat(e.target.value) / 100)}
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                    </div>
                  </div>

                  {/* Years in Retirement */}
                  <div className="space-y-2">
                    <Label htmlFor="yearsInRetirement">Years in Retirement</Label>
                    <Input
                      id="yearsInRetirement"
                      type="number"
                      value={assumptions.yearsInRetirement}
                      onChange={(e) => handleAssumptionChange('yearsInRetirement', parseInt(e.target.value))}
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
                        onChange={(e) => handleAssumptionChange('replacementRatio', parseFloat(e.target.value) / 100)}
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                These assumptions will be used for the initial calculation. You can refine them further in Step 3.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t">
          <div className="text-sm text-muted-foreground">
            Step 1 of 4
          </div>
          <Button type="submit" size="lg" className="gap-2">
            Run Calculation
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}