import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../ui/tabs';
import { TaxPlanningInputs } from '../types';
import { ArrowRight, Info, User, Wallet, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrencyInput, cleanCurrencyInput } from '../../../../../utils/currencyFormatter';
import { useFormPrefill } from '../../form-prefill';

interface Step1Props {
  clientId?: string;
  initialData: Partial<TaxPlanningInputs>;
  onNext: (inputs: TaxPlanningInputs) => void;
  intakeMode?: boolean;
  submitLabel?: string;
  onSaveDraft?: (inputs: TaxPlanningInputs) => void;
}

export function Step1InputForm({
  clientId,
  initialData,
  onNext,
  intakeMode = false,
  submitLabel,
  onSaveDraft,
}: Step1Props) {
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [prefillStarted, setPrefillStarted] = useState(false);

  const [formData, setFormData] = React.useState<TaxPlanningInputs>({
    age: 45,
    maritalStatus: 'married_out_community',
    taxResidency: 'resident',
    numberOfDependants: 2,
    employmentIncome: 0,
    variableIncome: 0,
    businessIncome: 0,
    rentalIncome: 0,
    interestIncome: 0,
    dividendIncome: 0,
    foreignIncome: 0,
    capitalGainsRealised: 0,
    raContributions: 0,
    tfsaContributionsLifetime: 0,
    medicalSchemeMembers: 3,
    ...initialData,
  });

  const { PrefillUI, startPrefill } = useFormPrefill({
    clientId,
    formId: 'tax-fna-step1',
    currentValues: formData as unknown as Record<string, unknown>,
    autoOpenReview: !intakeMode,
    onApplyValues: (values) => {
      setFormData((prev) => ({ ...prev, ...(values as Partial<TaxPlanningInputs>) }));
    },
  });

  useEffect(() => {
    const isInitialDataEmpty = Object.keys(initialData).length === 0;
    if (clientId && !prefillStarted && isInitialDataEmpty) {
      setPrefillStarted(true);
      void startPrefill();
    }
  }, [clientId, prefillStarted, initialData, startPrefill]);

  const handleChange = (field: keyof TaxPlanningInputs, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNumberChange = (field: keyof TaxPlanningInputs, value: string) => {
    const num = parseFloat(value);
    handleChange(field, isNaN(num) ? 0 : num);
  };

  const handleCurrencyChange = (field: keyof TaxPlanningInputs, value: string) => {
    // Parse the string value back to a number for state
    const cleanValue = cleanCurrencyInput(value);
    const numericValue = cleanValue ? parseFloat(cleanValue) : 0;
    handleChange(field, numericValue);
  };

  const handleSubmit = () => {
    // Basic Validation
    if (formData.age < 0 || formData.age > 120) {
      toast.error('Please enter a valid age');
      return;
    }
    if (formData.employmentIncome < 0) {
      toast.error('Income cannot be negative');
      return;
    }

    onNext(formData);
  };

  return (
    <div className="space-y-6">
      {!intakeMode && PrefillUI}

      {/* Introduction / Context */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 items-start text-blue-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-sm">
            {intakeMode ? 'Your tax information' : 'Information Gathering'}
          </h4>
          <p className="text-sm mt-1 text-blue-700">
            {intakeMode
              ? 'Share your profile and annual income figures. Your adviser will apply tax rules and calculations after review.'
              : "Confirm the client's profile and annual gross income streams below. Do not apply any tax tables or calculations yet—enter raw gross figures."}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Client Profile
          </TabsTrigger>
          <TabsTrigger value="financial">
            <Wallet className="h-4 w-4 mr-2" />
            Financial Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Client Profile
              </CardTitle>
              <CardDescription>
                Demographic factors affecting tax rebates and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <div className="space-y-2">
                <Label>Age (Years)</Label>
                <Input
                  type="number"
                  value={formData.age}
                  onChange={(e) => handleNumberChange('age', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tax Residency</Label>
                <Select
                  value={formData.taxResidency}
                  onValueChange={(val: string) => handleChange('taxResidency', val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resident">SA Resident</SelectItem>
                    <SelectItem value="non_resident">Non-Resident</SelectItem>
                    <SelectItem value="dual">Dual Residency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Marital Status</Label>
                <Select
                  value={formData.maritalStatus}
                  onValueChange={(val: string) => handleChange('maritalStatus', val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single / Widowed / Divorced</SelectItem>
                    <SelectItem value="married_in_community">Married (In Community)</SelectItem>
                    <SelectItem value="married_out_community">
                      Married (Out of Community)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Medical Scheme Members</Label>
                <Input
                  type="number"
                  value={formData.medicalSchemeMembers}
                  onChange={(e) => handleNumberChange('medicalSchemeMembers', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6 mt-6">
          {/* SECTION B: TAXABLE INCOME STREAMS */}
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Taxable Income Streams
              </CardTitle>
              <CardDescription>Enter annual gross amounts (Code 3601, 3606, etc.)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Employment Income</Label>
                  <Input
                    value={formatCurrencyInput(formData.employmentIncome)}
                    onChange={(e) => handleCurrencyChange('employmentIncome', e.target.value)}
                    placeholder="R 0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Variable (Bonus/Comm)</Label>
                  <Input
                    value={formatCurrencyInput(formData.variableIncome)}
                    onChange={(e) => handleCurrencyChange('variableIncome', e.target.value)}
                    placeholder="R 0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Business / Director Fees</Label>
                  <Input
                    value={formatCurrencyInput(formData.businessIncome)}
                    onChange={(e) => handleCurrencyChange('businessIncome', e.target.value)}
                    placeholder="R 0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Rental Income (Profit)</Label>
                  <Input
                    value={formatCurrencyInput(formData.rentalIncome)}
                    onChange={(e) => handleCurrencyChange('rentalIncome', e.target.value)}
                    placeholder="R 0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Foreign Income</Label>
                  <Input
                    value={formatCurrencyInput(formData.foreignIncome)}
                    onChange={(e) => handleCurrencyChange('foreignIncome', e.target.value)}
                    placeholder="R 0.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION C: PASSIVE & CAPITAL */}
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Passive & Capital
              </CardTitle>
              <CardDescription>Investment returns and capital events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Interest Income (Local)</Label>
                  <Input
                    value={formatCurrencyInput(formData.interestIncome)}
                    onChange={(e) => handleCurrencyChange('interestIncome', e.target.value)}
                    placeholder="R 0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Dividend Income</Label>
                  <Input
                    value={formatCurrencyInput(formData.dividendIncome)}
                    onChange={(e) => handleCurrencyChange('dividendIncome', e.target.value)}
                    placeholder="R 0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Capital Gains (Realised)</Label>
                  <Input
                    value={formatCurrencyInput(formData.capitalGainsRealised)}
                    onChange={(e) => handleCurrencyChange('capitalGainsRealised', e.target.value)}
                    placeholder="R 0.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION D: CONTRIBUTIONS */}
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Deductions & Allowances
              </CardTitle>
              <CardDescription>Current contributions for the tax year</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>RA / Pension Contributions (Annual)</Label>
                  <Input
                    value={formatCurrencyInput(formData.raContributions)}
                    onChange={(e) => handleCurrencyChange('raContributions', e.target.value)}
                    placeholder="R 0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Total contributions to approved retirement funds
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>TFSA Lifetime Total</Label>
                  <Input
                    value={formatCurrencyInput(formData.tfsaContributionsLifetime)}
                    onChange={(e) =>
                      handleCurrencyChange('tfsaContributionsLifetime', e.target.value)
                    }
                    placeholder="R 0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cumulative contributions since inception (Max R500k)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-6 border-t">
        <div className="text-sm text-muted-foreground">{intakeMode ? 'Step 1' : 'Step 1 of 4'}</div>
        <div className="flex gap-2">
          {intakeMode && onSaveDraft && (
            <Button type="button" variant="outline" onClick={() => onSaveDraft(formData)}>
              Save draft
            </Button>
          )}
          <Button onClick={handleSubmit} size="lg" className="gap-2">
            {submitLabel ??
              (intakeMode ? 'Continue to submit' : 'Confirm Inputs & Run Calculation')}{' '}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
