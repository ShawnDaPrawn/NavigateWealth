/** Small shared pieces of the Password Manager screens. */
import { useId, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { Label } from '../../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../../ui/radio-group';
import { cn } from '../../../ui/utils';
import { DsPill, type DsTone } from '../../layout/page';
import { aiUseLabels, type AiUse } from '../../../../shared/password-manager';

/** A labelled form field with an optional hint under the label and an error under the input. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-nw-ink">
        {label}
      </Label>
      {hint && <p className="-mt-1 text-[13px] text-nw-text-3">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-[13px] text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Copies a value without showing it. */
export function CopyButton({
  value,
  label,
}: {
  value: string | (() => Promise<string>);
  label: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={'Copy ' + label.toLowerCase()}
      onClick={async () => {
        try {
          const text = typeof value === 'string' ? value : await value();
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
          toast.success(label + ' copied');
        } catch {
          toast.error('Could not copy. Select the text and copy it instead.');
        }
      }}
    >
      {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      Copy
    </Button>
  );
}

/** A choice between a few options, each explained in a sentence. */
export function ChoiceList<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; help: string }[];
  label: string;
}) {
  const id = useId();
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className="grid gap-2"
    >
      {options.map((o) => (
        <label
          key={o.value}
          htmlFor={id + o.value}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors',
            value === o.value ? 'border-nw-violet bg-nw-violet-50' : 'border-nw-line bg-white',
          )}
        >
          <RadioGroupItem
            id={id + o.value}
            value={o.value}
            className="mt-0.5 border-nw-text-3 bg-white"
          />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium text-nw-ink">{o.label}</span>
            <span className="text-[13px] text-nw-text-3">{o.help}</span>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

const AI_TONE: Record<AiUse, DsTone> = { off: 'neutral', ask: 'warn', allowed: 'ok' };

export function AiUsePill({ value }: { value: AiUse }) {
  return <DsPill tone={AI_TONE[value]}>{aiUseLabels[value]}</DsPill>;
}

/** What a tab shows while its lists load. */
export function Loading({ what }: { what: string }) {
  return (
    <p role="status" className="py-12 text-center text-sm text-nw-text-3">
      Loading {what}…
    </p>
  );
}
