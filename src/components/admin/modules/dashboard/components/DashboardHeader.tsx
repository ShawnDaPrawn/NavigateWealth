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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{today}</p>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mt-1">
          {getGreeting()}
          {userName ? `, ${userName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here&apos;s what&apos;s happening across your practice.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAuditOpen(true)}
          className="gap-1.5 text-xs"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Audit Trail
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHealthOpen(true)}
          className="gap-1.5 text-xs"
        >
          <Server className="h-3.5 w-3.5" />
          System Health
        </Button>
      </div>

      <AuditLogViewer open={auditOpen} onOpenChange={setAuditOpen} />
      <SystemHealthDialog open={healthOpen} onOpenChange={setHealthOpen} />
    </div>
  );
}
