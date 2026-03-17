/**
 * Audit Log Widget
 *
 * Dashboard widget showing the most recent admin actions from the
 * admin audit trail. Provides quick visibility into who did what
 * across the platform — a compliance requirement (Guidelines §12.2).
 *
 * Follows the stat card standards from Guidelines §8.3.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import {
  ClipboardList,
  Loader2,
  Shield,
  Users,
  Trash2,
  Settings,
  Send,
  Server,
  Package,
  AlertTriangle,
  Info,
  AlertOctagon,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { adminAuditApi } from '../api';
import { AuditLogViewer } from './AuditLogViewer';
import type { AdminAuditEntry, AuditActionCategory, AuditSeverity, AuditLogWidgetProps } from '../types';

/** Category → icon + label mapping (config-driven, §5.3). */
const CATEGORY_CONFIG: Record<AuditActionCategory, { icon: React.ElementType; label: string; color: string }> = {
  client_lifecycle: { icon: Users, label: 'Client', color: 'text-blue-600' },
  kv_cleanup: { icon: Trash2, label: 'Cleanup', color: 'text-purple-600' },
  configuration: { icon: Settings, label: 'Config', color: 'text-gray-600' },
  bulk_operation: { icon: Package, label: 'Bulk', color: 'text-orange-600' },
  security: { icon: Shield, label: 'Security', color: 'text-red-600' },
  permissions: { icon: Shield, label: 'Permissions', color: 'text-indigo-600' },
  communication: { icon: Send, label: 'Comms', color: 'text-green-600' },
  system: { icon: Server, label: 'System', color: 'text-gray-500' },
};

/** Severity → badge styling (§8.3 status indicator table). */
const SEVERITY_CONFIG: Record<AuditSeverity, { badgeClass: string; icon: React.ElementType }> = {
  info: {
    badgeClass: 'text-blue-700 border-blue-300 bg-blue-50',
    icon: Info,
  },
  warning: {
    badgeClass: 'text-amber-700 border-amber-300 bg-amber-50',
    icon: AlertTriangle,
  },
  critical: {
    badgeClass: 'text-red-700 border-red-300 bg-red-50',
    icon: AlertOctagon,
  },
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  // Same year — omit year
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
      + ' ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }

  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AuditLogWidget({ maxEntries = 8 }: AuditLogWidgetProps) {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [summary, setSummary] = useState<Record<AuditActionCategory, number> | null>(null);
  const [summaryDays, setSummaryDays] = useState(7);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const [data, summaryData] = await Promise.all([
      adminAuditApi.getLog({ limit: maxEntries }),
      adminAuditApi.getSummary(summaryDays),
    ]);
    setEntries(data);
    if (summaryData) {
      setSummary(summaryData.summary);
    }
    setLoading(false);
  }, [maxEntries, summaryDays]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const totalActions = summary ? Object.values(summary).reduce((a, b) => a + b, 0) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="contents">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Audit Trail
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchEntries}
              disabled={loading}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewerOpen(true)}
              className="text-xs"
            >
              View All
            </Button>
          </div>
        </div>
        <CardDescription>
          Recent admin actions across the platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats Row */}
        {summary && totalActions > 0 && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Last {summaryDays} days — {totalActions} action{totalActions !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {(Object.entries(CATEGORY_CONFIG) as [AuditActionCategory, typeof CATEGORY_CONFIG[AuditActionCategory]][])
                .filter(([cat]) => (summary[cat] || 0) > 0)
                .sort(([a], [b]) => (summary[b] || 0) - (summary[a] || 0))
                .map(([cat, cfg]) => {
                  const CIcon = cfg.icon;
                  return (
                    <div key={cat} className="flex items-center gap-1.5 text-xs">
                      <CIcon className={`h-3 w-3 ${cfg.color}`} />
                      <span className="font-medium">{summary[cat]}</span>
                      <span className="text-muted-foreground">{cfg.label}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading audit trail...
          </div>
        ) : entries.length === 0 ? (
          <div className="py-6 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No audit entries recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Admin actions will appear here as they occur.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {entries.map((entry) => {
              const catCfg = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.system;
              const sevCfg = SEVERITY_CONFIG[entry.severity] || SEVERITY_CONFIG.info;
              const CatIcon = catCfg.icon;

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className={`mt-0.5 ${catCfg.color}`}>
                    <CatIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug truncate">{entry.summary}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 leading-4 ${sevCfg.badgeClass}`}
                      >
                        {entry.severity}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 leading-4 text-gray-600 border-gray-300 bg-gray-50"
                      >
                        {catCfg.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Full audit log viewer dialog */}
      <AuditLogViewer open={viewerOpen} onOpenChange={setViewerOpen} />
    </Card>
  );
}