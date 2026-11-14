/**
 * Dashboard header: H1 "Dashboard" with the greeting and today's date as
 * its description. Audit trail opens a page of its own; System health opens
 * the KV maintenance dialog and shows its status on the button.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SystemHealthDialog } from './SystemHealthDialog';
import type { DashboardHeaderProps } from '../types';
import { DsButton, DsPill, PageHeader, type DsTone } from '../../../layout/page';
import { systemHealthApi } from '../api';
import { dashboardKeys } from '../hooks/queryKeys';
import { getGreeting, getHealthStatus, type HealthStatus } from '../utils';

const HEALTH_LABEL: Record<HealthStatus, string> = {
  ok: 'OK',
  overdue: 'Overdue',
  unknown: 'Not run',
};

const HEALTH_TONE: Record<HealthStatus, DsTone> = {
  ok: 'ok',
  overdue: 'warn',
  unknown: 'neutral',
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
            <DsButton onClick={onOpenAuditTrail}>Audit trail</DsButton>
            <DsButton onClick={() => setHealthOpen(true)}>
              System health
              {health && (
                <DsPill tone={HEALTH_TONE[health]} className="!h-5">
                  {HEALTH_LABEL[health]}
                </DsPill>
              )}
            </DsButton>
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
