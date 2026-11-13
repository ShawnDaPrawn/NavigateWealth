/**
 * Audit trail — a page of its own under the dashboard (design DB 2).
 *
 * Every admin action across the platform: search, category and severity
 * filters (both in the address), and Export CSV for compliance reporting.
 * The log is append-only on the server.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  ChevronLeft,
  ClipboardList,
  Loader2,
  Download,
  Search,
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
import { PageHeader, useUrlState } from '../../../layout/page';
import { adminAuditApi } from '../api';
import { auditEntriesToCsv } from '../utils';
import type { AdminAuditEntry, AuditActionCategory, AuditSeverity } from '../types';

// ── Config-Driven Display (§5.3) ─────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  AuditActionCategory,
  { icon: React.ElementType; label: string; color: string }
> = {
  client_lifecycle: { icon: Users, label: 'Client lifecycle', color: 'text-blue-600' },
  kv_cleanup: { icon: Trash2, label: 'KV cleanup', color: 'text-purple-600' },
  configuration: { icon: Settings, label: 'Configuration', color: 'text-gray-600' },
  bulk_operation: { icon: Package, label: 'Bulk operation', color: 'text-orange-600' },
  security: { icon: Shield, label: 'Security', color: 'text-red-600' },
  permissions: { icon: Shield, label: 'Permissions', color: 'text-indigo-600' },
  communication: { icon: Send, label: 'Communication', color: 'text-green-600' },
  system: { icon: Server, label: 'System', color: 'text-gray-500' },
};

const SEVERITY_CONFIG: Record<
  AuditSeverity,
  { badgeClass: string; icon: React.ElementType; label: string }
> = {
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
  'client_lifecycle',
  'kv_cleanup',
  'configuration',
  'bulk_operation',
  'security',
  'permissions',
  'communication',
  'system',
];

const ALL_SEVERITIES: AuditSeverity[] = ['info', 'warning', 'critical'];

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return (
    d.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) +
    ' ' +
    d.toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );
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

const CATEGORY_FILTERS = ['all', ...ALL_CATEGORIES] as const;
const SEVERITY_FILTERS = ['all', ...ALL_SEVERITIES] as const;

interface AuditTrailPageProps {
  /** Back to the dashboard. */
  onBack: () => void;
}

export function AuditTrailPage({ onBack }: AuditTrailPageProps) {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useUrlState<AuditActionCategory | 'all'>(
    'category',
    'all',
    CATEGORY_FILTERS,
  );
  const [severityFilter, setSeverityFilter] = useUrlState<AuditSeverity | 'all'>(
    'severity',
    'all',
    SEVERITY_FILTERS,
  );
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
    void fetchEntries();
  }, [fetchEntries]);

  // Client-side search filter
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.summary.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.entityType?.toLowerCase().includes(q) ||
        e.entityId?.toLowerCase().includes(q),
    );
  }, [entries, searchQuery]);

  const handleExportCSV = useCallback(() => {
    const csv = auditEntriesToCsv(filteredEntries);
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
    // Search is local; category and severity share one address change.
    setSearchQuery('');
    if (categoryFilter !== 'all') setCategoryFilter('all');
    else if (severityFilter !== 'all') setSeverityFilter('all');
  }, [categoryFilter, severityFilter, setCategoryFilter, setSeverityFilter]);

  const hasActiveFilters =
    categoryFilter !== 'all' || severityFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-6 lg:p-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </button>

      <PageHeader
        title="Audit trail"
        description="Every admin action across the platform. Append-only and kept for compliance."
        actions={
          <Button onClick={handleExportCSV} disabled={filteredEntries.length === 0}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <Search
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search actions, summaries, entities…"
            aria-label="Search the audit trail"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as AuditActionCategory | 'all')}
        >
          <SelectTrigger className="h-9 w-[180px] text-sm" aria-label="Category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {ALL_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_CONFIG[cat].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={severityFilter}
          onValueChange={(v) => setSeverityFilter(v as AuditSeverity | 'all')}
        >
          <SelectTrigger className="h-9 w-[150px] text-sm" aria-label="Severity">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {ALL_SEVERITIES.map((sev) => (
              <SelectItem key={sev} value={sev}>
                {SEVERITY_CONFIG[sev].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear filters
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void fetchEntries()}
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${filteredEntries.length} entries`}
          {hasActiveFilters &&
            entries.length !== filteredEntries.length &&
            ` (filtered from ${entries.length})`}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="overflow-auto rounded-xl border border-nw-line bg-white">
        {loading ? (
          <div
            className="flex items-center justify-center py-12 text-sm text-muted-foreground"
            aria-busy="true"
          >
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Loading audit entries…
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ClipboardList className="mb-2 h-8 w-8 opacity-40" aria-hidden="true" />
            <p className="text-sm font-medium">
              {hasActiveFilters ? 'No entries match your filters' : 'No audit entries yet'}
            </p>
            <p className="mt-1 text-xs">
              {hasActiveFilters
                ? 'Change the search, category or severity to see more.'
                : 'Admin actions will appear here as they occur.'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-[150px]">Category</TableHead>
                <TableHead className="w-[100px]">Severity</TableHead>
                <TableHead className="w-[110px]">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => {
                const catCfg = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.system;
                const sevCfg = SEVERITY_CONFIG[entry.severity] || SEVERITY_CONFIG.info;
                const CatIcon = catCfg.icon;

                return (
                  <TableRow key={entry.id}>
                    <TableCell
                      className="whitespace-nowrap text-xs text-muted-foreground"
                      title={formatTimestamp(entry.timestamp)}
                    >
                      {formatRelativeTimestamp(entry.timestamp)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm leading-snug">{entry.summary}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {entry.action}
                        {entry.entityType &&
                          ` · ${entry.entityType}${entry.entityId ? ` ${entry.entityId.substring(0, 8)}…` : ''}`}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <CatIcon className={`h-3.5 w-3.5 ${catCfg.color}`} aria-hidden="true" />
                        <span className="text-xs">{catCfg.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`px-1.5 py-0 text-[10px] leading-4 ${sevCfg.badgeClass}`}
                      >
                        {sevCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px] leading-4">
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
    </div>
  );
}
