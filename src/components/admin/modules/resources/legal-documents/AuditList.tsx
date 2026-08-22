/**
 * The audit trail for one legal document.
 *
 * Split out of `LegalDocumentsManager.tsx` (1,556 lines), which held the whole
 * workspace — helpers, badges, lists, the draft editor and the shell — in one
 * file. Each piece was already a self-contained function with its own props;
 * this only changes which file it lives in.
 */
import { Badge } from '../../../../ui/badge';
import { Skeleton } from '../../../../ui/skeleton';
import type { LegalDocumentAuditEntry } from '../types';
import { formatDate } from './legalDocumentHelpers';

export function AuditList({
  entries,
  isLoading,
}: {
  entries: LegalDocumentAuditEntry[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-muted-foreground">
        No legal-document audit entries yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const severityClass =
          entry.severity === 'critical'
            ? 'border-red-200 bg-red-50 text-red-700'
            : entry.severity === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-slate-200 bg-slate-50 text-slate-700';

        return (
          <div key={entry.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={severityClass}>
                  {entry.severity}
                </Badge>
                <Badge variant="outline">{entry.action}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{formatDate(entry.timestamp)}</div>
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900">{entry.summary}</p>
            <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              <div>
                Actor role: <span className="font-medium text-gray-900">{entry.actorRole}</span>
              </div>
              <div>
                Entity: <span className="font-medium text-gray-900">{entry.entityId || 'n/a'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
