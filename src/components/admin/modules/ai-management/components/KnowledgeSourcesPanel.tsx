/**
 * KnowledgeSourcesPanel — "What Vasco can draw on".
 *
 * Sits at the top of the Knowledge tab and answers the question the old UI
 * never did: is the content I can see actually reaching Vasco? It compares
 * what is indexed with what is published / live, says "up to date" or
 * "out of date" in plain words, and offers the one repair action (rebuild).
 */

import { BookOpen, FileText, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { cn } from '../../../../ui/utils';
import { formatDateTime, plural } from '../format';
import type { KnowledgeIndexStatus } from '../types';

interface KnowledgeSourcesPanelProps {
  status: KnowledgeIndexStatus | null | undefined;
  isLoading: boolean;
  onRebuild: () => void;
  isRebuilding: boolean;
}

type Health = 'loading' | 'unavailable' | 'empty' | 'not-built' | 'out-of-date' | 'up-to-date';

function assess(status: KnowledgeIndexStatus | null | undefined, isLoading: boolean): Health {
  if (isLoading) return 'loading';
  if (!status) return 'unavailable';
  const wanted = status.publishedArticleCount + status.activeKbCount;
  if (wanted === 0 && !status.indexed) return 'empty';
  if (!status.indexed) return 'not-built';
  if (status.pendingArticles + status.pendingKbEntries + status.staleSources > 0)
    return 'out-of-date';
  return 'up-to-date';
}

function SourceRow({
  icon: Icon,
  name,
  indexed,
  total,
  noun,
  how,
}: {
  icon: React.ElementType;
  name: string;
  indexed: number;
  total: number;
  noun: [string, string];
  how: string;
}) {
  const complete = total > 0 && indexed >= total;
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-gray-100 shrink-0">
        <Icon className="h-4 w-4 text-gray-600" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {name}
          <span className={cn('ml-2 tabular-nums', complete ? 'text-gray-500' : 'text-amber-700')}>
            {indexed} of {total} {total === 1 ? noun[0] : noun[1]} indexed
          </span>
        </p>
        <p className="text-xs text-gray-500">{how}</p>
      </div>
    </div>
  );
}

export function KnowledgeSourcesPanel({
  status,
  isLoading,
  onRebuild,
  isRebuilding,
}: KnowledgeSourcesPanelProps) {
  const health = assess(status, isLoading);
  const waiting = (status?.pendingArticles ?? 0) + (status?.pendingKbEntries ?? 0);
  const stale = status?.staleSources ?? 0;

  const headline: Record<Health, { text: string; tone: 'ok' | 'warn' | 'muted' }> = {
    loading: { text: 'Checking what Vasco can use…', tone: 'muted' },
    unavailable: { text: 'Could not check the knowledge index', tone: 'warn' },
    empty: { text: 'Vasco has no knowledge sources yet', tone: 'muted' },
    'not-built': {
      text: 'Knowledge has never been indexed — Vasco cannot use it yet',
      tone: 'warn',
    },
    'out-of-date': {
      text: [
        waiting > 0 ? `${plural(waiting, 'source')} waiting to be indexed` : '',
        stale > 0 ? `${plural(stale, 'stale source')} to remove` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      tone: 'warn',
    },
    'up-to-date': { text: 'Up to date — everything shown here is available to Vasco', tone: 'ok' },
  };
  const h = headline[health];

  return (
    <section
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4"
      aria-labelledby="knowledge-sources-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="knowledge-sources-heading" className="text-base font-semibold text-gray-900">
            What Vasco can draw on
          </h2>
          <p
            className={cn(
              'text-sm mt-1 inline-flex items-center gap-1.5',
              h.tone === 'ok' && 'text-green-700',
              h.tone === 'warn' && 'text-amber-700',
              h.tone === 'muted' && 'text-gray-500',
            )}
            role="status"
          >
            {health === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : h.tone === 'ok' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : h.tone === 'warn' ? (
              <AlertTriangle className="h-4 w-4" />
            ) : null}
            {h.text}
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
          <Button
            variant={h.tone === 'warn' && health !== 'unavailable' ? 'default' : 'outline'}
            size="sm"
            onClick={onRebuild}
            disabled={isRebuilding || health === 'loading'}
            className={cn(
              'gap-2',
              h.tone === 'warn' && health !== 'unavailable' && 'bg-purple-600 hover:bg-purple-700',
            )}
          >
            {isRebuilding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {isRebuilding ? 'Rebuilding…' : 'Rebuild index'}
          </Button>
          <span className="text-[11px] text-gray-400">
            {status?.lastUpdated
              ? `Last updated ${formatDateTime(status.lastUpdated)}`
              : 'Never indexed'}
          </span>
        </div>
      </div>

      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <SourceRow
            icon={FileText}
            name="Published articles"
            indexed={status.articles.length}
            total={status.publishedArticleCount}
            noun={['article', 'articles']}
            how="Added automatically when an article is published in Publications."
          />
          <SourceRow
            icon={BookOpen}
            name="Knowledge base entries"
            indexed={status.kbEntries.length}
            total={status.activeKbCount}
            noun={['live entry', 'live entries']}
            how="Added the moment you save an entry as Live. Drafts stay hidden from Vasco."
          />
        </div>
      )}

      <p className="text-xs text-gray-500">
        Rebuilding re-reads every published article and live entry. Use it if the counts above
        disagree, after bulk changes, or if a save reported that indexing failed. It takes about a
        second per source.
      </p>
    </section>
  );
}
