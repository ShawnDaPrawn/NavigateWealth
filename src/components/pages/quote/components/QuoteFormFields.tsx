/**
 * QuoteFormFields — Renders product-specific form fields from config.
 */

import React from 'react';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import type { QuoteFormField } from '../types';

interface QuoteFormFieldsProps {
  fields: QuoteFormField[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
}

export function QuoteFormFields({ fields, values, onChange }: QuoteFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {fields.map((field) => (
        <div key={field.id} className={`space-y-1.5 ${field.fullWidth ? 'sm:col-span-2' : ''}`}>
          <Label htmlFor={field.id} className="text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          {field.type === 'select' ? (
            <Select
              value={values[field.id] || ''}
              onValueChange={(value) => onChange(field.id, value)}
            >
              <SelectTrigger className="bg-white border-gray-300 h-11">
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={field.id}
              type={field.type === 'number' ? 'text' : field.type}
              inputMode={field.type === 'number' ? 'numeric' : undefined}
              placeholder={field.placeholder}
              value={values[field.id] || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              required={field.required}
              className="bg-white border-gray-300 h-11"
            />
          )}
        </div>
      ))}
    </div>
  );
}
