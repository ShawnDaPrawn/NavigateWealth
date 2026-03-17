import React, { useState } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel
} from '../../../ui/select';
import { Label } from '../../../ui/label';
import { Card, CardContent } from '../../../ui/card';
import { Info } from 'lucide-react';
import { 
  PRODUCT_CATEGORIES, 
  ProductCategoryId, 
} from './types';
import { useProductSchema } from './hooks/useProductSchema';
import { SchemaEditor } from './components/SchemaEditor';
import { SchemaLivePreview } from './components/SchemaLivePreview';

export function ProductManagementTab() {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategoryId | ''>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { 
    currentFields, 
    hasUnsavedChanges, 
    saveSchema, 
    updateFields 
  } = useProductSchema(selectedCategory);

  const handleSaveWrapper = async () => {
    const success = await saveSchema();
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const selectedCategoryName = PRODUCT_CATEGORIES.find(c => c.id === selectedCategory)?.name;

  return (
    <div className="space-y-8">
      {/* Category Selection */}
      <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-900">Select Product Category</Label>
          <p className="text-sm text-gray-500 mb-3">Choose a category to configure its data fields and table structure.</p>
          <Select 
            value={selectedCategory} 
            onValueChange={(val) => setSelectedCategory(val as ProductCategoryId)}
          >
            <SelectTrigger className="w-full sm:w-[300px] bg-gray-50 border-gray-200">
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {/* Standalone Categories */}
              <SelectItem value="risk_planning">Risk Planning</SelectItem>
              <SelectItem value="medical_aid">Medical Aid</SelectItem>
              
              {/* Retirement Group */}
              <SelectGroup>
                <SelectLabel className="pl-2 font-semibold text-gray-900">Retirement Planning</SelectLabel>
                <SelectItem value="retirement_pre" className="pl-6">Pre-Retirement</SelectItem>
                <SelectItem value="retirement_post" className="pl-6">Post-Retirement</SelectItem>
              </SelectGroup>

              {/* Investments Group */}
              <SelectGroup>
                <SelectLabel className="pl-2 font-semibold text-gray-900">Investments</SelectLabel>
                <SelectItem value="investments_voluntary" className="pl-6">Voluntary Investments</SelectItem>
                <SelectItem value="investments_guaranteed" className="pl-6">Guaranteed Investments</SelectItem>
              </SelectGroup>

              {/* Other Standalone Categories */}
              <SelectGroup>
                <SelectLabel className="pl-2 font-semibold text-gray-900">Employee Benefits</SelectLabel>
                <SelectItem value="employee_benefits_risk" className="pl-6">Risk</SelectItem>
                <SelectItem value="employee_benefits_retirement" className="pl-6">Retirement</SelectItem>
              </SelectGroup>

              <SelectItem value="tax_planning">Tax Planning</SelectItem>
              <SelectItem value="estate_planning">Estate Planning</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedCategory && (
        <div className="space-y-8">
          {/* Schema Builder */}
          <SchemaEditor
            currentFields={currentFields}
            updateFields={updateFields}
            selectedCategoryName={selectedCategoryName}
            selectedCategoryId={selectedCategory}
            onSave={handleSaveWrapper}
            saveSuccess={saveSuccess}
            hasUnsavedChanges={hasUnsavedChanges}
          />

          {/* Live User Preview */}
          <SchemaLivePreview 
            currentFields={currentFields}
            selectedCategoryName={selectedCategoryName}
          />
        </div>
      )}
    </div>
  );
}