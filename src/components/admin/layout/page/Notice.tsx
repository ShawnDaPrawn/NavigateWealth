import type { ReactNode } from 'react';
import { cn } from '../../../ui/utils';

type NoticeKind = 'attention' | 'error' | 'neutral';

interface NoticeProps {
  kind?: NoticeKind;
  /** Bold lead phrase. */
  title: ReactNode;
  /** One sentence. */
  children?: ReactNode;
  /** One action link at most. */
  action?: ReactNode;
  className?: string;
}

const KIND: Record<NoticeKind, string> = {
  attention: 'border-amber-200 bg-nw-amber-100 text-nw-amber-700',
  error: 'border-red-200 bg-red-50 text-red-800',
  neutral: 'border-nw-line bg-white text-nw-text-2',
};

/** An in-page banner for something to know or do before continuing (design system: Notice). */
export function Notice({ kind = 'neutral', title, children, action, className }: NoticeProps) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm',
        KIND[kind],
        className,
      )}
    >
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{title}</span>
        {children ? <> {children}</> : null}
      </p>
      {action}
    </div>
  );
}

/**
 * The summary banner a form shows when submitted with problems:
 * "Fix 2 fields to add the client" (design system: Form errors).
 * Pass the number of fields with errors and what the button does.
 */
export function FormErrorBanner({ count, action }: { count: number; action: string }) {
  if (count <= 0) return null;
  return (
    <Notice kind="error" title={`Fix ${count} ${count === 1 ? 'field' : 'fields'} to ${action}.`} />
  );
}
