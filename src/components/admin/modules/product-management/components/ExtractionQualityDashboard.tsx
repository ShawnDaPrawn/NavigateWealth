/**
 * EXTRACTION QUALITY DASHBOARD
 *
 * Displays aggregated extraction quality metrics across all policies.
 * Shows per-provider confidence, success rates, low-confidence field
 * frequency, and extraction timeline data.
 *
 * Designed to be embedded within the DocumentMappingTab.
 *
 * @module ExtractionQualityDashboard
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { cn } from '../../../../ui/utils';

import { DsButton, DsStat, DsStats, ErrorState } from '../../../layout/page';

import { Loader2 } from 'lucide-react';

import { api } from '../../../../../utils/api';

interface OverviewStats {
  totalPolicies: number;
  totalWithDocuments: number;
  totalExtractions: number;
  completedExtractions: number;
  failedExtractions: number;
  avgConfidence: number;
  successRate: number;
  totalLockedFields: number;
}

interface ProviderStat {
  providerId: string;
  providerName: string;
  totalPolicies: number;
  withDocuments: number;
  withExtractions: number;
  completedExtractions: number;
  failedExtractions: number;
  avgConfidence: number;
  successRate: number;
  totalFieldsMapped: number;
  totalWarnings: number;
  lockedFieldCount: number;
}

interface LowConfidenceField {
  fieldId: string;
  fieldName: string;
  avgConfidence: number;
  occurrences: number;
  lowConfidenceCount: number;
  lowConfidenceRate: number;
}

interface QualityData {
  overview: OverviewStats;
  providerStats: ProviderStat[];
  lowConfidenceFields: LowConfidenceField[];
}

/**
 * PM-DocAI layout: the four figures across the top, then a split with the
 * caller's terminology card (children) on the left and "Confidence by provider"
 * on the right.
 */
export function ExtractionQualityDashboard({ children }: { children?: ReactNode }) {
  const [data, setData] = useState<QualityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showLowConfidence, setShowLowConfidence] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.get<QualityData>('/integrations/policy-extraction/quality-stats');
      setData({
        overview: result.overview,
        providerStats: result.providerStats,
        lowConfidenceFields: result.lowConfidenceFields,
      });
      setLoadError(null);
    } catch (err) {
      console.error('Error loading extraction quality stats:', err);
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-nw-violet" aria-label="Loading" />
        </div>
        {children}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Unable to load extraction quality"
          onRetry={() => void fetchStats()}
          details={loadError ?? undefined}
        />
        {children}
      </div>
    );
  }

  const { overview, providerStats, lowConfidenceFields } = data;

  const confidenceTone = (c: number) => (c >= 0.85 ? 'ok' : c >= 0.5 ? 'warn' : 'bad');

  return (
    <div className="space-y-4">
      <DsStats>
        <DsStat
          label="Total extractions"
          value={overview.completedExtractions}
          meta={`${overview.failedExtractions} failed`}
        />
        <DsStat label="Avg confidence" value={`${Math.round(overview.avgConfidence * 100)}%`} />
        <DsStat
          label="Success rate"
          value={`${overview.successRate}%`}
          meta={`${overview.totalWithDocuments} documents`}
        />
        <DsStat
          label="Locked fields"
          value={overview.totalLockedFields}
          meta="Protected from overwrite"
        />
      </DsStats>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="min-w-0">{children}</div>

        <aside className="ds-card overflow-hidden" aria-label="Confidence by provider">
          <div className="ds-card-h">
            <h3>Confidence by provider</h3>
            <DsButton size="sm" onClick={() => void fetchStats()}>
              Refresh
            </DsButton>
          </div>
          {providerStats.length === 0 ? (
            <div className="ds-card-b">
              <span className="ds-meta">No extractions yet</span>
            </div>
          ) : (
            <ul className="divide-y divide-nw-line">
              {providerStats.map((ps) => {
                const pct = Math.round(ps.avgConfidence * 100);
                const tone = confidenceTone(ps.avgConfidence);
                return (
                  <li key={ps.providerId} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13.5px] text-nw-ink">{ps.providerName}</span>
                      <b className="tabular-nums">{pct}%</b>
                    </div>
                    <div
                      className={cn('ds-meter', tone)}
                      role="meter"
                      aria-label={`${ps.providerName} average confidence`}
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <span className="ds-meta">
                      {ps.withDocuments} docs · {ps.completedExtractions} extracted
                      {ps.failedExtractions > 0 && ` · ${ps.failedExtractions} failed`}
                      {ps.totalWarnings > 0 && ` · ${ps.totalWarnings} warnings`}
                      {ps.lockedFieldCount > 0 && ` · ${ps.lockedFieldCount} locked`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {lowConfidenceFields.length > 0 && (
            <div className="border-t border-nw-line">
              <button
                type="button"
                onClick={() => setShowLowConfidence(!showLowConfidence)}
                aria-expanded={showLowConfidence}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] font-medium text-nw-ink hover:bg-[#fbfaf7]"
              >
                Low-confidence fields
                <span className="ds-count">{lowConfidenceFields.length}</span>
              </button>
              {showLowConfidence && (
                <ul className="divide-y divide-nw-line border-t border-nw-line">
                  {lowConfidenceFields.map((f) => (
                    <li
                      key={f.fieldId}
                      className="flex items-center justify-between gap-3 px-4 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] text-nw-ink">{f.fieldName}</div>
                        <span className="ds-meta">{f.occurrences} occurrences</span>
                      </div>
                      <span className={cn('ds-pill', confidenceTone(f.avgConfidence))}>
                        {Math.round(f.avgConfidence * 100)}% · {f.lowConfidenceRate}% low
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
