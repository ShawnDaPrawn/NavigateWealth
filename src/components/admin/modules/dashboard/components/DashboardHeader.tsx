/**
 * Dashboard header: H1 "Dashboard" with the greeting and today's date as
 * its description. Audit trail opens a page of its own; System health opens
 * the KV maintenance dialog and shows its status on the button.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Server } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { cn } from '../../../../ui/utils';
import { SystemHealthDialog } from './SystemHealthDialog';
import type { DashboardHeaderProps } from '../types';
import { PageHeader } from '../../../layout/page';
import { systemHealthApi } from '../api';
import { dashboardKeys } from '../hooks/queryKeys';
import { getGreeting, getHealthStatus, type HealthStatus } from '../utils';

const HEALTH_LABEL: Record<HealthStatus, string> = {
  ok: 'OK',
  overdue: 'Overdue',
  unknown: 'Not run',
};

const HEALTH_CLASS: Record<HealthStatus, string> = {
  ok: 'bg-green-50 text-green-700',
  overdue: 'bg-amber-50 text-amber-800',
  unknown: 'bg-nw-bg text-nw-text-2',
};

export function DashboardHeader({ userName, onOpenAuditTrail }: DashboardHeaderProps) {
  const [healthOpen, setHealthOpen] = useState(false);

  const { data: lastRun, refetch: refetchHealth } = useQuery({
    queryKey: [...dashboardKeys.all, 'system-health'] as const,
    queryFn: () => systemHealthApi.getLastCleanupRun(),
    staleTime: 5 * 60 * 1000,
  });
  const health = lastRun === undefined ? null : getHealthStatus(lastRun);

  const today = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${getGreeting()}${userName ? `, ${userName}` : ''} · ${today}`}
        actions={
          <>
            <Button variant="outline" onClick={onOpenAuditTrail}>
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Audit trail
            </Button>
            <Button variant="outline" onClick={() => setHealthOpen(true)}>
              <Server className="h-4 w-4" aria-hidden="true" />
              System health
              {health && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                    HEALTH_CLASS[health],
                  )}
                >
                  {HEALTH_LABEL[health]}
                </span>
              )}
            </Button>
          </>
        }
      />

      <SystemHealthDialog
        open={healthOpen}
        onOpenChange={(open) => {
          setHealthOpen(open);
          // A cleanup run in the dialog changes the status on the button.
          if (!open) void refetchHealth();
        }}
      />
    </>
  );
}
