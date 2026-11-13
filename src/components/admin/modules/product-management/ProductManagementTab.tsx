import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '../../../ui/select';
import { Label } from '../../../ui/label';
import { PRODUCT_CATEGORIES, ProductCategoryId } from './types';
import { useProductSchema } from './hooks/useProductSchema';
import { SchemaEditor } from './components/SchemaEditor';
import { SchemaLivePreview } from './components/SchemaLivePreview';

export function ProductManagementTab() {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategoryId | ''>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { currentFields, hasUnsavedChanges, saveSchema, updateFields } =
    useProductSchema(selectedCategory);

  const handleSaveWrapper = async () => {
    const success = await saveSchema();
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const selectedCategoryName = PRODUCT_CATEGORIES.find((c) => c.id === selectedCategory)?.name;

  return (
    <div className="space-y-8">
      {/* Category Selection */}
      <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-900">Select Product Category</Label>
          <p className="text-sm text-gray-500 mb-3">
            Choose a category to configure its data fields and table structure.
          </p>
          <Select
            value={selectedCategory}
            onValueChange={(val) => setSelectedCategory(val as ProductCategoryId)}
          >
            <SelectTrigger className="w-full sm:w-[300px] bg-gray-50 border-gray-200">
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {/* Standalone Categories */}
              <SelectItem value="risk_planning">Risk planning</SelectItem>
              <SelectItem value="medical_aid">Medical aid</SelectItem>

              {/* Retirement Group */}
              <SelectGroup>
                <SelectLabel className="pl-2 font-semibold text-gray-900">
                  Retirement planning
                </SelectLabel>
                <SelectItem value="retirement_pre" className="pl-6">
                  Pre-retirement
                </SelectItem>
                <SelectItem value="retirement_post" className="pl-6">
                  Post-retirement (living annuity)
                </SelectItem>
                <SelectItem value="retirement_post_fixed" className="pl-6">
                  Post-retirement (fixed annuity)
                </SelectItem>
              </SelectGroup>

              {/* Investments Group */}
              <SelectGroup>
                <SelectLabel className="pl-2 font-semibold text-gray-900">Investments</SelectLabel>
                <SelectItem value="investments_voluntary" className="pl-6">
                  Voluntary investments
                </SelectItem>
                <SelectItem value="investments_guaranteed" className="pl-6">
                  Guaranteed investments
                </SelectItem>
              </SelectGroup>

              {/* Other Standalone Categories */}
              <SelectGroup>
                <SelectLabel className="pl-2 font-semibold text-gray-900">
                  Employee benefits
                </SelectLabel>
                <SelectItem value="employee_benefits_risk" className="pl-6">
                  Risk
                </SelectItem>
                <SelectItem value="employee_benefits_retirement" className="pl-6">
                  Retirement
                </SelectItem>
              </SelectGroup>

              <SelectItem value="tax_planning">Tax planning</SelectItem>
              <SelectItem value="estate_planning">Estate planning</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedCategory && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
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
