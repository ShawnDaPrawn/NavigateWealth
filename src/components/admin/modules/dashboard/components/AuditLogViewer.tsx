/**
 * Audit Log Viewer (Full-Page Dialog)
 *
 * A comprehensive audit log viewer accessible from the dashboard's
 * AuditLogWidget "View All" button. Provides:
 * - Category and severity filters
 * - Searchable entries
 * - CSV export for compliance reporting
 * - Paginated results with "Load More"
 *
 * Follows Guidelines §8.3 (data presentation, table patterns)
 * and §12.2 (audit trails for sensitive actions).
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../../ui/dialog';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  ClipboardList,
  Loader2,
  Download,
  Search,
  Filter,
  RefreshCw,
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
  X,
} from 'lucide-react';
import { adminAuditApi } from '../api';
import type { AdminAuditEntry, AuditActionCategory, AuditSeverity } from '../types';

// ── Config-Driven Display (§5.3) ─────────────────────────────────────────

const CATEGORY_CONFIG: Record<AuditActionCategory, { icon: React.ElementType; label: string; color: string }> = {
  client_lifecycle: { icon: Users, label: 'Client Lifecycle', color: 'text-blue-600' },
  kv_cleanup: { icon: Trash2, label: 'KV Cleanup', color: 'text-purple-600' },
  configuration: { icon: Settings, label: 'Configuration', color: 'text-gray-600' },
  bulk_operation: { icon: Package, label: 'Bulk Operation', color: 'text-orange-600' },
  security: { icon: Shield, label: 'Security', color: 'text-red-600' },
  permissions: { icon: Shield, label: 'Permissions', color: 'text-indigo-600' },
  communication: { icon: Send, label: 'Communication', color: 'text-green-600' },
  system: { icon: Server, label: 'System', color: 'text-gray-500' },
};

const SEVERITY_CONFIG: Record<AuditSeverity, { badgeClass: string; icon: React.ElementType; label: string }> = {
  info: {
    badgeClass: 'text-blue-700 border-blue-300 bg-blue-50',
    icon: Info,
    label: 'Info',
  },
  warning: {
    badgeClass: 'text-amber-700 border-amber-300 bg-amber-50',
    icon: AlertTriangle,
    label: 'Warning',
  },
  critical: {
    badgeClass: 'text-red-700 border-red-300 bg-red-50',
    icon: AlertOctagon,
    label: 'Critical',
  },
};

const ALL_CATEGORIES: AuditActionCategory[] = [
  'client_lifecycle', 'kv_cleanup', 'configuration', 'bulk_operation',
  'security', 'permissions', 'communication', 'system',
];

const ALL_SEVERITIES: AuditSeverity[] = ['info', 'warning', 'critical'];

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTimestamp(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatTimestamp(ts);
}

interface AuditLogViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogViewer({ open, onOpenChange }: AuditLogViewerProps) {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<AuditActionCategory | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const filters: { category?: AuditActionCategory; severity?: AuditSeverity; limit?: number } = {
      limit: 200,
    };
    if (categoryFilter !== 'all') filters.category = categoryFilter;
    if (severityFilter !== 'all') filters.severity = severityFilter;

    const data = await adminAuditApi.getLog(filters);
    setEntries(data);
    setLoading(false);
  }, [categoryFilter, severityFilter]);

  useEffect(() => {
    if (open) {
      fetchEntries();
    }
  }, [open, fetchEntries]);

  // Client-side search filter
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.summary.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.entityType?.toLowerCase().includes(q) ||
        e.entityId?.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  // CSV export for compliance reporting
  const handleExportCSV = useCallback(() => {
    const headers = ['Timestamp', 'Category', 'Severity', 'Action', 'Summary', 'Entity Type', 'Entity ID', 'Actor Role'];
    const rows = filteredEntries.map((e) => [
      e.timestamp,
      e.category,
      e.severity,
      e.action,
      `"${e.summary.replace(/"/g, '""')}"`,
      e.entityType || '',
      e.entityId || '',
      e.actorRole,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit-log-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredEntries]);

  const clearFilters = useCallback(() => {
    setCategoryFilter('all');
    setSeverityFilter('all');
    setSearchQuery('');
  }, []);

  const hasActiveFilters = categoryFilter !== 'all' || severityFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ClipboardList className="h-5 w-5 text-primary" />
            Admin Audit Log
          </DialogTitle>
          <DialogDescription>
            Complete audit trail of admin actions across the platform. All entries are append-only and retained for compliance.
          </DialogDescription>
        </DialogHeader>

        {/* ── Filters ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 py-3 border-b">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search actions, summaries, entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Category filter */}
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as AuditActionCategory | 'all')}
          >
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {ALL_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_CONFIG[cat].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Severity filter */}
          <Select
            value={severityFilter}
            onValueChange={(v) => setSeverityFilter(v as AuditSeverity | 'all')}
          >
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              {ALL_SEVERITIES.map((sev) => (
                <SelectItem key={sev} value={sev}>
                  {SEVERITY_CONFIG[sev].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear / Refresh / Export */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={fetchEntries} disabled={loading} className="text-xs gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredEntries.length === 0}
            className="text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>

        {/* ── Results Count ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-xs text-muted-foreground py-1">
          <span>
            {loading ? 'Loading...' : `${filteredEntries.length} entries`}
            {hasActiveFilters && entries.length !== filteredEntries.length && ` (filtered from ${entries.length})`}
          </span>
        </div>

        {/* ── Table ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto min-h-0 rounded-lg border">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading audit entries...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm font-medium">No audit entries found</p>
              <p className="text-xs mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters.'
                  : 'Admin actions will appear here as they occur.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Timestamp</TableHead>
                  <TableHead className="w-[130px]">Category</TableHead>
                  <TableHead className="w-[90px]">Severity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-[100px]">Entity</TableHead>
                  <TableHead className="w-[90px]">Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => {
                  const catCfg = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.system;
                  const sevCfg = SEVERITY_CONFIG[entry.severity] || SEVERITY_CONFIG.info;
                  const CatIcon = catCfg.icon;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={formatTimestamp(entry.timestamp)}>
                        {formatRelativeTimestamp(entry.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <CatIcon className={`h-3.5 w-3.5 ${catCfg.color}`} />
                          <span className="text-xs">{catCfg.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 leading-4 ${sevCfg.badgeClass}`}
                        >
                          {entry.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm leading-snug">{entry.summary}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{entry.action}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.entityType && (
                          <div className="contents">
                            <span className="text-muted-foreground">{entry.entityType}</span>
                            {entry.entityId && (
                              <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[80px]" title={entry.entityId}>
                                {entry.entityId.substring(0, 8)}...
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-4">
                          {entry.actorRole}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
