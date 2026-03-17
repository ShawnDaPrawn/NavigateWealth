import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Input } from '../../../../../../ui/input';
import { Textarea } from '../../../../../../ui/textarea';
import { Checkbox } from '../../../../../../ui/checkbox';
import { RequestTemplate, RequestField, RequestFieldSection, FieldType } from '../../../types';

type FieldValue = string | number | boolean | string[] | null;

interface StepRequestDetailsProps {
  template: RequestTemplate;
  requestDetails: Record<string, FieldValue>;
  onUpdateDetails: (details: Record<string, FieldValue>) => void;
}

export function StepRequestDetails({
  template,
  requestDetails,
  onUpdateDetails,
}: StepRequestDetailsProps) {
  const handleFieldChange = (key: string, value: FieldValue) => {
    onUpdateDetails({
      ...requestDetails,
      [key]: value,
    });
  };

  const renderField = (field: RequestField) => {
    const value = requestDetails[field.key] ?? field.defaultValue ?? '';

    switch (field.type) {
      case FieldType.TEXT:
        if (field.validation?.max && field.validation.max > 100) {
          return (
            <Textarea
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
            />
          );
        }
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        );

      case FieldType.NUMBER:
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value))}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );

      case FieldType.DATE:
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          />
        );

      case FieldType.BOOLEAN:
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={value}
              onCheckedChange={(checked) => handleFieldChange(field.key, checked)}
            />
            <label className="text-sm text-slate-600">{field.placeholder || 'Yes'}</label>
          </div>
        );

      case FieldType.DROPDOWN:
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">Select {field.label}...</option>
            {field.options?.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case FieldType.MULTI_SELECT:
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {field.options?.map((option: string) => (
              <div key={option} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...selectedValues, option]
                      : selectedValues.filter((v: string) => v !== option);
                    handleFieldChange(field.key, newValues);
                  }}
                />
                <label className="text-sm text-slate-700">{option}</label>
              </div>
            ))}
          </div>
        );

      case FieldType.FILE_REFERENCE:
        return (
          <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg text-center">
            <p className="text-sm text-slate-500">
              File upload functionality will be available after request creation
            </p>
          </div>
        );

      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        );
    }
  };

  const hasRequiredFields = template.requestDetailsSchema.some(section =>
    section.fields.some(f => f.required)
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-1">Request Details</h3>
        <p className="text-sm text-muted-foreground">
          Fill in the information required for this request.
        </p>
      </div>

      {hasRequiredFields && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              Fields marked with <span className="text-red-500">*</span> are required.
            </p>
          </div>
        </div>
      )}

      {/* Render sections and fields */}
      {template.requestDetailsSchema.length === 0 ? (
        <div className="p-8 text-center text-slate-400">
          <p className="text-sm">No request details configured for this template.</p>
        </div>
      ) : (
        template.requestDetailsSchema
          .sort((a, b) => a.order - b.order)
          .map((section) => (
            <div key={section.id} className="space-y-4">
              <div className="pb-2 border-b border-slate-200">
                <h4 className="font-medium text-slate-900">{section.name}</h4>
                {section.description && (
                  <p className="text-sm text-slate-500 mt-1">{section.description}</p>
                )}
              </div>

              <div className="space-y-4">
                {section.fields
                  .sort((a, b) => a.order - b.order)
                  .map((field) => (
                    <div key={field.id} className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {renderField(field)}
                      {field.helpText && (
                        <p className="text-xs text-slate-500">{field.helpText}</p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}