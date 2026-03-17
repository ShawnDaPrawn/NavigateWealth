/**
 * DYNAMIC POLICY FORM DIALOG
 * Integrates with Product Configuration for table structure
 * and Provider Configuration for provider selection
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { AlertCircle, ChevronRight, ChevronLeft, Loader2, Building2, Calculator, PiggyBank, Coins, TrendingUp, Lock, FileText, Upload, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { createClient } from '../../../utils/supabase/client';
import { formatCurrency } from '../../../utils/currencyFormatter';
import { CurrencyInputField } from '../../ui/currency-input';
import { DEFAULT_SCHEMAS } from './default-schemas';
import { calculateRetirementMaturityValue } from '../../../utils/retirementCalculations';
import { PolicyDocumentUpload } from './PolicyDocumentUpload';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;
const PROVIDERS_API = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/product-management/providers`;

// Map subtab IDs to Product Category IDs
const SUBTAB_TO_CATEGORY: Record<string, string> = {
  'risk-planning': 'risk_planning',
  'medical-aid': 'medical_aid',
  'retirement': 'retirement_planning',
  'investments': 'investments',
  'employee-benefits': 'employee_benefits',
  'tax-planning': 'tax_planning',
  'estate-planning': 'estate_planning',
};

interface Provider {
  id: string;
  name: string;
  description: string;
  categoryIds: string[];
  logoUrl?: string;
}

interface ProductField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
  keyId?: string;
}

interface PolicyFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categorySubtabId: string; // e.g., 'risk-planning', 'medical-aid'
  categoryName: string; // e.g., 'Risk Planning', 'Medical Aid'
  clientId: string;
  editingPolicy?: { id?: string; categoryId?: string; data?: Record<string, unknown>; [key: string]: unknown };
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
          id: editingPolicy.providerId,
          name: editingPolicy.providerName,
          description: '',
          categoryIds: [],
        });
        setFormData(editingPolicy.data || {});
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
      }
    }
  }, [isOpen, initialCategoryId, editingPolicy]);

  // Load providers and structure whenever activeCategoryId changes (and we are past subcategory step)
  useEffect(() => {
    if (isOpen && activeCategoryId && step !== 'subcategory') {
      loadProviders();
      loadTableStructure();
    }
  }, [isOpen, activeCategoryId, step]);

  const loadProviders = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || publicAnonKey;

      const res = await fetch(PROVIDERS_API, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to load providers');

      const data = await res.json();
      
      // Map server response (snake_case) to component interface (camelCase)
      // Belt-and-suspenders: accept both legacy camelCase and canonical snake_case
      // fields, since KV data may predate the naming convention migration
      const allProviders = (data.providers || []).map((p: { id: string; name: string; [key: string]: unknown }) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        categoryIds: (p.category_ids as string[] | undefined) || (p.categoryIds as string[] | undefined) || [],
        logoUrl: (p.logo_url as string | undefined) || (p.logoUrl as string | undefined),
      }));

      // Filter providers that support this category
      // For retirement/investment subcategories, we also accept providers linked to the parent category
      const filteredProviders = allProviders.filter((p: Provider) => {
        if (p.categoryIds.includes(activeCategoryId)) return true;
        
        // Fallback: If looking for sub-category, accept parent category providers
        if ((activeCategoryId === 'retirement_pre' || activeCategoryId === 'retirement_post') && 
            p.categoryIds.includes('retirement_planning')) {
          return true;
        }
        if ((activeCategoryId === 'investments_voluntary' || activeCategoryId === 'investments_guaranteed') && 
            p.categoryIds.includes('investments')) {
          return true;
        }
        if ((activeCategoryId === 'employee_benefits_risk' || activeCategoryId === 'employee_benefits_retirement') && 
            p.categoryIds.includes('employee_benefits')) {
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
  };

  const loadTableStructure = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/schemas?categoryId=${activeCategoryId}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      if (!res.ok) throw new Error('Failed to load table structure');

      const data = await res.json();
      // Handle both formats: direct fields array or wrapped in object
      if (data && data.fields) {
        setTableStructure(data.fields);
      } else if (Array.isArray(data)) {
        setTableStructure(data);
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
        if (activeCategoryId !== 'retirement_pre' && activeCategoryId !== 'retirement_post' &&
            activeCategoryId !== 'investments_voluntary' && activeCategoryId !== 'investments_guaranteed' &&
            activeCategoryId !== 'employee_benefits_risk' && activeCategoryId !== 'employee_benefits_retirement') {
           toast.error('Failed to load product structure');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubcategorySelect = (subId: string) => {
    setActiveCategoryId(subId);
    setStep('provider');
  };

  const handleProviderSelect = (provider: Provider) => {
    setSelectedProvider(provider);
    setStep('details');
  };

  const handleFieldChange = (fieldId: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error for this field
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    tableStructure.forEach((field) => {
      if (field.required && !formData[field.id]) {
        newErrors[field.id] = `${field.name} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
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
      const policyData = {
        id: editingPolicy?.id || `policy_${Date.now()}`,
        clientId,
        categoryId: activeCategoryId,
        providerId: selectedProvider.id,
        providerName: selectedProvider.name,
        data: formData,
        createdAt: editingPolicy?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || publicAnonKey;

      const res = await fetch(`${API_BASE}/policies`, {
        method: editingPolicy ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(policyData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save policy');
      }

      toast.success(editingPolicy ? 'Policy updated successfully' : 'Policy added successfully', {
        id: toastId,
      });
      onSave();
      handleClose();
    } catch (err: unknown) {
      console.error('Error saving policy:', err);
      toast.error(err.message || 'Failed to save policy', { id: toastId });
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

  // Assumptions Tool Component
  const AssumptionsTool = ({ field }: { field: ProductField }) => {
    const [open, setOpen] = useState(false);
    
    // Determine context (Retirement vs Investment)
    const isInvestment = field.keyId === 'invest_maturity_value';
    const prefix = isInvestment ? 'invest' : 'retirement';

    // Key mappings
    const growthKey = isInvestment ? 'invest_assumptions_growth' : 'retirement_assumptions_growth';
    const escalationKey = isInvestment ? 'invest_assumptions_escalation' : 'retirement_assumptions_escalation';
    // Note: For voluntary investments, keys are mapped to invest_voluntary category but IDs remain invest_...
    const currentKey = isInvestment ? 'invest_current_value' : 'retirement_current_value';
    const maturityKey = isInvestment ? 'invest_maturity_date' : 'retirement_maturity_date';
    const contributionKey = isInvestment ? 'invest_monthly_contribution' : 'retirement_monthly_contribution';
    
    // Find related fields by keyId
    const growthField = tableStructure.find(f => f.keyId === growthKey);
    const escalationField = tableStructure.find(f => f.keyId === escalationKey);
    const currentValueField = tableStructure.find(f => f.keyId === currentKey);
    const maturityDateField = tableStructure.find(f => f.keyId === maturityKey);
    const contributionField = tableStructure.find(f => f.keyId === contributionKey);

    // Get current values
    const growth = growthField ? (formData[growthField.id] || 10) : 10;
    const escalation = escalationField ? (formData[escalationField.id] || 5) : 5;
    const currentValue = currentValueField ? (Number(formData[currentValueField.id]) || 0) : 0;
    const contribution = contributionField ? (Number(formData[contributionField.id]) || 0) : 0;
    const maturityDate = maturityDateField ? formData[maturityDateField.id] : null;

    // Temporary state for the modal
    const [tempGrowth, setTempGrowth] = useState(growth);
    const [tempEscalation, setTempEscalation] = useState(escalation);

    useEffect(() => {
      if (open) {
        setTempGrowth(growth);
        setTempEscalation(escalation);
      }
    }, [open, growth, escalation]);

    const handleCalculate = () => {
      if (!maturityDate) {
        toast.error('Please select a Maturity Date first');
        return;
      }

      // Update assumption fields (if they exist in the schema)
      if (growthField) handleFieldChange(growthField.id, tempTempGrowth);
      if (escalationField) handleFieldChange(escalationField.id, tempEscalation);

      // Calculate result
      const result = calculateRetirementMaturityValue(
        currentValue,
        contribution,
        Number(tempGrowth),
        Number(tempEscalation),
        new Date(),
        new Date(maturityDate)
      );

      // Update estimated value
      handleFieldChange(field.id, result);
      setOpen(false);
    };

    // Fix for tempGrowth in handleCalculate
    const tempTempGrowth = tempGrowth; 

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="h-6 text-xs px-2 border-dashed border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <Calculator className="w-3 h-3 mr-1.5" />
            Assumptions
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{isInvestment ? 'Investment' : 'Retirement'} Assumptions</DialogTitle>
            <DialogDescription>
              Adjust growth and escalation rates to project the maturity value.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="bg-gray-50 p-3 rounded-md text-xs space-y-1 mb-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Current Value:</span>
                <span className="font-medium">{formatCurrency(currentValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Monthly Contribution:</span>
                <span className="font-medium">{formatCurrency(contribution)}</span>
              </div>
               <div className="flex justify-between">
                <span className="text-gray-500">Maturity Date:</span>
                <span className="font-medium">{maturityDate ? new Date(maturityDate).toLocaleDateString() : '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="growth" className="text-xs">Annual Growth Rate (%)</Label>
                <div className="relative">
                  <Input 
                    id="growth" 
                    type="number" 
                    value={tempGrowth} 
                    onChange={(e) => setTempGrowth(e.target.value)}
                    className="h-9 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="escalation" className="text-xs">Annual Premium Escalation (%)</Label>
                <div className="relative">
                  <Input 
                    id="escalation" 
                    type="number" 
                    value={tempEscalation} 
                    onChange={(e) => setTempEscalation(e.target.value)}
                    className="h-9 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCalculate} className="w-full bg-purple-600 hover:bg-purple-700">
              Calculate & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const renderFieldInput = (field: ProductField) => {
    // Hide assumption fields from main list
    if (field.keyId === 'retirement_assumptions_growth' || field.keyId === 'retirement_assumptions_escalation' ||
        field.keyId === 'invest_assumptions_growth' || field.keyId === 'invest_assumptions_escalation') {
      return null;
    }

    const value = formData[field.id] || '';
    const hasError = !!errors[field.id];

    // Normalize type to lowercase for safety
    const fieldType = (field.type || 'text').toLowerCase();

    switch (fieldType) {
      case 'text':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={`Enter ${field.name.toLowerCase()}`}
              className={hasError ? 'border-red-500' : ''}
            />
            {hasError && <p className="text-xs text-red-500">{errors[field.id]}</p>}
          </div>
        );

      case 'number':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={`Enter ${field.name.toLowerCase()}`}
              className={hasError ? 'border-red-500' : ''}
            />
            {hasError && <p className="text-xs text-red-500">{errors[field.id]}</p>}
          </div>
        );

      case 'currency':
        return (
          <div key={field.id} className="space-y-2">
            <div className="flex justify-between items-end min-h-5">
              <Label htmlFor={field.id}>
                {field.name}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              
              {/* Inject Assumptions Tool for Estimated Maturity Value */}
              {(field.keyId === 'retirement_estimated_maturity_value' || field.keyId === 'invest_maturity_value') && (
                <AssumptionsTool field={field} />
              )}
            </div>
            
            <CurrencyInputField
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder="0.00"
              className={hasError ? 'border-red-500' : ''}
              // If calculated, maybe make it read-only? User said "Assumptions can be edited", implies result is output.
              // But usually users want to override manually too. I'll leave it editable.
            />
            {hasError && <p className="text-xs text-red-500">{errors[field.id]}</p>}
          </div>
        );

      case 'percentage':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="relative">
              <Input
                id={field.id}
                type="number"
                value={value}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                placeholder="0"
                className={`pr-8 ${hasError ? 'border-red-500' : ''}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
            </div>
            {hasError && <p className="text-xs text-red-500">{errors[field.id]}</p>}
          </div>
        );

      case 'date':
      case 'date_inception':
      case 'date_maturity': // Explicitly handle maturity date if named this way
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type="date"
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className={hasError ? 'border-red-500' : ''}
            />
            {hasError && <p className="text-xs text-red-500">{errors[field.id]}</p>}
          </div>
        );

      case 'boolean':
        return (
          <div key={field.id} className="flex items-center justify-between space-y-2">
            <Label htmlFor={field.id}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Switch
              id={field.id}
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
            />
          </div>
        );

      case 'dropdown':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value} onValueChange={(val) => handleFieldChange(field.id, val)}>
              <SelectTrigger className={hasError ? 'border-red-500' : ''}>
                <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasError && <p className="text-xs text-red-500">{errors[field.id]}</p>}
          </div>
        );

      case 'long_text':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={`Enter ${field.name.toLowerCase()}`}
              rows={4}
              className={hasError ? 'border-red-500' : ''}
            />
            {hasError && <p className="text-xs text-red-500">{errors[field.id]}</p>}
          </div>
        );

      case 'file_upload':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFieldChange(field.id, file.name);
                }
              }}
              className={hasError ? 'border-red-500' : ''}
            />
            {hasError && <p className="text-xs text-red-500">{errors[field.id]}</p>}
          </div>
        );

      default:
        // Fallback for unknown types - render as text so they are at least visible
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
              <span className="ml-2 text-xs text-gray-400 font-normal">(Type: {field.type})</span>
            </Label>
            <Input
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={`Enter ${field.name.toLowerCase()}`}
              className={hasError ? 'border-red-500' : ''}
            />
            {hasError && <p className="text-xs text-red-500">{errors[field.id]}</p>}
          </div>
        );
    }
  };

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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep('provider')}
                    >
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
                        existingDocument={editingPolicy.document || null}
                        existingExtraction={editingPolicy.extraction || null}
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
                          // Update the local form data with extracted values
                          setFormData((prev) => ({ ...prev, ...fieldsToApply }));
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
                <span>{editingPolicy ? 'Update Policy' : 'Save Policy'}</span>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}