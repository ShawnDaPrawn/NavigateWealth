import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../ui/table';
import { Loader2, History, RefreshCw } from 'lucide-react';
import { fetchPrefillAudit } from '../../../../services/form-prefill-api';

interface PrefillAuditRow {
  timestamp?: string;
  formId?: string;
  appliedFields?: string[];
  adminUserId?: string;
  resolverVersion?: string;
}

interface PrefillHistoryPanelProps {
  clientId: string;
}

export function PrefillHistoryPanel({ clientId }: PrefillHistoryPanelProps) {
  const [rows, setRows] = useState<PrefillAuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPrefillAudit(clientId);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prefill history');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="border-purple-100">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-purple-600" />
            Prefill history
          </CardTitle>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No prefill apply events recorded yet.</p>
        )}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Adviser</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.timestamp}-${index}`}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-xs">{row.formId ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    {(row.appliedFields ?? []).length} applied
                    {row.resolverVersion ? ` · v${row.resolverVersion}` : ''}
                  </TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-[120px]">
                    {row.adminUserId ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
