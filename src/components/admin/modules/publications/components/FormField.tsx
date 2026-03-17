/**
 * Publications Feature - Form Field Components
 * 
 * Reusable form field components with consistent styling, validation,
 * and full accessibility support (ARIA labels, keyboard navigation).
 * 
 * @example
 * ```tsx
 * <TextField
 *   label="Article Title"
 *   name="title"
 *   value={title}
 *   onChange={setTitle}
 *   required
 *   error={errors.title}
 * />
 * ```
 */

import React from 'react';
import { Label } from '../../../../ui/label';
import { Input } from '../../../../ui/input';
import { Textarea } from '../../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Checkbox } from '../../../../ui/checkbox';
import { Minus, Plus } from 'lucide-react';

// ==================== Base FormField Container ====================

interface FormFieldProps {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Base FormField wrapper component
 */
function FormField({
  label,
  name,
  required = false,
  error,
  helpText,
  className,
  children
}: FormFieldProps) {
  return (
    <div className={className}>
      <Label htmlFor={name} className="block mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {helpText && !error && (
        <p className="text-sm text-gray-500 mt-1">{helpText}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

// ==================== TextField ====================

export interface TextFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'url' | 'password' | 'number';
  placeholder?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
}

/**
 * TextField Component
 */
export function TextField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  error,
  helpText,
  disabled = false,
  className,
  maxLength
}: TextFieldProps) {
  return (
    <FormField
      label={label}
      name={name}
      required={required}
      error={error}
      helpText={helpText}
      className={className}
    >
      <Input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className={error ? 'border-red-300 focus-visible:ring-red-500' : ''}
      />
    </FormField>
  );
}

// ==================== NumberStepperField ====================

export interface NumberStepperFieldProps {
  label: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  error?: string;
  helpText?: string;
  disabled?: boolean;
  className?: string;
  suffix?: string;
}

/**
 * NumberStepperField Component
 * Displays a numeric value with explicit increment/decrement buttons.
 */
export function NumberStepperField({
  label,
  name,
  value,
  onChange,
  min = 1,
  max = 999,
  step = 1,
  required = false,
  error,
  helpText,
  disabled = false,
  className,
  suffix,
}: NumberStepperFieldProps) {
  const handleDecrement = () => {
    const next = value - step;
    if (next >= min) onChange(next);
  };
  const handleIncrement = () => {
    const next = value + step;
    if (next <= max) onChange(next);
  };

  return (
    <FormField
      label={label}
      name={name}
      required={required}
      error={error}
      helpText={helpText}
      className={className}
    >
      <div className="flex items-center gap-0">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label}`}
          className="inline-flex items-center justify-center h-9 w-9 rounded-l-md border border-r-0 border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:z-10"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div
          className={`inline-flex items-center justify-center h-9 min-w-[3.5rem] px-3 border-y border-gray-200 bg-white text-sm font-medium text-gray-900 select-none tabular-nums ${
            error ? 'border-red-300' : ''
          }`}
        >
          {value}{suffix ? ` ${suffix}` : ''}
        </div>
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label}`}
          className="inline-flex items-center justify-center h-9 w-9 rounded-r-md border border-l-0 border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:z-10"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </FormField>
  );
}

// ==================== TextareaField ====================

export interface TextareaFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
  maxLength?: number;
}

/**
 * TextareaField Component
 */
export function TextareaField({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  helpText,
  disabled = false,
  className,
  rows = 3,
  maxLength
}: TextareaFieldProps) {
  return (
    <FormField
      label={label}
      name={name}
      required={required}
      error={error}
      helpText={helpText}
      className={className}
    >
      <Textarea
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        className={error ? 'border-red-300 focus-visible:ring-red-500' : ''}
      />
    </FormField>
  );
}

// ==================== SelectField ====================

export interface SelectFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * SelectField Component
 */
export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  required = false,
  error,
  helpText,
  disabled = false,
  className
}: SelectFieldProps) {
  return (
    <FormField
      label={label}
      name={name}
      required={required}
      error={error}
      helpText={helpText}
      className={className}
    >
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={error ? 'border-red-300 focus:ring-red-500' : ''}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.filter((option) => option.value !== '').map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

// ==================== CheckboxField ====================

export interface CheckboxFieldProps {
  label: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * CheckboxField Component
 */
export function CheckboxField({
  label,
  name,
  checked,
  onChange,
  description,
  error,
  disabled = false,
  className
}: CheckboxFieldProps) {
  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={name}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          className={error ? 'border-red-300' : ''}
        />
        <div className="flex-1">
          <Label 
            htmlFor={name} 
            className="cursor-pointer font-medium"
          >
            {label}
          </Label>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
          {error && (
            <p className="text-sm text-red-600 mt-1">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== DateTimeField ====================

export interface DateTimeFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  helpText?: string;
  description?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
}

/**
 * DateTimeField Component
 */
export function DateTimeField({
  label,
  name,
  value,
  onChange,
  required = false,
  error,
  helpText,
  description,
  disabled = false,
  min,
  max,
  className
}: DateTimeFieldProps) {
  return (
    <FormField
      label={label}
      name={name}
      required={required}
      error={error}
      helpText={description || helpText}
      className={className}
    >
      <input
        id={name}
        name={name}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
          error
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-200 focus:ring-purple-500 focus:border-purple-500'
        } disabled:bg-gray-50 disabled:cursor-not-allowed`}
      />
    </FormField>
  );
}

// ==================== ErrorList ====================

export interface ErrorListProps {
  errors: string[];
  className?: string;
}

/**
 * ErrorList Component
 * Displays a list of validation errors
 */
export function ErrorList({ errors, className }: ErrorListProps) {
  if (!errors || errors.length === 0) return null;

  return (
    <div className={`rounded-lg bg-red-50 border border-red-200 p-4 ${className || ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800 mb-2">
            {errors.length === 1 ? 'Error' : `${errors.length} Errors`}
          </h3>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-sm text-red-700">
                {error}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ==================== VALIDATION RULES ====================

/**
 * Common validation rules for articles
 */
export const VALIDATION_RULES = {
  title: {
    minLength: 3,
    maxLength: 200,
    required: true,
  },
  subtitle: {
    maxLength: 300,
    required: false,
  },
  slug: {
    minLength: 3,
    maxLength: 200,
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    required: true,
  },
  excerpt: {
    minLength: 10,
    maxLength: 500,
    required: true,
  },
  content: {
    minLength: 50,
    required: false,
  },
  meta_description: {
    maxLength: 160,
    required: false,
  },
  readingTime: {
    min: 1,
    max: 180,
    required: false,
  },
} as const;