/**
 * CDD Panel — Customer Due Diligence
 *
 * Runs a comprehensive CDD report via Honeycomb's /natural-person-cdd endpoint.
 * This is a dedicated sub-tab in the per-client ComplianceTab, providing a
 * consolidated due diligence check covering identity, address, and risk indicators
 * in a single bureau call.
 *
 * Results are stored in KV under honeycomb_checks:{clientId}:cdd_report
 * and appear in the Activity Log.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../../../ui/button';
import { Loader2 } from 'lucide-react';
import { Notice } from '../../../../layout/page';
import { CheckHistoryCard, CheckResult, ClientIdentificationCard } from './CheckBlocks';
import type { CheckHistoryEntry, CheckRunResult as CddResult } from './CheckBlocks';
import { toast } from 'sonner';
import { api } from '../../../../../../utils/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CDDPanelProps {
  clientId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  passport: string | null;
  hasIdentification: boolean;
  onCheckComplete?: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

// ─── Component ──────────────────────────────────────────────────────────────

export function CDDPanel({
  clientId,
  firstName,
  lastName,
  idNumber,
  passport,
  hasIdentification,
  onCheckComplete,
}: CDDPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<CddResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // History
  const [history, setHistory] = useState<CheckHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await api.get<{ history?: CheckHistoryEntry[] }>(
        `/integrations/honeycomb/checks/history/${clientId}/cdd_report`,
      );
      setHistory(data.history || []);
    } catch (err) {
      console.error('[CDD Panel] Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadHistory();
  }, [clientId, loadHistory]);

  const handleRunCdd = async () => {
    setIsRunning(true);
    setResult(null);
    const toastId = toast.loading('Running Customer Due Diligence report...');

    try {
      const data = await api.post<{
        data?: Record<string, unknown>;
        matterId?: string;
        checkType?: string;
      }>(`/integrations/honeycomb/reports/cdd`, {
        clientId,
        firstName,
        lastName,
        idNumber,
        passport,
      });

      setResult({
        success: true,
        data: data.data,
        matterId: data.matterId,
        checkType: data.checkType,
      });
      toast.success('CDD report completed', { id: toastId });
      loadHistory();
      onCheckComplete?.();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Network error';
      setResult({ success: false, error: errMsg });
      toast.error(errMsg, { id: toastId });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Design CM-K-CDD: identification with the run action, the latest result, history. */}
      <ClientIdentificationCard
        idNumber={idNumber}
        passport={passport}
        matterId={result?.matterId ?? history[0]?.matterId ?? null}
        aside={
          <Button size="sm" onClick={handleRunCdd} disabled={isRunning || !hasIdentification}>
            {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Run CDD report
          </Button>
        }
      />

      {!hasIdentification && (
        <Notice kind="attention" title="No ID or passport number on file.">
          Add one to the client&apos;s profile before running a CDD report.
        </Notice>
      )}

      {result && (
        <CheckResult
          result={result}
          successLabel="CDD report complete"
          failureLabel="CDD report failed"
          showDetails={showDetails}
          onToggleDetails={() => setShowDetails(!showDetails)}
        />
      )}

      <CheckHistoryCard
        loading={isLoadingHistory}
        history={history}
        emptyText="No CDD reports have been run for this client yet."
        checkLabel={() => 'CDD report'}
        completeLabel="CDD report complete"
      />
    </div>
  );
}
