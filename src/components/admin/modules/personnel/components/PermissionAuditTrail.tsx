/**
 * PermissionAuditTrail — Displays a chronological history of permission
 * changes for a specific personnel member.
 *
 * Shown at the bottom of the Permissions tab in the PersonnelDrawer.
 *
 * @module personnel/components/PermissionAuditTrail
 */

import React from 'react';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import {
  ShieldPlus,
  ShieldMinus,
  KeyRound,
  Clock,
  History,
} from 'lucide-react';
import { usePermissionAudit } from '../hooks';
import { formatDistanceToNow } from 'date-fns';

interface PermissionAuditTrailProps {
  personnelId: string;
  enabled?: boolean;
}

interface AuditChange {
  module: string;
  type: 'access_granted' | 'access_revoked' | 'capability_added' | 'capability_removed';
  capability?: string;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  targetPersonnelId: string;
  changedByPersonnelId: string;
  action: string;
  changes: AuditChange[];
}

const CHANGE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  access_granted: {
    icon: ShieldPlus,
    label: 'Access granted',
    color: 'text-green-600 bg-green-50',
  },
  access_revoked: {
    icon: ShieldMinus,
    label: 'Access revoked',
    color: 'text-red-600 bg-red-50',
  },
  capability_added: {
    icon: KeyRound,
    label: 'Capability added',
    color: 'text-blue-600 bg-blue-50',
  },
  capability_removed: {
    icon: KeyRound,
    label: 'Capability removed',
    color: 'text-orange-600 bg-orange-50',
  },
};

export function PermissionAuditTrail({
  personnelId,
  enabled = true,
}: PermissionAuditTrailProps) {
  const { data: entries = [], isLoading } = usePermissionAudit(personnelId, enabled);

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <History className="h-4 w-4" />
            Permission History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 bg-muted/50 rounded animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <History className="h-4 w-4" />
            Permission History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-4">
            No permission changes have been recorded yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <History className="h-4 w-4" />
          Permission History
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 ml-auto">
            {entries.length} change{entries.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 pt-0">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gray-200" />

          {(entries as AuditEntry[]).map((entry, idx) => {
            const timeAgo = formatDistanceToNow(new Date(entry.timestamp), {
              addSuffix: true,
            });

            return (
              <div key={entry.id || idx} className="relative pl-8 pb-4 last:pb-0">
                {/* Timeline dot */}
                <div className="absolute left-1.5 top-1 w-[13px] h-[13px] rounded-full bg-white border-2 border-purple-300 z-10" />

                {/* Entry */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {timeAgo}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      by {entry.changedByPersonnelId.slice(0, 8)}...
                    </span>
                  </div>

                  {/* Changes */}
                  <div className="flex flex-wrap gap-1">
                    {entry.changes.map((change, cIdx) => {
                      const config = CHANGE_CONFIG[change.type] || CHANGE_CONFIG.access_granted;
                      const Icon = config.icon;

                      return (
                        <Badge
                          key={cIdx}
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 h-4 gap-0.5 ${config.color} border-0`}
                        >
                          <Icon className="h-2.5 w-2.5" />
                          <span className="font-medium">{change.module}</span>
                          {change.capability && (
                            <span className="opacity-70">· {change.capability}</span>
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
