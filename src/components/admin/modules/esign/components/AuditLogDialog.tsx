/**
 * P7.3 — Searchable global audit log.
 *
 * Opens from the dashboard. Lets an admin filter the firm's audit
 * trail across *all* envelopes by signer email, action, and date
 * range. Results are newest-first, capped at 500, with a clear
 * "truncated" badge if the scan hit the cap.
 *
 * The dialog intentionally avoids client-side pagination — the
 * server returns a single page because a firm's audit log at this
 * scale is comfortably < 500 rows for any useful query. If a query
 * is too broad we show the truncation hint rather than lazily load
 * more (which would defeat the search purpose).
 */

import { useCallback, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../ui/dialog';
import { Input } from '../../../../ui/input';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Label } from '../../../../ui/label';
import { ScrollArea } from '../../../../ui/scroll-area';
import { Loader2, Search, AlertTriangle } from 'lucide-react';
import { esignApi } from '../api';
import { logger } from '../../../../../utils/logger';
import { SkeletonList } from './EsignSkeleton';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenEnvelope?: (envelopeId: string) => void;
}

type Hit = Awaited<ReturnType<typeof esignApi.searchAudit>>['hits'][number];

export function AuditLogDialog({ open, onOpenChange, onOpenEnvelope }: Props) {
  const [signerEmail, setSignerEmail] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof esignApi.searchAudit>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await esignApi.searchAudit({
        signer_email: signerEmail.trim() || undefined,
        action: action.trim() || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
        limit: 500,
      });
      setResult(data);
    } catch (err) {
      logger.error('Audit search failed:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [signerEmail, action, from, to]);

  const reset = () => {
    setSignerEmail('');
    setAction('');
    setFrom('');
    setTo('');
    setResult(null);
    setError(null);
  };

  const hasQuery = useMemo(
    () => !!(signerEmail || action || from || to),
    [signerEmail, action, from, to],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Global audit log</DialogTitle>
          <DialogDescription>
            Search every e-signature event across your firm. Use filters to narrow the result set.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label htmlFor="audit-signer-email" className="text-xs">Signer email</Label>
            <Input
              id="audit-signer-email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              placeholder="signer@example.com"
              type="email"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="audit-action" className="text-xs">Action contains</Label>
            <Input
              id="audit-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g. signed, declined, viewed"
            />
          </div>
          <div>
            <Label htmlFor="audit-from" className="text-xs">From</Label>
            <Input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="audit-to" className="text-xs">To</Label>
            <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex items-end gap-2">
            <Button onClick={runSearch} disabled={loading} className="flex-1">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-1.5" />
              )}
              Search
            </Button>
            <Button variant="ghost" onClick={reset} disabled={loading || !hasQuery}>
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {!result && !error && !loading && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Enter filters and press search to browse recent events.
            </p>
          )}

          {/* P8.3 — Skeleton list while a search is in flight, instead of
               leaving the panel blank or showing only a spinner badge in the
               button. */}
          {loading && !result && (
            <div className="mt-2">
              <SkeletonList items={6} />
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {result.total} event{result.total === 1 ? '' : 's'}
                  {result.truncated && ' (capped at 500 — refine filters)'}
                </span>
                <span>
                  Scanned {result.scanned.toLocaleString()} in {result.durationMs}ms
                </span>
              </div>

              <ScrollArea className="h-[440px] border rounded-md">
                {result.hits.length === 0 ? (
                  // P8.2 — empty result still offers an obvious next action.
                  <div className="py-12 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      No events matched this query.
                    </p>
                    {hasQuery && (
                      <Button variant="outline" size="sm" onClick={reset}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y">
                    {result.hits.map((hit) => (
                      <AuditRow key={hit.id} hit={hit} onOpenEnvelope={onOpenEnvelope} />
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AuditRow({ hit, onOpenEnvelope }: { hit: Hit; onOpenEnvelope?: (id: string) => void }) {
  return (
    <li className="px-3 py-2 hover:bg-gray-50 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] uppercase">
            {hit.action}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {hit.actor_type}
            {hit.email && ` · ${hit.email}`}
          </span>
        </div>
        <div className="text-sm font-medium text-gray-900 truncate mt-0.5">
          {hit.envelope_title}
        </div>
        <div className="text-[11px] text-muted-foreground truncate" title={hit.at}>
          {format(new Date(hit.at), 'd MMM yyyy HH:mm')} · {formatDistanceToNow(new Date(hit.at), { addSuffix: true })}
          {hit.ip && ` · ${hit.ip}`}
        </div>
      </div>
      {onOpenEnvelope && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => onOpenEnvelope(hit.envelope_id)}
        >
          Open
        </Button>
      )}
    </li>
  );
}
