import { Skeleton } from '../../../../ui/skeleton';
import { DsStat } from '../../../layout/page';
import { formatKPIValue } from '../utils';
import type { KPICardProps } from '../types';

/** One "Practice at a glance" figure (DB-Main board: .stat). */
export function KPICard({
  title,
  value,
  change,
  format = 'number',
  subtitle,
  onClick,
  hideChange = false,
  valueSuffix,
  loading = false,
}: KPICardProps) {
  if (loading) {
    return (
      <div className="ds-stat" aria-busy="true">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="my-1 h-7 w-16" />
        <Skeleton className="h-3 w-32" />
      </div>
    );
  }

  const changeText = hideChange ? null : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
  const meta = [changeText, subtitle].filter(Boolean).join(' · ');

  return (
    <DsStat
      label={title}
      value={
        valueSuffix ? (
          <>
            {formatKPIValue(value, format)}{' '}
            <span className="ds-meta" style={{ fontSize: 14, fontWeight: 500 }}>
              {valueSuffix}
            </span>
          </>
        ) : (
          formatKPIValue(value, format)
        )
      }
      meta={meta || undefined}
      onClick={onClick}
    />
  );
}
