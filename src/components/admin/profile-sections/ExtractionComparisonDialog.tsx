/**
 * EXTRACTION COMPARISON DIALOG
 *
 * Side-by-side comparison of two extraction snapshots.
 * Shows field-level diffs with old/new values, confidence changes,
 * and a visual summary of what changed.
 *
 * Uses the server-side `/policy-extraction/compare` endpoint when available,
 * with a client-side fallback for entries that have inline `fieldMappingsSnapshot`.
 *
 * @module ExtractionComparisonDialog
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Sparkles,
  FileText,
  Check,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { createClient } from '../../../utils/supabase/client';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

/** Compact snapshot format stored in history entries */
interface FieldMappingSnapshot {
  k: string; // canonicalKey
  f: string; // schemaFieldId
  n: string; // schemaFieldName
  v: unknown; // value
  c: number; // confidence
}

interface HistoryEntry {
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
  /** Compact field mappings snapshot for comparison */
  fieldMappingsSnapshot?: FieldMappingSnapshot[];
}

interface ComparisonField {
  fieldName: string;
  schemaFieldId: string;
  leftValue: unknown;
  rightValue: unknown;
  leftConfidence: number;
  rightConfidence: number;
  changed: boolean;
  confidenceDelta: number;
}

interface ExtractionComparisonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  policyId: string;
  clientId: string;
  /** The left (older) extraction entry */
  leftEntry: HistoryEntry | null;
  /** The right (newer) extraction entry */
  rightEntry: HistoryEntry | null;
  /** Label for left column */
  leftLabel?: string;
  /** Label for right column */
  rightLabel?: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '\u2014';
  if (typeof value === 'number') {
    return `R${value.toLocaleString('en-ZA')}`;
  }
  return String(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return 'text-green-700';
  if (confidence >= 0.5) return 'text-amber-700';
  return 'text-red-700';
}

