/**
 * Step 1: Information Gathering
 * 
 * Behaviour Rules:
 * - Auto-populate from client profile if data exists
 * - Changes may be edited and persisted back to client profile
 * - All inputs validated before proceeding to Step 2
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form@7.55.0';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Info, Users, Shield, Wallet, Clock, AlertCircle, Heart, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import { RadioGroup, RadioGroupItem } from '../../../../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../../ui/form';
import { useClientProfile } from '../hooks/useClientProfile';
import { useClientProductKeys } from '../hooks/useClientProductKeys';
import { MedicalFNAInputSchema, MedicalFNAFormValues } from '../schema';
import { MedicalFNAInputs } from '../types';
import { toast } from 'sonner@2.0.3';

interface Step1Props {
  clientId?: string;
  initialData?: Partial<MedicalFNAInputs>;
  onNext: (data: MedicalFNAInputs) => void;
}

export function Step1InputForm({ clientId, initialData, onNext }: Step1Props) {
  const { data: profile } = useClientProfile(clientId);
  const { 
    planType, 
    hospitalTariff, 
    totalPremium, 
    msa, 
    lateJoinerPenalty, 
    dependentsCount, 
    isLoading: isProductKeysLoading 
  } = useClientProductKeys(clientId);
  
  const form = useForm<MedicalFNAFormValues>({
    resolver: zodResolver(MedicalFNAInputSchema),
    defaultValues: {
      spousePartner: initialData?.spousePartner ?? false,
      childrenCount: initialData?.childrenCount ?? 0,
      adultDependantsCount: initialData?.adultDependantsCount ?? 0,
      chronicPmbCount: initialData?.chronicPmbCount ?? 0,
      plannedProcedures24m: initialData?.plannedProcedures24m ?? false,
      specialistVisitFreq: initialData?.specialistVisitFreq ?? '0-1',
      providerChoicePreference: initialData?.providerChoicePreference ?? 'Network OK',
      annualDayToDayEstimate: initialData?.annualDayToDayEstimate ?? 0,
      cashflowSensitivity: initialData?.cashflowSensitivity ?? 'Medium',
      currentAge: initialData?.currentAge ?? 30,
      yearsWithoutCoverAfter35: initialData?.yearsWithoutCoverAfter35 ?? 0,
      existingPlanType: initialData?.existingPlanType ?? '',
      existingHospitalCover: initialData?.existingHospitalCover ?? '',
      existingTotalPremium: initialData?.existingTotalPremium ?? 0,
      existingMSA: initialData?.existingMSA ?? 0,
      existingLJP: initialData?.existingLJP ?? 0,
      existingDependents: initialData?.existingDependents ?? 0,
    }
  });

  // Pre-fill from profile and product keys
  useEffect(() => {
    // Only auto-fill if we are NOT editing existing data (initialData is empty/minimal)
    // If coming back from Step 2, initialData will be populated, so we skip this to preserve edits.
    const isEditing = initialData && Object.keys(initialData).length > 2; // > 2 because defaultValues spreads it
    if (isEditing) return;

    // 1. Profile Data
    if (profile) {
      if (profile.spouseFullName || profile.maritalStatus === 'Married') {
        form.setValue('spousePartner', true);
      }
      
      const childCount = (profile.dependants || []).filter((d: { relationship?: string }) => d.relationship === 'Child').length;
      if (childCount > 0) form.setValue('childrenCount', childCount);

      // Calculate age from DOB if available
      if (profile.dateOfBirth) {
        const dob = new Date(profile.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        form.setValue('currentAge', age);
      } else if ((profile as Record<string, unknown>).currentAge) {
        // Fallback: direct currentAge field
        form.setValue('currentAge', (profile as Record<string, unknown>).currentAge as number);
      }
    }

    // 2. Product Keys (Existing Medical Aid)
    if (!isProductKeysLoading) {
      if (planType) form.setValue('existingPlanType', planType);
      
      if (hospitalTariff) {
        let mappedTariff = 'Other';
        if (hospitalTariff.includes('100%')) mappedTariff = '100%';
        else if (hospitalTariff.includes('200%')) mappedTariff = '200%';
        else if (hospitalTariff.includes('100')) mappedTariff = '100%';
        else if (hospitalTariff.includes('200')) mappedTariff = '200%';
        form.setValue('existingHospitalCover', mappedTariff);
      }
      
      if (totalPremium !== undefined) form.setValue('existingTotalPremium', totalPremium);
      if (msa !== undefined) form.setValue('existingMSA', msa);
      if (lateJoinerPenalty !== undefined) form.setValue('existingLJP', lateJoinerPenalty);
      if (dependentsCount !== undefined) form.setValue('existingDependents', dependentsCount);
    }
  }, [profile, initialData, form, planType, hospitalTariff, totalPremium, msa, lateJoinerPenalty, dependentsCount, isProductKeysLoading]);

  const onSubmit = (data: MedicalFNAFormValues) => {
    onNext(data);
  };

  const handleImportExistingCover = () => {
    if (isProductKeysLoading) {
      toast.info("Still loading client data...");
      return;
    }

    let updatedCount = 0;

    if (planType) {
      form.setValue('existingPlanType', planType);
      updatedCount++;
    }
    if (hospitalTariff) {
      // Normalize hospital tariff to match select options
      let mappedTariff = 'Other';
      if (hospitalTariff.includes('100%')) mappedTariff = '100%';
      else if (hospitalTariff.includes('200%')) mappedTariff = '200%';
      // Also try without the percentage symbol if user just typed "100" or "200"
      else if (hospitalTariff.includes('100')) mappedTariff = '100%';
      else if (hospitalTariff.includes('200')) mappedTariff = '200%';
      
      form.setValue('existingHospitalCover', mappedTariff);
      updatedCount++;
    }
    if (totalPremium !== undefined) {
      form.setValue('existingTotalPremium', totalPremium);
      updatedCount++;
    }
    if (msa !== undefined) {
      form.setValue('existingMSA', msa);
      updatedCount++;
    }
    if (lateJoinerPenalty !== undefined) {
      form.setValue('existingLJP', lateJoinerPenalty);
      updatedCount++;
    }
    if (dependentsCount !== undefined) {
      form.setValue('existingDependents', dependentsCount);
      updatedCount++;
    }

    if (updatedCount > 0) {
      toast.success(`Imported ${updatedCount} fields from existing policies`);
    } else {
      toast.info("No matching policy data found to import");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-12">
        
        {/* Section A: Household */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Household Composition</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="spousePartner"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Spouse / Partner</FormLabel>
                    <div className="text-xs text-muted-foreground">Include spouse on policy?</div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="childrenCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Children</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adultDependantsCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adult Dependants</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl>
                  <div className="text-xs text-muted-foreground">Parents, siblings, etc.</div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section B: Risk & Utilisation */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Risk & Utilisation Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="chronicPmbCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chronic PMB Conditions</FormLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((val) => (
                        <div
                          key={val}
                          onClick={() => field.onChange(val)}
                          className={`
                            cursor-pointer rounded-md border p-3 text-center transition-all hover:bg-muted/50
                            ${field.value === val 
                              ? 'border-primary bg-primary/10 text-primary font-medium' 
                              : field.value >= 2 && val === 2 
                                ? 'border-primary bg-primary/10 text-primary font-medium'
                                : 'border-input'}`}
                        >
                          {val === 2 ? '2+' : val}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">PMB conditions covered by law (e.g. Hypertension, Asthma)</div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specialistVisitFreq"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialist Visits per Year</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0-1">Low (0-1 / year)</SelectItem>
                        <SelectItem value="2-4">Moderate (2-4 / year)</SelectItem>
                        <SelectItem value="5+">High (5+ / year)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="plannedProcedures24m"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Planned Procedures</FormLabel>
                      <div className="text-xs text-muted-foreground">Any surgery or scopes in next 24m?</div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="providerChoicePreference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider Preference</FormLabel>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="Network OK" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Network OK
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="Any provider" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Any Provider
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section C: Financial */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Day-to-Day & Financial</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="annualDayToDayEstimate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Est. Annual Day-to-Day Spend (R)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl>
                  <div className="text-xs text-muted-foreground">GP, Meds, Optometry, Dentistry, etc.</div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cashflowSensitivity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cashflow Sensitivity</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                     {['Low', 'Medium', 'High'].map((opt) => (
                       <div
                         key={opt}
                         onClick={() => field.onChange(opt)}
                         className={`
                           cursor-pointer rounded-md border p-3 text-center transition-all hover:bg-muted/50 text-sm
                           ${field.value === opt 
                             ? 'border-primary bg-primary/10 text-primary font-medium' 
                             : 'border-input'}`}
                       >
                         {opt}
                       </div>
                     ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">High = Prefers predictable monthly premiums over ad-hoc bills</div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section E: Existing Medical Aid Details */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Existing Medical Aid Details (Optional)</CardTitle>
            </div>
            {clientId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleImportExistingCover}
                disabled={isProductKeysLoading}
                className="flex-shrink-0"
              >
                {isProductKeysLoading ? (
                  <div className="contents">
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Syncing...
                  </div>
                ) : (
                  <div className="contents">
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                    Import Details
                  </div>
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="existingPlanType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Plan Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Classic Saver" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="existingHospitalCover"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Hospital Tariff</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tariff rate" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="100%">100% Scheme Rate</SelectItem>
                        <SelectItem value="200%">200% Scheme Rate</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="existingTotalPremium"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Monthly Premium (R)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="existingMSA"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical Savings Account (MSA)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)} 
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">Monthly allocation or balance</div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="existingLJP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Late Joiner Penalty (R)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="existingDependents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Dependents</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section D: Compliance / LJP */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Late Joiner Penalty (LJP) Assessment</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-blue-900">What is Late Joiner Penalty?</p>
                <p className="text-blue-800">
                  LJP is a <strong>permanent monthly premium increase</strong> for individuals who join a medical aid after age 35 
                  with gaps in prior South African medical scheme coverage. It ranges from <strong>5% to 75%</strong> based on 
                  years without cover.
                </p>
              </div>
            </div>

            {/* Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="currentAge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Age</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={120} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">Client's current age</div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="yearsWithoutCoverAfter35"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Years Without Medical Aid (After Age 35)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">
                      Total years without registered SA medical scheme coverage after turning 35
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Penalty Bands Reference */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Penalty Bands:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-background rounded border p-3">
                  <div className="font-semibold text-foreground">0 years</div>
                  <div className="text-muted-foreground">No penalty</div>
                </div>
                <div className="bg-background rounded border p-3">
                  <div className="font-semibold text-amber-600">1-4 years</div>
                  <div className="text-muted-foreground">+5% premium</div>
                </div>
                <div className="bg-background rounded border p-3">
                  <div className="font-semibold text-orange-600">5-14 years</div>
                  <div className="text-muted-foreground">+25% premium</div>
                </div>
                <div className="bg-background rounded border p-3">
                  <div className="font-semibold text-red-600">15-24 years</div>
                  <div className="text-muted-foreground">+50% premium</div>
                </div>
              </div>
              <div className="bg-background rounded border p-3 text-xs max-w-xs">
                <div className="font-semibold text-red-700">25+ years</div>
                <div className="text-muted-foreground">+75% premium</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Alert */}
        <div className="bg-muted/50 p-4 rounded-lg flex gap-3 border">
          <Info className="w-5 h-5 text-primary flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            This tool provides an indicative needs analysis. Final recommendations depend on scheme rules, underwriting, waiting periods, DSP/network arrangements, and client affordability.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex justify-end pt-4 border-t">
          <Button type="submit" size="lg">
            Analyze Needs <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </form>
    </Form>
  );
}