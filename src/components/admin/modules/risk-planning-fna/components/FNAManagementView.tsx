/**
 * FNA Management View — the FNA list on a policy category tab, used by every
 * FNA type (it lives here for historical reasons).
 *
 * Shows every FNA of one type for the client, newest first, with "Run New FNA"
 * and "View". The rows come from the type's own API through the FNA registry
 * (`loadFNAs`), never from a hand-built URL. `highlightFnaId` marks the FNA
 * that was just published, which is where the wizard lands the adviser.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Eye, Download, Calendar, Loader2, ArrowLeft, Zap } from 'lucide-react';
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
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
          </div>
          <p className="text-sm text-muted-foreground ml-11">
            View and manage Financial Needs Analyses for {clientName}
          </p>
        </div>

        <Button onClick={onCreateNew} size="lg">
          <Zap className="mr-2 h-4 w-4" />
          Run New FNA
        </Button>
      </div>

      {/* Summary Stats */}
      {!isLoading && fnas.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total FNAs</div>
              <div className="text-2xl font-bold">{fnas.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Published</div>
              <div className="text-2xl font-bold text-[#6d28d9]">
                {fnas.filter((f) => f.status === 'published').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Drafts</div>
              <div className="text-2xl font-bold text-gray-600">
                {fnas.filter((f) => f.status === 'draft').length}
              </div>
            </CardContent>
          </Card>
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">No FNAs Found</h3>
              <p className="text-sm text-gray-600 mb-6">
                Get started by running your first {fnaName} for this client.
              </p>
              <Button onClick={onCreateNew}>
                <Zap className="mr-2 h-4 w-4" />
                Run New FNA
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
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                          {fna.status === 'published' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // TODO: Implement PDF export for published FNA
                                toast.info('PDF export coming soon');
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
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
