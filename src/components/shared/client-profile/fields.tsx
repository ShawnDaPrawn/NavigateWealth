/**
 * Small form building blocks shared by the profile sections in this folder.
 * The sections render in both the client portal and the admin profile viewer,
 * so nothing here knows which one it is in.
 */
import type { ComponentType, ReactNode } from 'react';
import { CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';

export function SectionHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <CardHeader>
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-[#6d28d9]" />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {actions}
      </div>
    </CardHeader>
  );
}

export function SubHeading({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-900">{children}</h4>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/** A required yes/no question; '' is "not answered yet". */
export function YesNoQuestion({
  id,
  question,
  hint,
  value,
  onChange,
}: {
  id: string;
  question: string;
  hint?: string;
  value: '' | 'yes' | 'no';
  onChange: (value: 'yes' | 'no') => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm text-gray-900">
          {question}
        </p>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </div>
      <RadioGroup
        aria-labelledby={`${id}-label`}
        value={value}
        onValueChange={(v) => onChange(v as 'yes' | 'no')}
        className="flex shrink-0 gap-4"
      >
        {(['yes', 'no'] as const).map((option) => (
          <div key={option} className="flex items-center gap-2">
            <RadioGroupItem id={`${id}-${option}`} value={option} />
            <Label htmlFor={`${id}-${option}`} className="cursor-pointer font-normal">
              {option === 'yes' ? 'Yes' : 'No'}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

/** Tick any number of options. */
export function CheckboxGroup({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const checked = value.includes(option.value);
        const optionId = `${id}-${option.value}`;
        return (
          <div key={option.value} className="flex items-center gap-2">
            <Checkbox
              id={optionId}
              checked={checked}
              onCheckedChange={(next) =>
                onChange(
                  next === true
                    ? [...value, option.value]
                    : value.filter((v) => v !== option.value),
                )
              }
            />
            <Label htmlFor={optionId} className="cursor-pointer font-normal">
              {option.label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
