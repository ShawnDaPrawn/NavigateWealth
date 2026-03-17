/**
 * Reusable Form Field Component
 * Provides consistent form field styling with validation display
 */

import React from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { AlertCircle } from 'lucide-react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children?: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  error,
  hint,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChange,
  required = false,
  error,
  hint,
  disabled = false,
  ...props
}) => {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={error ? 'border-red-500' : ''}
        {...props}
      />
    </FormField>
  );
};

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  rows?: number;
}

export const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label,
  value,
  onChange,
  required = false,
  error,
  hint,
  disabled = false,
  rows = 3,
}) => {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        className={error ? 'border-red-500' : ''}
      />
    </FormField>
  );
};
