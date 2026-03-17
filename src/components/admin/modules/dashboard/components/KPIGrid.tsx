import React from 'react';
import { KPICard } from './KPICard';
import { Users } from 'lucide-react';
import type { KPIGridProps } from '../types';

export function KPIGrid({ kpis, loading = false, columns = 4 }: KPIGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  if (loading && (!kpis || kpis.length === 0)) {
    // Render skeleton cards while loading (all data sources pending)
    return (
      <div className={`grid gap-4 ${gridCols[columns]}`}>
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
      </div>
    );
  }

  if (!kpis || kpis.length === 0) {
    return null;
  }

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      {kpis.map((kpi, index) => (
        <KPICard
          key={kpi.title || index}
          {...kpi}
          loading={kpi.loading || false}
        />
      ))}
    </div>
  );
}