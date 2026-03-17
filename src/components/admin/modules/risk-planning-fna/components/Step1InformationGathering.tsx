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
import { useForm } from 'react-hook-form@7.55.0';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ArrowLeft, Info, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../ui/tabs';
import { Form } from '../../../../ui/form';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { clientApi } from '../../client-management/api';
import { useClientProfile, useClientKeys } from '../hooks';
import { DEFAULT_FORM_VALUES, QUERY_KEYS } from '../constants';
import { InformationGatheringSchema, transformFormToInput, type InformationGatheringFormValues } from '../schema';
import type { InformationGatheringInput, ClientProfileData } from '../types';

import { IncomeDetailsForm } from './step1/IncomeDetailsForm';
import { DependantsForm } from './step1/DependantsForm';
import { ExistingCoverForm } from './step1/ExistingCoverForm';

interface Step1Props {
  clientId?: string;
  initialData?: InformationGatheringInput;
  onNext: (data: InformationGatheringInput) => void;
}

export function Step1InformationGathering({ clientId, initialData, onNext }: Step1Props) {
  const { data: profileData, isLoading: isLoadingProfile } = useClientProfile(clientId);
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
    resolver: zodResolver(InformationGatheringSchema),
    defaultValues: DEFAULT_FORM_VALUES,
    mode: 'onChange',
  });
  
  // Auto-populate from client profile or initial data
  useEffect(() => {
    if (initialData) {
      populateFromInitialData(initialData);
    } else if (profileData) {
      populateFromProfile(profileData);
    }
  }, [profileData, initialData]);
  
  // Auto-populate Existing Cover fields from client keys
  useEffect(() => {
    if (clientKeys && !initialData && clientKeys.keys && clientKeys.keys.length > 0) {
      // Map of client key IDs to form field names
      const keyToFieldMap: Record<string, keyof InformationGatheringFormValues> = {
        'risk_life_cover_total': 'existingCoverLifePersonal',
        'risk_disability_total': 'existingCoverDisabilityPersonal',
        'risk_severe_illness_total': 'existingCoverSevereIllnessPersonal',
        'risk_temporary_icb_total': 'existingCoverIPTemporaryPersonal',
        'risk_permanent_icb_total': 'existingCoverIPPermanentPersonal',
      };
      
      // Populate each field from its corresponding client key
      Object.entries(keyToFieldMap).forEach(([keyId, fieldName]) => {
        const keyData = clientKeys.keys.find(k => k.keyId === keyId);
        
        if (keyData && keyData.value > 0) {
          form.setValue(fieldName, keyData.value.toString());
        }
      });
    }
  }, [clientKeys, initialData, form]);
  
  const populateFromProfile = (profile: ClientProfileData) => {
    if (profile.grossMonthlyIncome) form.setValue('grossMonthlyIncome', profile.grossMonthlyIncome.toString());
    if (profile.netMonthlyIncome) form.setValue('netMonthlyIncome', profile.netMonthlyIncome.toString());
    if (profile.currentAge) form.setValue('currentAge', profile.currentAge.toString());
    if (profile.retirementAge) form.setValue('retirementAge', profile.retirementAge.toString());
    if (profile.employmentType) form.setValue('employmentType', profile.employmentType);
    
    // Financial fields - default to '0' if not available
    form.setValue('totalOutstandingDebts', profile.totalOutstandingDebts?.toString() || '0');
    form.setValue('totalCurrentAssets', profile.totalCurrentAssets?.toString() || '0');
    form.setValue('totalHouseholdMonthlyExpenditure', profile.totalHouseholdMonthlyExpenditure?.toString() || '0');
    form.setValue('estateWorth', profile.netWorth?.toString() || '0');
    
    if (profile.spouseFullName) form.setValue('spouseFullName', profile.spouseFullName);
    if (profile.spouseAverageMonthlyIncome) form.setValue('spouseAverageMonthlyIncome', profile.spouseAverageMonthlyIncome.toString());
    if (profile.dependants) {
      form.setValue('dependants', profile.dependants.map((dep, idx) => ({
        id: `dep-${idx}`,
        relationship: dep.relationship,
        dependencyTerm: dep.dependencyTerm?.toString() || '',
        monthlyEducationCost: dep.monthlyEducationCost?.toString() || '',
      })));
    }
  };
  
  const populateFromInitialData = (data: InformationGatheringInput) => {
    form.setValue('grossMonthlyIncome', data.grossMonthlyIncome.toString());
    form.setValue('netMonthlyIncome', data.netMonthlyIncome.toString());
    form.setValue('incomeEscalationAssumption', data.incomeEscalationAssumption.toString());
    form.setValue('currentAge', data.currentAge.toString());
    form.setValue('retirementAge', data.retirementAge.toString());
    form.setValue('employmentType', data.employmentType);
    form.setValue('totalOutstandingDebts', data.totalOutstandingDebts.toString());
    form.setValue('totalCurrentAssets', data.totalCurrentAssets.toString());
    form.setValue('totalHouseholdMonthlyExpenditure', data.totalHouseholdMonthlyExpenditure.toString());
    form.setValue('spouseFullName', data.spouseFullName || '');
    form.setValue('spouseAverageMonthlyIncome', data.spouseAverageMonthlyIncome?.toString() || '');
    form.setValue('dependants', data.dependants.map(dep => ({
      id: dep.id,
      relationship: dep.relationship,
      dependencyTerm: dep.dependencyTerm.toString(),
      monthlyEducationCost: dep.monthlyEducationCost.toString(),
    })));
    form.setValue('existingCoverLifePersonal', data.existingCover.life.personal.toString());
    form.setValue('existingCoverLifeGroup', data.existingCover.life.group.toString());
    form.setValue('existingCoverDisabilityPersonal', data.existingCover.disability.personal.toString());
    form.setValue('existingCoverDisabilityGroup', data.existingCover.disability.group.toString());
    form.setValue('existingCoverSevereIllnessPersonal', data.existingCover.severeIllness.personal.toString());
    form.setValue('existingCoverSevereIllnessGroup', data.existingCover.severeIllness.group.toString());
    form.setValue('existingCoverIPTemporaryPersonal', data.existingCover.incomeProtection.temporary.personal.toString());
    form.setValue('existingCoverIPTemporaryGroup', data.existingCover.incomeProtection.temporary.group.toString());
    form.setValue('existingCoverIPPermanentPersonal', data.existingCover.incomeProtection.permanent.personal.toString());
    form.setValue('existingCoverIPPermanentGroup', data.existingCover.incomeProtection.permanent.group.toString());
    form.setValue('ipTemporaryBenefitPeriod', data.incomeProtectionSettings.temporary.benefitPeriod);
    form.setValue('ipPermanentEscalation', data.incomeProtectionSettings.permanent.escalation);
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
          'risk_life_cover_total': 'existingCoverLifePersonal',
          'risk_disability_total': 'existingCoverDisabilityPersonal',
          'risk_severe_illness_total': 'existingCoverSevereIllnessPersonal',
          'risk_temporary_icb_total': 'existingCoverIPTemporaryPersonal',
          'risk_permanent_icb_total': 'existingCoverIPPermanentPersonal',
        };
        
        let updatedCount = 0;
        
        // Populate each field from its corresponding client key
        Object.entries(keyToFieldMap).forEach(([keyId, fieldName]) => {
          const keyData = newKeys.keys.find(k => k.keyId === keyId);
          
          if (keyData && keyData.value > 0) {
            form.setValue(fieldName, keyData.value.toString());
            updatedCount++;
          }
        });
        
        if (updatedCount > 0) {
          toast.success("Existing cover updated from policies");
        } else {
          toast.info("Recalculation complete, but no matching non-zero totals found");
        }
      } else {
        toast.info("Recalculation complete. No totals found.");
      }
      
    } catch (error) {
      console.error("Recalculation failed:", error);
      toast.error("Failed to recalculate existing cover");
    } finally {
      setIsRecalculating(false);
    }
  };
  
  if (isLoadingProfile) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Loading client profile data...
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Data will auto-populate from the client profile if available. You can edit any field as needed.
            Derived values are calculated automatically and cannot be edited directly.
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
            <TabsTrigger value="income" className="text-sm px-6 py-2.5">Income & Personal</TabsTrigger>
            <TabsTrigger value="dependants" className="text-sm px-6 py-2.5">Dependants & Family</TabsTrigger>
            <TabsTrigger value="existing" className="text-sm px-6 py-2.5">Existing Cover</TabsTrigger>
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
        
        {/* Next Step Preview */}
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            <strong>Next Step:</strong> The system will automatically calculate risk needs based on the information you've entered. 
            You'll be able to review all calculations in detail before making any manual adjustments.
          </AlertDescription>
        </Alert>
        
        {/* Submit */}
        <div className="flex justify-between pt-6 border-t">
          <Button type="button" variant="outline" disabled>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90">
            Continue to Calculations
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </Form>
  );
}
