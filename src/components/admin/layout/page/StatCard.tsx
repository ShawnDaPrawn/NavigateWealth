import type { ReactNode } from 'react';

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
    <div className="ds-stat">
      <span className="k">{label}</span>
      <span className="v">{value}</span>
      {meta && (
        <span className="m" style={tone === 'attention' ? { color: '#92400e' } : undefined}>
          {meta}
        </span>
      )}
    </div>
  );
}
