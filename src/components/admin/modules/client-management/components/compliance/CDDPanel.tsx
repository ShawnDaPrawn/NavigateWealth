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

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import {
  FileCheck,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../../../../../../utils/supabase/info';
import { getAuthToken } from './compliance-auth';

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

interface CddResult {
  success: boolean;
  data?: Record<string, unknown>;
  matterId?: string;
  checkType?: string;
  error?: string;
}

interface CheckHistoryEntry {
  id: string;
  checkType: string;
  submittedAt: string;
  status: string;
  summary: string;
  matterId: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/honeycomb`;

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
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [clientId]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/checks/history/${clientId}/cdd_report`, {
        headers: { Authorization: `Bearer ${await getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('[CDD Panel] Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleRunCdd = async () => {
    setIsRunning(true);
    setResult(null);
    const toastId = toast.loading('Running Customer Due Diligence report...');

    try {
      const res = await fetch(`${API_BASE}/reports/cdd`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          firstName,
          lastName,
          idNumber,
          passport,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error);
        setResult({ success: false, error: errMsg });
        toast.error(errMsg, { id: toastId });
        return;
      }

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
      {/* CDD Action Card */}
      <Card className="bg-teal-50/50 border-teal-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-medium flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-teal-600" />
            Customer Due Diligence (CDD)
          </CardTitle>
          <CardDescription>
            Run a comprehensive due diligence report via the Honeycomb bureau integration.
            This consolidated check covers identity verification, address confirmation, and
            risk indicators in a single call. Results are attributed to Honeycomb Information
            Services (Beeswax platform).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* ID summary */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">SA ID:</span>
              {idNumber ? (
                <Badge variant="outline" className="font-mono text-xs">
                  {idNumber.substring(0, 6)}••••••{idNumber.substring(idNumber.length - 1)}
                </Badge>
              ) : (
                <span className="text-gray-400 text-xs">Not set</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Passport:</span>
              {passport ? (
                <Badge variant="outline" className="font-mono text-xs">
                  {passport.substring(0, 3)}•••
                </Badge>
              ) : (
                <span className="text-gray-400 text-xs">Not set</span>
              )}
            </div>
          </div>

          {!hasIdentification && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                No valid ID number or passport on file. Update the client's profile before running a CDD report.
              </p>
            </div>
          )}

          <Button
            className="w-full"
            variant="secondary"
            onClick={handleRunCdd}
            disabled={isRunning || !hasIdentification}
          >
            {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Shield className="mr-2 h-4 w-4" />
            Run CDD Report
          </Button>

          {/* Result */}
          {result && (
            <div className={`rounded-lg p-3 text-sm ${
              result.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2 font-medium">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className={result.success ? 'text-green-800' : 'text-red-800'}>
                  {result.success ? 'CDD Report Complete' : 'CDD Report Failed'}
                </span>
              </div>

              {result.error && (
                <p className="mt-1 text-red-700 text-xs">{result.error}</p>
              )}

              {result.success && (
                <div className="mt-2 space-y-1">
                  {result.matterId && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <span>Matter ID:</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {result.matterId}
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <Shield className="h-3 w-3" />
                    <span>Data provided by Honeycomb Information Services (Beeswax)</span>
                  </div>

                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 mt-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showDetails ? 'Hide' : 'Show'} full response
                  </button>

                  {showDetails && (
                    <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-auto max-h-48 font-mono">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check History */}
      <Card>
        <CardHeader className="pb-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between w-full"
          >
            <CardTitle className="text-md font-medium flex items-center gap-2">
              <History className="h-5 w-5 text-gray-500" />
              CDD Report History
              {history.length > 0 && (
                <Badge variant="secondary" className="text-xs">{history.length}</Badge>
              )}
            </CardTitle>
            {showHistory ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {isLoadingHistory ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No CDD reports have been run for this client yet.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {new Date(entry.submittedAt).toLocaleString('en-ZA', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.matterId && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {entry.matterId.substring(0, 8)}...
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          entry.status === 'completed'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : entry.status === 'failed'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }
                      >
                        {entry.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}