export function ExtractionComparisonDialog({
  isOpen,
  onClose,
  policyId,
  clientId,
  leftEntry,
  rightEntry,
  leftLabel = 'Previous',
  rightLabel = 'Current',
}: ExtractionComparisonDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonFields, setComparisonFields] = useState<ComparisonField[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'changed' | 'improved' | 'degraded'>('all');
  const [noSnapshotData, setNoSnapshotData] = useState(false);

  /** Build comparison from client-side snapshot data */
  const buildFromSnapshots = useCallback(
    (leftSnaps: FieldMappingSnapshot[], rightSnaps: FieldMappingSnapshot[]) => {
      const leftMap = new Map(leftSnaps.map(s => [s.f, s]));
      const rightMap = new Map(rightSnaps.map(s => [s.f, s]));
      const allFieldIds = new Set([...leftMap.keys(), ...rightMap.keys()]);
      const fields: ComparisonField[] = [];

      for (const fieldId of allFieldIds) {
        const left = leftMap.get(fieldId);
        const right = rightMap.get(fieldId);
        const leftVal = left?.v ?? null;
        const rightVal = right?.v ?? null;
        const leftConf = left?.c ?? 0;
        const rightConf = right?.c ?? 0;

        fields.push({
          fieldName: right?.n || left?.n || fieldId,
          schemaFieldId: fieldId,
          leftValue: leftVal,
          rightValue: rightVal,
          leftConfidence: leftConf,
          rightConfidence: rightConf,
          changed: String(leftVal) !== String(rightVal),
          confidenceDelta: rightConf - leftConf,
        });
      }

      fields.sort((a, b) => {
        if (a.changed !== b.changed) return a.changed ? -1 : 1;
        return a.fieldName.localeCompare(b.fieldName);
      });

      return fields;
    },
    [],
  );

  const fetchComparisonData = useCallback(async () => {
    if (!leftEntry || !rightEntry) return;
    setNoSnapshotData(false);

    // Try server-side compare endpoint first
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || publicAnonKey;

      const res = await fetch(
        `${API_BASE}/policy-extraction/compare?policyId=${encodeURIComponent(policyId)}&clientId=${encodeURIComponent(clientId)}&leftId=${encodeURIComponent(leftEntry.id)}&rightId=${encodeURIComponent(rightEntry.id)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.ok) {
        const data = await res.json();
        if (data.fields && data.fields.length > 0) {
          setComparisonFields(data.fields);
          setIsLoading(false);
          return;
        }
        // If server returns empty fields, it means no snapshot data
        if (data.message) {
          setNoSnapshotData(true);
        }
      }
    } catch (err) {
      console.error('Server-side compare failed, trying client-side fallback:', err);
    }

    // Client-side fallback: use inline fieldMappingsSnapshot if available
    const leftSnaps = leftEntry.fieldMappingsSnapshot;
    const rightSnaps = rightEntry.fieldMappingsSnapshot;

    if (leftSnaps && rightSnaps) {
      setComparisonFields(buildFromSnapshots(leftSnaps, rightSnaps));
    } else if (leftSnaps || rightSnaps) {
      // One side has data — show partial comparison
      setComparisonFields(buildFromSnapshots(leftSnaps || [], rightSnaps || []));
    } else {
      setComparisonFields([]);
      setNoSnapshotData(true);
    }

    setIsLoading(false);
  }, [policyId, clientId, leftEntry, rightEntry, buildFromSnapshots]);

  useEffect(() => {
    if (isOpen && leftEntry && rightEntry) {
      fetchComparisonData();
    }
    if (!isOpen) {
      setComparisonFields([]);
      setFilterMode('all');
      setNoSnapshotData(false);
    }
  }, [isOpen, fetchComparisonData]);

  // Filter fields
  const filteredFields = comparisonFields.filter(field => {
    switch (filterMode) {
      case 'changed': return field.changed;
      case 'improved': return field.confidenceDelta > 0.05;
      case 'degraded': return field.confidenceDelta < -0.05;
      default: return true;
    }
  });

  // Stats
  const changedCount = comparisonFields.filter(f => f.changed).length;
  const improvedCount = comparisonFields.filter(f => f.confidenceDelta > 0.05).length;
  const degradedCount = comparisonFields.filter(f => f.confidenceDelta < -0.05).length;
  const unchangedCount = comparisonFields.filter(f => !f.changed).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Extraction Comparison
          </DialogTitle>
        </DialogHeader>

        {/* Column Headers */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {/* Left Entry */}
          <div className="bg-gray-50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-gray-200 text-gray-700 hover:bg-gray-200 text-[10px]">
                {leftLabel}
              </Badge>
              {leftEntry?.wasApplied && (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[9px] px-1 py-0">
                  <Check className="h-2.5 w-2.5 mr-0.5" />
                  Applied
                </Badge>
              )}
            </div>
            {leftEntry && (
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-gray-700">{formatDate(leftEntry.extractedAt)}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium ${getConfidenceColor(leftEntry.confidence)}`}>
                    {Math.round(leftEntry.confidence * 100)}% confidence
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {leftEntry.fieldsMapped} fields
                  </span>
                  {leftEntry.model && (
                    <span className="text-[9px] text-gray-400">{leftEntry.model}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Entry */}
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-purple-200 text-purple-700 hover:bg-purple-200 text-[10px]">
                {rightLabel}
              </Badge>
              {rightEntry?.wasApplied && (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[9px] px-1 py-0">
                  <Check className="h-2.5 w-2.5 mr-0.5" />
                  Applied
                </Badge>
              )}
            </div>
            {rightEntry && (
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-gray-700">{formatDate(rightEntry.extractedAt)}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium ${getConfidenceColor(rightEntry.confidence)}`}>
                    {Math.round(rightEntry.confidence * 100)}% confidence
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {rightEntry.fieldsMapped} fields
                  </span>
                  {rightEntry.model && (
                    <span className="text-[9px] text-gray-400">{rightEntry.model}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* No snapshot data warning */}
        {noSnapshotData && comparisonFields.length === 0 && !isLoading && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              Field-level comparison data is unavailable for these extraction entries.
              Extractions performed before snapshot storage was enabled do not have field-level data.
              Future extractions will include full comparison support.
            </span>
          </div>
        )}

        {/* Summary Stats */}
        {comparisonFields.length > 0 && (
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-4 text-[10px]">
              <span className="text-gray-500">{comparisonFields.length} fields total</span>
              {changedCount > 0 && (
                <span className="text-amber-700 font-medium">{changedCount} changed</span>
              )}
              {improvedCount > 0 && (
                <span className="text-green-700 font-medium">{improvedCount} improved</span>
              )}
              {degradedCount > 0 && (
                <span className="text-red-700 font-medium">{degradedCount} degraded</span>
              )}
              {unchangedCount > 0 && (
                <span className="text-gray-400">{unchangedCount} unchanged</span>
              )}
            </div>
            <div className="flex-1" />
            {/* Filter buttons */}
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-gray-400 mr-1" />
              {(['all', 'changed', 'improved', 'degraded'] as const).map(mode => (
                <Button
                  key={mode}
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterMode(mode)}
                  className={`text-[10px] h-5 px-2 ${
                    filterMode === mode
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Field Comparison Table */}
        <div className="flex-1 overflow-y-auto border rounded-lg mt-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            </div>
          ) : filteredFields.length === 0 && !noSnapshotData ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm">
                {comparisonFields.length === 0
                  ? 'No field data available for comparison.'
                  : `No fields match the "${filterMode}" filter.`
                }
              </p>
            </div>
          ) : filteredFields.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto] gap-2 px-3 py-1.5 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase sticky top-0">
                <span>Field</span>
                <span className="w-10 text-center">Conf</span>
                <span className="text-right">{leftLabel}</span>
                <span className="w-6" />
                <span>{rightLabel}</span>
                <span className="w-10 text-center">Conf</span>
              </div>

              {filteredFields.map(field => (
                <div
                  key={field.schemaFieldId}
                  className={`grid grid-cols-[1fr_auto_1fr_auto_1fr_auto] gap-2 px-3 py-2 items-center ${
                    field.changed ? 'bg-amber-50/30' : ''
                  }`}
                >
                  {/* Field Name */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium text-gray-700 truncate">
                      {field.fieldName}
                    </span>
                    {field.changed && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[8px] px-1 py-0 flex-shrink-0">
                        Changed
                      </Badge>
                    )}
                  </div>

                  {/* Left Confidence */}
                  <div className="w-10 text-center">
                    {field.leftConfidence > 0 && (
                      <span className={`text-[10px] font-medium ${getConfidenceColor(field.leftConfidence)}`}>
                        {Math.round(field.leftConfidence * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Left Value */}
                  <span className={`text-xs text-right truncate ${
                    field.changed ? 'text-red-500 line-through' : 'text-gray-600'
                  }`}>
                    {formatValue(field.leftValue)}
                  </span>

                  {/* Arrow */}
                  <div className="w-6 flex items-center justify-center">
                    {field.changed ? (
                      <ArrowRight className="h-3 w-3 text-amber-500" />
                    ) : (
                      <Minus className="h-3 w-3 text-gray-300" />
                    )}
                  </div>

                  {/* Right Value */}
                  <span className={`text-xs truncate ${
                    field.changed ? 'text-green-700 font-medium' : 'text-gray-600'
                  }`}>
                    {formatValue(field.rightValue)}
                  </span>

                  {/* Right Confidence + Delta */}
                  <div className="w-10 flex items-center justify-center gap-0.5">
                    {field.rightConfidence > 0 && (
                      <span className={`text-[10px] font-medium ${getConfidenceColor(field.rightConfidence)}`}>
                        {Math.round(field.rightConfidence * 100)}%
                      </span>
                    )}
                    {Math.abs(field.confidenceDelta) > 0.05 && (
                      field.confidenceDelta > 0 ? (
                        <TrendingUp className="h-2.5 w-2.5 text-green-600" />
                      ) : (
                        <TrendingDown className="h-2.5 w-2.5 text-red-500" />
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Overall Confidence Comparison */}
        {leftEntry && rightEntry && (
          <div className="flex items-center justify-between pt-2 border-t mt-1">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-500">Overall Confidence:</span>
              <span className={`font-medium ${getConfidenceColor(leftEntry.confidence)}`}>
                {Math.round(leftEntry.confidence * 100)}%
              </span>
              <ArrowRight className="h-3 w-3 text-gray-400" />
              <span className={`font-medium ${getConfidenceColor(rightEntry.confidence)}`}>
                {Math.round(rightEntry.confidence * 100)}%
              </span>
              {rightEntry.confidence - leftEntry.confidence !== 0 && (
                <Badge className={`text-[9px] px-1.5 py-0 ${
                  rightEntry.confidence > leftEntry.confidence
                    ? 'bg-green-100 text-green-700 hover:bg-green-100'
                    : 'bg-red-100 text-red-700 hover:bg-red-100'
                }`}>
                  {rightEntry.confidence > leftEntry.confidence ? '+' : ''}
                  {Math.round((rightEntry.confidence - leftEntry.confidence) * 100)}%
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
