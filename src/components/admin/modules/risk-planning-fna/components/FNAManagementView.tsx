/**
 * FNA Management View — the FNA list on a policy category tab, used by every
 * FNA type (it lives here for historical reasons).
 *
 * Shows every FNA of one type for the client, newest first, with "Run new FNA"
 * and "View". The rows come from the type's own API through the FNA registry
 * (`loadFNAs`), never from a hand-built URL. `highlightFnaId` marks the FNA
 * that was just published, which is where the wizard lands the adviser.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Eye, Calendar, Loader2, ChevronLeft, Zap } from 'lucide-react';
import { StatCard } from '../../../layout/page';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { toast } from 'sonner';
import { cn } from '../../../../ui/utils';

interface FNASummary {
  id: string;
  status: 'draft' | 'published' | 'archived';
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  version?: string | number;
  createdBy?: string;
}

interface FNAManagementViewProps {
  clientName: string;
  /** The FNAs of this type for the client (FNAConfig.listForClient). */
  loadFNAs: () => Promise<Record<string, unknown>[]>;
  onCreateNew: () => void;
  onViewFNA: (fnaId: string) => void;
  onClose: () => void;
  title: string;
  /** e.g. "Retirement FNA" — used in the empty state. */
  fnaName: string;
  /** The FNA just published: highlighted and scrolled into view. */
  highlightFnaId?: string;
}

function toTime(value?: string): number {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
}

export function FNAManagementView({
  clientName,
  loadFNAs: fetchFNAs,
  onCreateNew,
  onViewFNA,
  onClose,
  title,
  fnaName,
  highlightFnaId,
}: FNAManagementViewProps) {
  const [fnas, setFnas] = useState<FNASummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const highlightedRow = useRef<HTMLTableRowElement | null>(null);
  // Loads once per mount (the caller remounts the view to refresh it), so an
  // inline `loadFNAs` from the caller never re-triggers the fetch.
  const fetchRef = useRef(fetchFNAs);
  fetchRef.current = fetchFNAs;

  const loadFNAs = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const fnaList = ((await fetchRef.current()) ?? []) as unknown as FNASummary[];
      setFnas(
        [...fnaList].sort(
          (a, b) => toTime(b.updatedAt ?? b.createdAt) - toTime(a.updatedAt ?? a.createdAt),
        ),
      );
    } catch (err) {
      console.error('Error loading FNAs:', err);
      toast.error(
        `Failed to load FNAs: ${err instanceof Error ? err.message : 'Unknown error occurred'}`,
      );
      setFnas([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFNAs();
  }, [loadFNAs]);

  useEffect(() => {
    if (!isLoading && highlightedRow.current) {
      highlightedRow.current.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }
  }, [isLoading, highlightFnaId]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      published: { label: 'Published', variant: 'default' },
      draft: { label: 'Draft', variant: 'secondary' },
      archived: { label: 'Archived', variant: 'outline' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString || !toTime(dateString)) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <button
        type="button"
        onClick={onClose}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to policies
      </button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-nw-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-nw-text-3">
            Every {fnaName} run for {clientName || 'this client'}.
          </p>
        </div>
        <Button onClick={onCreateNew}>
          <Zap className="h-4 w-4" aria-hidden="true" />
          Run new FNA
        </Button>
      </div>

      {/* Summary Stats */}
      {!isLoading && fnas.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total FNAs" value={fnas.length} />
          <StatCard label="Published" value={fnas.filter((f) => f.status === 'published').length} />
          <StatCard label="Drafts" value={fnas.filter((f) => f.status === 'draft').length} />
        </div>
      )}

      {/* Content */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" />
            </div>
          ) : fnas.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No FNAs yet</h3>
              <p className="text-sm text-gray-600 mb-6">
                Get started by running your first {fnaName} for this client.
              </p>
              <Button onClick={onCreateNew}>
                <Zap className="mr-2 h-4 w-4" />
                Run new FNA
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fnas.map((fna) => {
                  const isNew = fna.id === highlightFnaId;
                  return (
                    <TableRow
                      key={fna.id}
                      ref={isNew ? highlightedRow : undefined}
                      data-highlighted={isNew || undefined}
                      className={cn(isNew && 'bg-purple-50 hover:bg-purple-50')}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#6d28d9]" />
                          {fna.version ?? '—'}
                          {isNew && <Badge variant="outline">New</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(fna.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(fna.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(fna.updatedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {fna.publishedAt ? (
                          <div className="text-sm text-muted-foreground">
                            {formatDate(fna.publishedAt)}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">{fna.createdBy || '—'}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => onViewFNA(fna.id)}>
                            <Eye className="h-4 w-4 mr-1.5" />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
