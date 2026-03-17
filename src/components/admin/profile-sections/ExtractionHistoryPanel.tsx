/**
 * EXTRACTION HISTORY PANEL
 *
 * Displays a timeline of all AI extraction attempts for a policy document.
 * Each entry shows date, model, confidence, field count, applied status.
 * Includes a confidence trend sparkline and side-by-side comparison via dialog.
 *
 * @module ExtractionHistoryPanel
 */

import React, { useState, useCallback, useId } from 'react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { SVGAreaSparkline } from '../../ui/svg-charts';
import {
  History,
  Check,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowLeftRight,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { createClient } from '../../../utils/supabase/client';
import { ExtractionComparisonDialog } from './ExtractionComparisonDialog';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

interface ExtractionHistoryEntry {
  id: string;
  extractedAt: string;
  confidence: number;
  status: 'pending' | 'completed' | 'failed';
  fieldsMapped: number;
  warningCount: number;
  wasApplied: boolean;
  appliedAt?: string;
  appliedFields?: string[];
  model?: string;
  documentFileName?: string;
  errorMessage?: string;
  promptVersion?: string;
  extractedData?: Record<string, unknown>;
  fieldMappings?: Array<{
    canonicalKey: string;
    schemaFieldId: string;
    schemaFieldName: string;
    value: unknown;
    confidence: number;
  }>;
  /** Compact snapshot from server for comparison */
  fieldMappingsSnapshot?: Array<{
    k: string;
    f: string;
    n: string;
    v: unknown;
    c: number;
  }>;
}

interface ExtractionHistoryPanelProps {
  policyId: string;
  clientId: string;
  /** Current extraction history from the policy object (avoids extra fetch) */
  initialHistory?: ExtractionHistoryEntry[];
}

export function ExtractionHistoryPanel({
  policyId,
  clientId,
  initialHistory,
}: ExtractionHistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<ExtractionHistoryEntry[]>(initialHistory || []);
  const [isLoading, setIsLoading] = useState(false);

  // Comparison state
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [comparisonOpen, setComparisonOpen] = useState(false);

  // Unique gradient ID for this panel instance to avoid SVG ID collisions
  const instanceId = useId();
  const gradientId = `sparkGrad-${instanceId.replace(/:/g, '')}`;

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || publicAnonKey;

      const res = await fetch(
        `${API_BASE}/policy-extraction/history?policyId=${encodeURIComponent(policyId)}&clientId=${encodeURIComponent(clientId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch extraction history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [policyId, clientId]);

  const handleToggle = () => {
    if (!isOpen && history.length === 0) {
      fetchHistory();
    }
    setIsOpen(!isOpen);
  };

  const toggleCompareSelection = (entryId: string) => {
    setSelectedForCompare(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        // Max 2 selections for comparison
        if (next.size >= 2) {
          // Replace the oldest selection
          const firstKey = next.values().next().value;
          if (firstKey) next.delete(firstKey);
        }
        next.add(entryId);
      }
      return next;
    });
  };

  const handleOpenComparison = () => {
    if (selectedForCompare.size === 2) {
      setComparisonOpen(true);
    }
  };

  if (!initialHistory?.length && !isOpen) {
    return null;
  }

  const totalEntries = history.length;
  const reversedHistory = [...history].reverse();

  // Sparkline data: only completed entries, chronological order
  const sparklineData = history
    .filter(e => e.status === 'completed')
    .map(e => ({
      confidence: e.confidence,
      date: new Date(e.extractedAt).toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'short',
      }),
    }));

  // Determine the trend (last vs first)
  const hasTrend = sparklineData.length >= 2;
  const trendPositive = hasTrend
    ? sparklineData[sparklineData.length - 1].confidence >= sparklineData[0].confidence
    : true;

  // Comparison entries
  const compareIds = Array.from(selectedForCompare);
  const leftEntry = compareIds.length >= 1 ? history.find(e => e.id === compareIds[0]) || null : null;
  const rightEntry = compareIds.length >= 2 ? history.find(e => e.id === compareIds[1]) || null : null;

  // Sort comparison so older is left, newer is right
  const sortedLeft = leftEntry && rightEntry
    ? (new Date(leftEntry.extractedAt) <= new Date(rightEntry.extractedAt) ? leftEntry : rightEntry)
    : leftEntry;
  const sortedRight = leftEntry && rightEntry
    ? (new Date(leftEntry.extractedAt) > new Date(rightEntry.extractedAt) ? leftEntry : rightEntry)
    : rightEntry;

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="text-gray-500 hover:text-gray-700 text-xs h-6 px-2"
      >
        <History className="h-3 w-3 mr-1" />
        {totalEntries > 0 ? `${totalEntries} previous extraction${totalEntries > 1 ? 's' : ''}` : 'Extraction history'}
        {isOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
      </Button>

      {isOpen && (
        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
          {/* Header row with title + sparkline */}
          <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-gray-500 uppercase">Extraction History</span>
              {isLoading && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
            </div>

            {/* Confidence Trend Sparkline */}
            {sparklineData.length >= 2 && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-gray-400">Confidence trend</span>
                <div className="w-[80px] h-[24px]">
                  <SVGAreaSparkline
                    data={sparklineData.map(d => ({ value: d.confidence, label: d.date }))}
                    width={80}
                    height={24}
                    color={trendPositive ? '#22c55e' : '#ef4444'}
                    gradientId={gradientId}
                  />
                </div>
                <Badge className={`text-[8px] px-1 py-0 ${
                  trendPositive
                    ? 'bg-green-100 text-green-700 hover:bg-green-100'
                    : 'bg-red-100 text-red-700 hover:bg-red-100'
                }`}>
                  {trendPositive ? '+' : ''}
                  {Math.round(
                    (sparklineData[sparklineData.length - 1].confidence - sparklineData[0].confidence) * 100
                  )}%
                </Badge>
              </div>
            )}
          </div>

          {/* Compare toolbar — shown when selections are active */}
          {selectedForCompare.size > 0 && (
            <div className="px-3 py-1.5 bg-purple-50 border-b border-purple-200 flex items-center justify-between">
              <span className="text-[10px] text-purple-700">
                {selectedForCompare.size} of 2 selected for comparison
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedForCompare(new Set())}
                  className="text-[10px] h-5 px-2 text-purple-600 hover:text-purple-700"
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  disabled={selectedForCompare.size < 2}
                  onClick={handleOpenComparison}
                  className="text-[10px] h-5 px-2 bg-purple-600 hover:bg-purple-700"
                >
                  <ArrowLeftRight className="h-2.5 w-2.5 mr-1" />
                  Compare
                </Button>
              </div>
            </div>
          )}

          {history.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400">
              No previous extractions recorded.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[240px] overflow-y-auto">
              {reversedHistory.map((entry) => {
                const isSelectedForCompare = selectedForCompare.has(entry.id);
                return (
                  <div
                    key={entry.id}
                    className={`px-3 py-2 flex items-center gap-3 transition-colors ${
                      isSelectedForCompare ? 'bg-purple-50/50' : 'hover:bg-gray-50/50'
                    }`}
                  >
                    {/* Compare checkbox */}
                    <button
                      onClick={() => toggleCompareSelection(entry.id)}
                      className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelectedForCompare
                          ? 'bg-purple-600 border-purple-600'
                          : 'border-gray-300 bg-white hover:border-purple-400'
                      }`}
                      title="Select for comparison"
                    >
                      {isSelectedForCompare && <Check className="h-3 w-3 text-white" />}
                    </button>

                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {entry.status === 'completed' ? (
                        <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                          <Sparkles className="h-3 w-3 text-green-600" />
                        </div>
                      ) : entry.status === 'failed' ? (
                        <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center">
                          <XCircle className="h-3 w-3 text-red-600" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                          <Clock className="h-3 w-3 text-gray-500" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-700">
                          {new Date(entry.extractedAt).toLocaleDateString('en-ZA', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(entry.extractedAt).toLocaleTimeString('en-ZA', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {entry.status === 'completed' && (
                          <span className="text-[10px] text-gray-500">
                            {Math.round(entry.confidence * 100)}% confidence
                          </span>
                        )}
                        {entry.fieldsMapped > 0 && (
                          <span className="text-[10px] text-gray-400">
                            {entry.fieldsMapped} fields
                          </span>
                        )}
                        {entry.warningCount > 0 && (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[9px] px-1 py-0">
                            {entry.warningCount} warning{entry.warningCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {entry.status === 'failed' && entry.errorMessage && (
                          <span className="text-[10px] text-red-500 truncate max-w-[200px]">
                            {entry.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Applied badge */}
                    <div className="flex-shrink-0">
                      {entry.wasApplied ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[9px] px-1.5 py-0">
                          <Check className="h-2.5 w-2.5 mr-0.5" />
                          Applied
                        </Badge>
                      ) : entry.status === 'completed' ? (
                        <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-[9px] px-1.5 py-0">
                          Not applied
                        </Badge>
                      ) : null}
                    </div>

                    {/* Model & Prompt Version */}
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {entry.model && (
                        <span className="text-[9px] text-gray-400">{entry.model}</span>
                      )}
                      {entry.promptVersion && (
                        <span className="text-[8px] text-gray-300" title="Prompt template version">
                          v{entry.promptVersion}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Comparison Dialog */}
      <ExtractionComparisonDialog
        isOpen={comparisonOpen}
        onClose={() => {
          setComparisonOpen(false);
          setSelectedForCompare(new Set());
        }}
        policyId={policyId}
        clientId={clientId}
        leftEntry={sortedLeft}
        rightEntry={sortedRight}
        leftLabel="Older"
        rightLabel="Newer"
      />
    </div>
  );
}