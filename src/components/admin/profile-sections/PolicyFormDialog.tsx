/**
 * DYNAMIC POLICY FORM DIALOG
 * Integrates with Product Configuration for table structure
 * and Provider Configuration for provider selection
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import {
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Building2,
  PiggyBank,
  Coins,
  TrendingUp,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../utils/api';
import { DEFAULT_SCHEMAS } from './default-schemas';
import { calculateRetirementMaturityValue } from '../../../utils/retirementCalculations';
import { PolicyDocumentUpload } from './PolicyDocumentUpload';
import {
  SUBTAB_TO_CATEGORY,
  findFieldByKeyIds,
  hasPolicyValue,
  normalizePolicyDataForStructure,
  getApplyableExtractedFields,
  type Provider,
  type ProductField,
} from './policyFormModel';
import { renderPolicyFieldInput } from './policyFieldInputs';

interface PolicyFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categorySubtabId: string; // e.g., 'risk-planning', 'medical-aid'
  categoryName: string; // e.g., 'Risk Planning', 'Medical Aid'
  clientId: string;
  editingPolicy?: {
    id?: string;
    categoryId?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  };
  onSave: () => void;
}

export function PolicyFormDialog({
  isOpen,
  onClose,
  categorySubtabId,
  categoryName,
  clientId,
  editingPolicy,
  onSave,
}: PolicyFormDialogProps) {
  const [step, setStep] = useState<'subcategory' | 'provider' | 'details'>('provider');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [tableStructure, setTableStructure] = useState<ProductField[]>([]);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** True after any field edit while editing — drives "Recalculate & update" footer label when maturity projection applies. */
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  // Resolve initial category ID from the subtab
  const initialCategoryId = SUBTAB_TO_CATEGORY[categorySubtabId];
  const [activeCategoryId, setActiveCategoryId] = useState(initialCategoryId);

  // Initialize flow when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (editingPolicy) {
        // If editing, use the category from the policy
        setActiveCategoryId(editingPolicy.categoryId || initialCategoryId);
        setStep('details');
        setSelectedProvider({
          // editingPolicy has an index signature, so these read as `unknown`.
          id: editingPolicy.providerId as string,
          name: editingPolicy.providerName as string,
          description: '',
          categoryIds: [],
        });
        setFormData(editingPolicy.data || {});
        setHasUnsavedEdits(false);
      } else {
        // If adding new, check if we need subcategory selection
        if (initialCategoryId === 'retirement_planning') {
          setStep('subcategory');
          // Reset active category to base until selected
          setActiveCategoryId('retirement_planning');
        } else if (initialCategoryId === 'investments') {
          setStep('subcategory');
          setActiveCategoryId('investments');
        } else if (initialCategoryId === 'employee_benefits') {
          setStep('subcategory');
          setActiveCategoryId('employee_benefits');
        } else {
          setStep('provider');
          setActiveCategoryId(initialCategoryId);
        }
        setSelectedProvider(null);
        setFormData({});
        setHasUnsavedEdits(false);
      }
    }
  }, [isOpen, initialCategoryId, editingPolicy]);

  const loadProviders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<{
        providers?: Array<{
          id: string;
          name: string;
          description?: string;
          category_ids?: string[];
          categoryIds?: string[];
          logo_url?: string;
          logoUrl?: string;
        }>;
      }>('/product-management/providers');

      // Map server response (snake_case) to component interface (camelCase)
      // Belt-and-suspenders: accept both legacy camelCase and canonical snake_case
      // fields, since KV data may predate the naming convention migration
      const allProviders = (data.providers || []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        categoryIds: p.category_ids || p.categoryIds || [],
        logoUrl: p.logo_url || p.logoUrl,
      }));

      // Filter providers that support this category
      // For retirement/investment subcategories, we also accept providers linked to the parent category
      const filteredProviders = allProviders.filter((p: Provider) => {
        if (p.categoryIds.includes(activeCategoryId)) return true;

        // Fallback: If looking for sub-category, accept parent category providers
        if (
          (activeCategoryId === 'retirement_pre' || activeCategoryId === 'retirement_post') &&
          p.categoryIds.includes('retirement_planning')
        ) {
          return true;
        }
        if (
          (activeCategoryId === 'investments_voluntary' ||
            activeCategoryId === 'investments_guaranteed') &&
          p.categoryIds.includes('investments')
        ) {
          return true;
        }
        if (
          (activeCategoryId === 'employee_benefits_risk' ||
            activeCategoryId === 'employee_benefits_retirement') &&
          p.categoryIds.includes('employee_benefits')
        ) {
          return true;
        }

        return false;
      });
      setProviders(filteredProviders);
    } catch (err) {
      console.error('Error loading providers:', err);
      toast.error('Failed to load providers');
    } finally {
      setIsLoading(false);
    }
  }, [activeCategoryId]);

  const loadTableStructure = useCallback(async () => {
    setIsLoading(true);
    try {
      const raw = await api.get<unknown>(`/integrations/schemas?categoryId=${activeCategoryId}`);
      // Handle both formats: direct fields array or wrapped in object
      if (
        raw &&
        typeof raw === 'object' &&
        !Array.isArray(raw) &&
        (raw as { fields?: ProductField[] }).fields
      ) {
        setTableStructure((raw as { fields: ProductField[] }).fields);
      } else if (Array.isArray(raw)) {
        setTableStructure(raw as ProductField[]);
      } else {
        setTableStructure([]);
      }
    } catch (err) {
      console.warn('Error loading table structure, using fallback:', err);
      // Fallback to default schema
      const defaultSchema = DEFAULT_SCHEMAS[activeCategoryId];
      if (defaultSchema && defaultSchema.fields) {
        setTableStructure(defaultSchema.fields);
      } else {
        setTableStructure([]);
        // Don't show error for new subcategories that might not have defaults yet
        if (
          activeCategoryId !== 'retirement_pre' &&
          activeCategoryId !== 'retirement_post' &&
          activeCategoryId !== 'investments_voluntary' &&
          activeCategoryId !== 'investments_guaranteed' &&
          activeCategoryId !== 'employee_benefits_risk' &&
          activeCategoryId !== 'employee_benefits_retirement'
        ) {
          toast.error('Failed to load product structure');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeCategoryId]);

  // Load providers and structure whenever activeCategoryId changes (and we are past subcategory step)
  useEffect(() => {
    if (isOpen && activeCategoryId && step !== 'subcategory') {
      loadProviders();
      loadTableStructure();
    }
  }, [isOpen, activeCategoryId, step, loadProviders, loadTableStructure]);

  useEffect(() => {
    if (!isOpen || !editingPolicy || tableStructure.length === 0 || hasUnsavedEdits) return;

    setFormData((prev) =>
      normalizePolicyDataForStructure(
        prev,
        tableStructure,
        (editingPolicy.data as Record<string, unknown> | undefined) || {},
      ),
    );
  }, [isOpen, editingPolicy, tableStructure, hasUnsavedEdits]);

  const handleSubcategorySelect = (subId: string) => {
    setActiveCategoryId(subId);
    setStep('provider');
  };

  const handleProviderSelect = (provider: Provider) => {
    setSelectedProvider(provider);
    setStep('details');
  };

  const recalcMaturityValues = (data: Record<string, unknown>): Record<string, unknown> => {
    const updated: Record<string, unknown> = { ...data };

    const recalcForPrefix = (prefix: 'retirement' | 'invest') => {
      const growthKey =
        prefix === 'invest' ? 'invest_assumptions_growth' : 'retirement_assumptions_growth';
      const escalationKey =
        prefix === 'invest' ? 'invest_assumptions_escalation' : 'retirement_assumptions_escalation';
      const maturityKey = prefix === 'invest' ? 'invest_maturity_date' : 'retirement_maturity_date';
      const contributionKey =
        prefix === 'invest' ? 'invest_monthly_contribution' : 'retirement_monthly_contribution';
      const maturityValueKey =
        prefix === 'invest' ? 'invest_maturity_value' : 'retirement_estimated_maturity_value';

      const growthField = tableStructure.find((f) => f.keyId === growthKey);
      const escalationField = tableStructure.find((f) => f.keyId === escalationKey);
      // Pre-retirement schemas often use retirement_fund_value; key manager also lists retirement_current_value.
      const currentValueField =
        prefix === 'invest'
          ? findFieldByKeyIds(tableStructure, ['invest_current_value'])
          : findFieldByKeyIds(tableStructure, [
              'retirement_current_value',
              'retirement_fund_value',
            ]);
      const maturityDateField = tableStructure.find((f) => f.keyId === maturityKey);
      const contributionField = tableStructure.find((f) => f.keyId === contributionKey);
      const maturityValueField = tableStructure.find((f) => f.keyId === maturityValueKey);

      if (!maturityValueField || !maturityDateField) return;

      const maturityRaw = updated[maturityDateField.id];
      if (!maturityRaw) return;

      const growth = growthField ? Number(updated[growthField.id] ?? 10) : 10;
      const growthNum = Number.isFinite(growth) ? growth : 10;
      const escalationRaw = escalationField ? Number(updated[escalationField.id] ?? 0) : 0;
      const escalationNum = Number.isFinite(escalationRaw) ? escalationRaw : 0;
      const currentVal = currentValueField ? Number(updated[currentValueField.id] ?? 0) : 0;
      const contrib = contributionField ? Number(updated[contributionField.id] ?? 0) : 0;

      const maturityDate = new Date(maturityRaw as string | number | Date);
      if (Number.isNaN(maturityDate.getTime())) return;

      const inceptionKey =
        prefix === 'invest' ? 'invest_date_of_inception' : 'retirement_date_of_inception';
      const inceptionField = tableStructure.find((f) => f.keyId === inceptionKey);
      const inceptionRaw = inceptionField ? updated[inceptionField.id] : null;
      let calcOptions: { premiumAnniversaryReference: Date } | undefined;
      if (inceptionRaw != null && inceptionRaw !== '') {
        const inc = new Date(inceptionRaw as string | number | Date);
        if (!Number.isNaN(inc.getTime())) {
          calcOptions = { premiumAnniversaryReference: inc };
        }
      }

      const result = calculateRetirementMaturityValue(
        currentVal,
        contrib,
        growthNum,
        escalationNum,
        new Date(),
        maturityDate,
        calcOptions,
      );

      updated[maturityValueField.id] = result;
    };

    recalcForPrefix('retirement');
    recalcForPrefix('invest');

    return updated;
  };

  const supportsMaturityProjection = useMemo(
    () =>
      tableStructure.some(
        (f) =>
          f.keyId === 'retirement_estimated_maturity_value' || f.keyId === 'invest_maturity_value',
      ),
    [tableStructure],
  );

  const handleFieldChange = (fieldId: string, value: string | number | boolean) => {
    setHasUnsavedEdits(true);
    setFormData((prev) => recalcMaturityValues({ ...prev, [fieldId]: value }));
    // Clear error for this field
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateForm = (data: Record<string, unknown> = formData): boolean => {
    const newErrors: Record<string, string> = {};

    tableStructure.forEach((field) => {
      if (field.required && !hasPolicyValue(data[field.id])) {
        newErrors[field.id] = `${field.name} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    const normalizedData = normalizePolicyDataForStructure(
      formData,
      tableStructure,
      (editingPolicy?.data as Record<string, unknown> | undefined) || {},
    );

    if (!validateForm(normalizedData)) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!selectedProvider) {
      toast.error('Please select a provider');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(editingPolicy ? 'Updating policy...' : 'Saving policy...');

    try {
      const finalData = recalcMaturityValues(normalizedData);

      const policyData = {
        id: editingPolicy?.id || `policy_${Date.now()}`,
        clientId,
        categoryId: activeCategoryId,
        providerId: selectedProvider.id,
        providerName: selectedProvider.name,
        data: finalData,
        createdAt: editingPolicy?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await (editingPolicy
        ? api.put('/integrations/policies', policyData)
        : api.post('/integrations/policies', policyData));

      toast.success(editingPolicy ? 'Policy updated successfully' : 'Policy added successfully', {
        id: toastId,
      });
      setHasUnsavedEdits(false);
      onSave();
      handleClose();
    } catch (err: unknown) {
      console.error('Error saving policy:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save policy', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep('provider');
    setSelectedProvider(null);
    setFormData({});
    setErrors({});
    onClose();
  };

  const renderFieldInput = (field: ProductField) =>
    renderPolicyFieldInput({
      field,
      formData,
      setFormData,
      errors,
      handleFieldChange,
      recalcMaturityValues,
      tableStructure,
    });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingPolicy ? 'Edit Policy' : 'Add Policy'} - {categoryName}
          </DialogTitle>
          <DialogDescription>
            {step === 'subcategory'
              ? 'Select the retirement phase'
              : step === 'provider'
                ? 'Select a provider from your configured providers'
                : 'Enter the policy details based on your product structure'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" />
          </div>
        ) : (
          <div className="contents">
            {/* Step 0: Sub-category Selection */}
            {step === 'subcategory' && (
              <div className="grid grid-cols-2 gap-4">
                {/* Retirement Subcategories */}
                {initialCategoryId === 'retirement_planning' && (
                  <div className="contents">
                    <button
                      onClick={() => handleSubcategorySelect('retirement_pre')}
                      className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-xl hover:border-purple-600 hover:bg-purple-50 transition-all group"
                    >
                      <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4 group-hover:bg-purple-200">
                        <PiggyBank className="w-8 h-8 text-purple-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Pre-Retirement</h3>
                      <p className="text-sm text-gray-500 text-center mt-2">
                        Accumulation phase (RA, Pension, Provident Funds)
                      </p>
                    </button>

                    <button
                      onClick={() => handleSubcategorySelect('retirement_post')}
                      className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-xl hover:border-purple-600 hover:bg-purple-50 transition-all group"
                    >
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4 group-hover:bg-green-200">
                        <Coins className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Post-Retirement</h3>
                      <p className="text-sm text-gray-500 text-center mt-2">
                        Income phase (Living Annuity, Life Annuity)
                      </p>
                    </button>
                  </div>
                )}

                {/* Investment Subcategories */}
                {initialCategoryId === 'investments' && (
                  <div className="contents">
                    <button
                      onClick={() => handleSubcategorySelect('investments_voluntary')}
                      className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all group"
                    >
                      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-200">
                        <TrendingUp className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Voluntary</h3>
                      <p className="text-sm text-gray-500 text-center mt-2">
                        Discretionary investments (Unit Trusts, TFSA)
                      </p>
                    </button>

                    <button
                      onClick={() => handleSubcategorySelect('investments_guaranteed')}
                      className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all group"
                    >
                      <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4 group-hover:bg-indigo-200">
                        <Lock className="w-8 h-8 text-indigo-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Guaranteed</h3>
                      <p className="text-sm text-gray-500 text-center mt-2">
                        Fixed period/rate investments (Endowments, etc.)
                      </p>
                    </button>
                  </div>
                )}

                {/* Employee Benefits Subcategories */}
                {initialCategoryId === 'employee_benefits' && (
                  <div className="contents">
                    <button
                      onClick={() => handleSubcategorySelect('employee_benefits_risk')}
                      className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-xl hover:border-amber-600 hover:bg-amber-50 transition-all group"
                    >
                      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4 group-hover:bg-amber-200">
                        <Building2 className="w-8 h-8 text-amber-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Risk Benefits</h3>
                      <p className="text-sm text-gray-500 text-center mt-2">
                        Group Life, Disability, Income Protection
                      </p>
                    </button>

                    <button
                      onClick={() => handleSubcategorySelect('employee_benefits_retirement')}
                      className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-xl hover:border-amber-600 hover:bg-amber-50 transition-all group"
                    >
                      <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4 group-hover:bg-orange-200">
                        <PiggyBank className="w-8 h-8 text-orange-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Retirement Funds</h3>
                      <p className="text-sm text-gray-500 text-center mt-2">
                        Pension and Provident Funds
                      </p>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Provider Selection */}
            {step === 'provider' && (
              <div className="space-y-4">
                {providers.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-sm text-gray-600 mb-4">
                      No providers configured for {categoryName}
                    </p>
                    <p className="text-xs text-gray-500">
                      Please add providers in the Product Configuration module first
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {providers.map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() => handleProviderSelect(provider)}
                        className="flex items-center justify-between p-4 border rounded-lg hover:border-[#6d28d9] hover:bg-purple-50 transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          {provider.logoUrl ? (
                            <img
                              src={provider.logoUrl}
                              alt={provider.name}
                              className="h-10 w-10 object-contain"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{provider.name}</p>
                            {provider.description && (
                              <p className="text-sm text-gray-600">{provider.description}</p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Policy Details */}
            {step === 'details' && (
              <div className="space-y-6">
                {/* Selected Provider Display */}
                <div className="flex items-center gap-3 p-3 bg-purple-50 border border-[#6d28d9] rounded-lg">
                  {selectedProvider?.logoUrl ? (
                    <img
                      src={selectedProvider.logoUrl}
                      alt={selectedProvider.name}
                      className="h-8 w-8 object-contain"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-white flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Provider: {selectedProvider?.name}
                    </p>
                  </div>
                  {!editingPolicy && (
                    <Button variant="ghost" size="sm" onClick={() => setStep('provider')}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Change
                    </Button>
                  )}
                </div>

                {/* Dynamic Form Fields */}
                {tableStructure.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto text-amber-400 mb-4" />
                    <p className="text-sm text-gray-600 mb-2">
                      No product structure configured for {categoryName}
                    </p>
                    <p className="text-xs text-gray-500">
                      Please configure the product structure in the Product Configuration module
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tableStructure.map((field) => renderFieldInput(field))}

                    {/* Policy Document Attachment — only when editing an existing policy */}
                    {editingPolicy?.id && (
                      <PolicyDocumentUpload
                        policyId={editingPolicy.id}
                        clientId={clientId}
                        existingDocument={
                          (editingPolicy.document ?? null) as React.ComponentProps<
                            typeof PolicyDocumentUpload
                          >['existingDocument']
                        }
                        existingExtraction={
                          (editingPolicy.extraction ?? null) as React.ComponentProps<
                            typeof PolicyDocumentUpload
                          >['existingExtraction']
                        }
                        existingExtractionHistory={
                          Array.isArray(editingPolicy.extractionHistory)
                            ? editingPolicy.extractionHistory
                            : undefined
                        }
                        existingLockedFields={
                          Array.isArray(editingPolicy.lockedFields)
                            ? editingPolicy.lockedFields
                            : undefined
                        }
                        onDocumentChange={onSave}
                        onApplyExtractedData={(fieldsToApply) => {
                          const applyableFields = getApplyableExtractedFields(fieldsToApply);
                          if (Object.keys(applyableFields).length === 0) return;

                          setHasUnsavedEdits(true);
                          setFormData((prev) =>
                            recalcMaturityValues(
                              normalizePolicyDataForStructure(
                                { ...prev, ...applyableFields },
                                tableStructure,
                                (editingPolicy.data as Record<string, unknown> | undefined) || {},
                              ),
                            ),
                          );
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          {step === 'details' && tableStructure.length > 0 && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </div>
              ) : (
                <span>
                  {editingPolicy && hasUnsavedEdits && supportsMaturityProjection
                    ? 'Recalculate & Update Policy'
                    : editingPolicy
                      ? 'Update Policy'
                      : 'Save Policy'}
                </span>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
