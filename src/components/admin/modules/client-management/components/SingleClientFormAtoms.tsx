/**
 * Small presentational atoms of the single-client form: the card section
 * wrapper, the field label, and the inline field error.
 */
import { Label } from '../../../../ui/label';
import { AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

export function FormSection({
  icon: Icon,
  title,
  description,
  badge,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-[#6d28d9]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
            {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
          </div>
        </div>
        {badge}
      </div>
      <div className="px-5 pb-5 pt-1">{children}</div>
    </div>
  );
}

export function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
  );
}

/** Inline error message shown below a field — supports aria-describedby via id prop */
export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="flex items-center gap-1 mt-1 text-[11px] text-red-600 leading-tight"
    >
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}
