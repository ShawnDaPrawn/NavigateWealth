/**
 * Dashboard Header
 *
 * Page header for the admin dashboard: greeting + today's date on the
 * left, compact utility triggers on the right. The Audit Trail and
 * System Health tools live behind these triggers as modal dialogs
 * instead of occupying dashboard real estate.
 */

import { useState } from 'react';
import { Button } from '../../../../ui/button';
import { ClipboardList, Server } from 'lucide-react';
import { AuditLogViewer } from './AuditLogViewer';
import { SystemHealthDialog } from './SystemHealthDialog';
import type { DashboardHeaderProps } from '../types';
import { PageHeader } from '../../../layout/page';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHeader({ userName }: DashboardHeaderProps) {
  const [auditOpen, setAuditOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);

  const today = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <PageHeader
        title={`${getGreeting()}${userName ? `, ${userName}` : ''}`}
        description={`${today} · Here's what's happening across your practice.`}
        actions={
          <>
            <Button variant="outline" onClick={() => setAuditOpen(true)}>
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Audit trail
            </Button>
            <Button variant="outline" onClick={() => setHealthOpen(true)}>
              <Server className="h-4 w-4" aria-hidden="true" />
              System health
            </Button>
          </>
        }
      />

      <AuditLogViewer open={auditOpen} onOpenChange={setAuditOpen} />
      <SystemHealthDialog open={healthOpen} onOpenChange={setHealthOpen} />
    </>
  );
}
