import { Users } from 'lucide-react';
import { DsStats } from '../../../layout/page';
import { KPICard } from './KPICard';
import type { KPIGridProps } from '../types';

/** The row of four figures (DB-Main board: .stats). */
export function KPIGrid({ kpis, loading = false, columns = 4 }: KPIGridProps) {
  if (loading && (!kpis || kpis.length === 0)) {
    return (
      <DsStats>
        {Array.from({ length: columns }).map((_, i) => (
          <KPICard
            key={`skeleton-${i}`}
            title=""
            value={0}
            change={0}
            icon={Users}
            loading={true}
          />
        ))}
      </DsStats>
    );
  }

  if (!kpis || kpis.length === 0) {
    return null;
  }

  return (
    <DsStats>
      {kpis.map((kpi, index) => (
        <KPICard key={kpi.title || index} {...kpi} loading={kpi.loading || false} />
      ))}
    </DsStats>
  );
}
