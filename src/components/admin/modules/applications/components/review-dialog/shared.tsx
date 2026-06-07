import React from 'react';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../../ui/tooltip';
import { Link2 } from 'lucide-react';
import { SYNCED_FIELDS, APPLICATION_PROFILE_FIELD_MAP } from '../../constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'];
export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Life Partner'];
export const MARITAL_REGIMES = [
  'In Community of Property',
  'Out of Community of Property (with accrual)',
  'Out of Community of Property (without accrual)',
];
export const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];
export const EMPLOYMENT_STATUSES = [
  { value: 'employed', label: 'Employed' },
  { value: 'self-employed', label: 'Self-Employed' },
  { value: 'contract', label: 'Contract Worker' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'retired', label: 'Retired' },
  { value: 'student', label: 'Student' },
];

// ---------------------------------------------------------------------------
// Shared prop type for section sub-components
// ---------------------------------------------------------------------------
export interface SectionProps {
  isEditing: boolean;
  fv: (field: string) => string;
  updateField: (field: string, value: string | number | boolean | string[]) => void;
  amendedFields: Set<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

export function ReviewSection({
  icon: Icon,
  title,
  children,
  badge,
  actions,
  className,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white overflow-hidden ${className || ''}`}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/40">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-[#6d28d9]" />
          </div>
          <span className="text-[13px] font-semibold text-gray-900">{title}</span>
          {badge}
        </div>
        {actions}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export function SyncIndicator({ field }: { field: string }) {
  if (!SYNCED_FIELDS.has(field)) return null;

  const mapping = APPLICATION_PROFILE_FIELD_MAP.find((m) => m.applicationField === field);
  if (!mapping) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-blue-600 bg-blue-50 border border-blue-200/60 rounded px-1 py-px ml-1 normal-case tracking-normal cursor-help">
            <Link2 className="h-2.5 w-2.5" />
            Sync
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px]">
          <p className="font-medium">Syncs to Client Profile</p>
          <p className="text-gray-400 mt-0.5">
            Maps to: <span className="font-mono text-[10px]">{mapping.profileField}</span>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ViewField({
  label,
  value,
  icon: Icon,
  className,
  amended,
  syncField,
}: {
  label: string;
  value: string | undefined | null;
  icon?: React.ElementType;
  className?: string;
  amended?: boolean;
  syncField?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1 mb-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
        {amended && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-px ml-0.5 normal-case tracking-normal">
            Amended
          </span>
        )}
        {syncField && <SyncIndicator field={syncField} />}
      </Label>
      <div
        className={`text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-300 italic font-normal'}`}
      >
        {value || 'Not provided'}
      </div>
    </div>
  );
}

export function EditField({
  label,
  value,
  onChange,
  placeholder,
  type,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ElementType;
}) {
  return (
    <div>
      <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      <Input
        type={type || 'text'}
        className="h-8 text-sm bg-gray-50/60 border-gray-200 focus:bg-white transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function EditSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[] | string[];
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const normalised =
    typeof options[0] === 'string'
      ? (options as string[]).map((o) => ({ value: o, label: o }))
      : (options as { value: string; label: string }[]);

  return (
    <div>
      <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm bg-gray-50/60 border-gray-200 focus:bg-white transition-colors">
          <SelectValue placeholder={placeholder || 'Select'} />
        </SelectTrigger>
        <SelectContent>
          {normalised.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ClientAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  return (
    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#6d28d9] to-purple-400 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
      {initials || '??'}
    </div>
  );
}
