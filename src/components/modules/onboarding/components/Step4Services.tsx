import React from 'react';
import { Label } from '../../../ui/label';
import { Input } from '../../../ui/input';
import { Checkbox } from '../../../ui/checkbox';
import { StepProps } from '../types';
import { ACCOUNT_REASON_OPTIONS, URGENCY_OPTIONS, EXISTING_PRODUCTS } from '../constants';
import {
  INPUT_CLASS,
  LABEL_CLASS,
  SECTION_CONTAINER_CLASS,
} from '../form-styles';
import { Target, Clock, Package, CheckCircle2, Building2 } from 'lucide-react';

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-9 w-9 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4.5 w-4.5 text-[#6d28d9]" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

export function Step4Services({ data, updateData }: StepProps) {
  const toggleAccountReason = (reason: string) => {
    const currentReasons = data.accountReasons;
    const newReasons = currentReasons.includes(reason)
      ? currentReasons.filter(r => r !== reason)
      : [...currentReasons, reason];
    updateData('accountReasons', newReasons);
  };

  const toggleExistingProduct = (product: string) => {
    const current = data.existingProducts;
    if (product === 'None of the above') {
      if (current.includes(product)) {
        updateData('existingProducts', []);
      } else {
        updateData('existingProducts', [product]);
        // Clear all provider entries when "None" is selected
        updateData('existingProductProviders', {});
      }
      return;
    }
    const withoutNone = current.filter(p => p !== 'None of the above');
    const newProducts = withoutNone.includes(product)
      ? withoutNone.filter(p => p !== product)
      : [...withoutNone, product];
    updateData('existingProducts', newProducts);

    // Remove provider entry if product is being deselected
    if (withoutNone.includes(product)) {
      const updatedProviders = { ...(data.existingProductProviders || {}) };
      delete updatedProviders[product];
      updateData('existingProductProviders', updatedProviders);
    }
  };

  const updateProvider = (product: string, provider: string) => {
    const current = data.existingProductProviders || {};
    updateData('existingProductProviders', { ...current, [product]: provider });
  };

  // Products that are selected and are NOT "None of the above" — these get provider inputs
  const selectedRealProducts = data.existingProducts.filter(p => p !== 'None of the above');

  return (
    <div className="space-y-10">
      {/* Services of Interest */}
      <div>
        <SectionHeader icon={Target} title="Services of Interest" description="Select all the areas where you'd like guidance" />
        <div className={SECTION_CONTAINER_CLASS}>
          <p className="text-sm text-gray-600 mb-5 font-medium">Please select all that apply <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ACCOUNT_REASON_OPTIONS.map((reason) => {
              const isSelected = data.accountReasons.includes(reason);
              return (
                <div
                  key={reason}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-[#6d28d9]/5 border-[#6d28d9]/40 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  onClick={() => toggleAccountReason(reason)}
                >
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected ? 'bg-[#6d28d9] border-[#6d28d9]' : 'border-gray-300 group-hover:border-gray-400'
                  }`}>
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <span className={`text-sm font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                    {reason}
                  </span>
                </div>
              );
            })}
          </div>

          {data.accountReasons.includes('Other') && (
            <div className="mt-5 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label htmlFor="otherReason" className={LABEL_CLASS}>Please specify <span className="text-red-500">*</span></Label>
              <Input id="otherReason" value={data.otherReason} onChange={(e) => updateData('otherReason', e.target.value)} className={`${INPUT_CLASS} max-w-md`} placeholder="Tell us more..." />
            </div>
          )}
        </div>
      </div>

      {/* Urgency */}
      <div>
        <SectionHeader icon={Clock} title="Timeline" description="How soon would you like to get started?" />
        <div className={SECTION_CONTAINER_CLASS}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {URGENCY_OPTIONS.map((option) => {
              const isSelected = data.urgency === option.value;
              return (
                <div
                  key={option.value}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#6d28d9]/5 border-[#6d28d9]/40 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  onClick={() => updateData('urgency', option.value)}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-[#6d28d9]' : 'border-gray-300'
                    }`}>
                      {isSelected && <div className="h-2 w-2 rounded-full bg-[#6d28d9]" />}
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{option.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Existing Products */}
      <div>
        <SectionHeader icon={Package} title="Existing Financial Products" description="Do you currently have any of the following? This helps us understand your starting point." />
        <div className={SECTION_CONTAINER_CLASS}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {EXISTING_PRODUCTS.map((product) => {
              const isSelected = data.existingProducts.includes(product);
              const isNone = product === 'None of the above';
              return (
                <div
                  key={product}
                  className={`flex items-center gap-2.5 p-3.5 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? isNone ? 'bg-gray-100 border border-gray-300' : 'bg-[#6d28d9]/5 border border-[#6d28d9]/30'
                      : 'hover:bg-gray-50 border border-gray-200'
                  }`}
                  onClick={() => toggleExistingProduct(product)}
                >
                  <Checkbox
                    id={`product-${product}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleExistingProduct(product)}
                    className="flex-shrink-0"
                  />
                  <label
                    htmlFor={`product-${product}`}
                    className={`text-sm cursor-pointer ${isSelected ? 'font-medium text-gray-900' : 'text-gray-600'} ${isNone ? 'italic' : ''}`}
                  >
                    {product}
                  </label>
                </div>
              );
            })}
          </div>

          {/* Provider inputs for selected products */}
          {selectedRealProducts.length > 0 && (
            <div className="mt-6 pt-5 border-t border-gray-200 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-[#6d28d9]" />
                <p className="text-sm font-semibold text-gray-800">Which providers are these with?</p>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Knowing your current providers helps your adviser assess your portfolio holistically. Leave blank if you're unsure.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedRealProducts.map((product) => (
                  <div key={product}>
                    <Label htmlFor={`provider-${product}`} className="text-xs font-medium text-gray-600">
                      {product}
                    </Label>
                    <Input
                      id={`provider-${product}`}
                      value={(data.existingProductProviders || {})[product] || ''}
                      onChange={(e) => updateProvider(product, e.target.value)}
                      placeholder="e.g. Discovery, Sanlam, Allan Gray"
                      className={`${INPUT_CLASS} !mt-1`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
