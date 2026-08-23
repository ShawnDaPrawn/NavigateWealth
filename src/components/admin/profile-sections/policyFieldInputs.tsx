/**
 * Per-type input rendering for one policy form field. A plain JSX-returning
 * function, not a component: PolicyFormDialog calls it through a thin
 * adapter so the render tree (and the nested AssumptionsTool's identity
 * semantics) stay exactly as before the split.
 */
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { CurrencyInputField } from '../../ui/currency-input';
import type { ProductField } from './policyFormModel';

export function renderPolicyFieldInput({
  field,
  formData,
  setFormData,
  errors,
  handleFieldChange,
  recalcMaturityValues,
  AssumptionsTool,
}: {
  field: ProductField;
  formData: Record<string, unknown>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  errors: Record<string, string>;
  handleFieldChange: (fieldId: string, value: string | number | boolean) => void;
  recalcMaturityValues: (data: Record<string, unknown>) => Record<string, unknown>;
  AssumptionsTool: React.ComponentType<{ field: ProductField }>;
}) {
  // formData is Record<string, unknown>; coerce to string for input/select
  // bindings (the boolean case below reads formData[field.id] directly).
  const value = (formData[field.id] || '') as string;
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
          <div className="flex justify-between items-end min-h-5 gap-2">
            <Label htmlFor={field.id}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>

            {/* Assumptions + explicit recalculate (drivers may use legacy keyIds, e.g. retirement_fund_value) */}
            {(field.keyId === 'retirement_estimated_maturity_value' ||
              field.keyId === 'invest_maturity_value') && (
              <div className="flex items-center gap-1.5 shrink-0">
                <AssumptionsTool field={field} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2 border-dashed border-slate-300 text-slate-700 hover:bg-slate-50"
                  onClick={() => setFormData((prev) => recalcMaturityValues({ ...prev }))}
                >
                  Recalculate
                </Button>
              </div>
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
            checked={formData[field.id] === true || formData[field.id] === 'true'}
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
}
