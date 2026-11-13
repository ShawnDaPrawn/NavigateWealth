import type { ReactNode } from 'react';
import { cn } from '../../../ui/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** A few words under the number. */
  meta?: ReactNode;
  /** Colours the meta line when the number needs attention. */
  tone?: 'default' | 'attention';
}

/** One figure in the row of cards under a page header (design system: StatCard). */
export function StatCard({ label, value, meta, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-nw-line bg-white px-4 py-4">
      <p className="text-[13px] text-nw-text-2">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-nw-ink">{value}</p>
      {meta && (
        <p
          className={cn(
            'mt-1 text-xs',
            tone === 'attention' ? 'text-nw-amber-700' : 'text-nw-text-3',
          )}
        >
          {meta}
        </p>
      )}
    </div>
  );
}
