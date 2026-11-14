/**
 * Identity Verification Panel
 *
 * Runs IDV checks against the correct Honeycomb endpoint:
 *   POST /natural-person-idv-no-photo-no-upload
 *
 * Replaces the old broken /reports/idv endpoint that was guessing paths.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../../../ui/button';
import { Loader2 } from 'lucide-react';
import { Notice } from '../../../../layout/page';
import { PanelCard, StatusPill } from './ComplianceShared';
import { checkStatusTone } from './complianceTypes';
import { toast } from 'sonner';
import { api } from '../../../../../../utils/api';

interface IdentityVerificationPanelProps {
  clientId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  passport: string | null;
  hasIdentification: boolean;
  onCheckComplete?: () => void;
}

interface IdvResult {
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

export function IdentityVerificationPanel({
  clientId,
  firstName,
  lastName,
  idNumber,
  passport,
  hasIdentification,
  onCheckComplete,
}: IdentityVerificationPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<IdvResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [includeSecondary, setIncludeSecondary] = useState(false);

  // IDV with Photo state
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [isRunningPhoto, setIsRunningPhoto] = useState(false);
  const [photoResult, setPhotoResult] = useState<IdvResult | null>(null);
  const [showPhotoDetails, setShowPhotoDetails] = useState(false);

  // History
  const [history, setHistory] = useState<CheckHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await api.get<{ history?: CheckHistoryEntry[] }>(
        `/integrations/honeycomb/checks/history/${clientId}/idv_no_photo`,
      );
      setHistory(data.history || []);
    } catch (err) {
      console.error('[IDV Panel] Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadHistory();
  }, [clientId, loadHistory]);

  const handleRunIdv = async () => {
    setIsRunning(true);
    setResult(null);
    const toastId = toast.loading('Running Identity Verification...');

    try {
      const data = await api.post<{
        data?: Record<string, unknown>;
        matterId?: string;
        checkType?: string;
      }>(`/integrations/honeycomb/idv/no-photo`, {
        clientId,
        firstName,
        lastName,
        idNumber,
        passport,
        secondary: includeSecondary,
      });

      setResult({
        success: true,
        data: data.data,
        matterId: data.matterId,
        checkType: data.checkType,
      });
      toast.success('Identity Verification completed', { id: toastId });
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5 MB');
      return;
    }

    setPhotoFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setPhotoBase64(base64);
    };
    reader.onerror = () => {
      toast.error('Failed to read photo file');
    };
    reader.readAsDataURL(file);
  };

  const handleRunIdvWithPhoto = async () => {
    if (!photoBase64) {
      toast.error('Please upload a photo first');
      return;
    }

    setIsRunningPhoto(true);
    setPhotoResult(null);
    const toastId = toast.loading('Running IDV with Photo verification...');

    try {
      const data = await api.post<{
        data?: Record<string, unknown>;
        matterId?: string;
        checkType?: string;
      }>(`/integrations/honeycomb/idv/with-photo`, {
        clientId,
        firstName,
        lastName,
        idNumber,
        passport,
        photo: photoBase64,
      });

      setPhotoResult({
        success: true,
        data: data.data,
        matterId: data.matterId,
        checkType: data.checkType,
      });
      toast.success('IDV with Photo completed', { id: toastId });
      loadHistory();
      onCheckComplete?.();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Network error';
      setPhotoResult({ success: false, error: errMsg });
      toast.error(errMsg, { id: toastId });
    } finally {
      setIsRunningPhoto(false);
    }
  };

  const maskedId = idNumber
    ? `${idNumber.substring(0, 6)}•••••${idNumber.substring(idNumber.length - 2)}`
    : null;
  const latestMatterId = photoResult?.matterId ?? result?.matterId ?? history[0]?.matterId ?? null;

  return (
    <div className="space-y-4">
      {/* Design CM-K-Identity: identification, the two checks side by side, then history. */}
      <PanelCard title="Client identification">
        <dl className="grid gap-4 sm:grid-cols-3">
          <IdField label="SA ID" value={maskedId} mono />
          <IdField
            label="Passport"
            value={passport ? `${passport.substring(0, 3)}•••` : null}
            mono
          />
          <IdField label="Matter ID" value={latestMatterId} mono />
        </dl>
      </PanelCard>

      {!hasIdentification && (
        <Notice kind="attention" title="No ID or passport number on file.">
          Add one to the client&apos;s profile before running identity checks.
        </Notice>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <PanelCard title="IDV check">
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-nw-ink">
              <input
                type="checkbox"
                checked={includeSecondary}
                onChange={(e) => setIncludeSecondary(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Include secondary verification sources
            </label>
            <Button onClick={handleRunIdv} disabled={isRunning || !hasIdentification}>
              {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Run IDV check
            </Button>
            {result && (
              <CheckResult
                result={result}
                successLabel="Verification complete"
                failureLabel="Verification failed"
                showDetails={showDetails}
                onToggleDetails={() => setShowDetails(!showDetails)}
              />
            )}
          </div>
        </PanelCard>

        <PanelCard title="IDV with photo">
          <div className="space-y-4">
            <label className="block cursor-pointer">
              <span
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  photoBase64
                    ? 'border-nw-violet/40 bg-nw-violet/5'
                    : 'border-gray-300 hover:border-nw-violet/50'
                }`}
              >
                <span className="text-sm font-semibold text-nw-ink">Client photo</span>
                <span className="text-xs text-nw-text-3">
                  {photoFileName
                    ? `${photoFileName} · ${Math.round(((photoBase64?.length ?? 0) * 0.75) / 1024)} KB`
                    : 'Click to upload photo (JPG, PNG — max 5 MB)'}
                </span>
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="sr-only"
                aria-label="Client photo"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={handleRunIdvWithPhoto}
                disabled={isRunningPhoto || !hasIdentification || !photoBase64}
              >
                {isRunningPhoto && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Run IDV with photo
              </Button>
              {photoBase64 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPhotoBase64(null);
                    setPhotoFileName(null);
                  }}
                >
                  Clear photo
                </Button>
              )}
            </div>
            {photoResult && (
              <CheckResult
                result={photoResult}
                successLabel="Photo verification complete"
                failureLabel="Photo verification failed"
                showDetails={showPhotoDetails}
                onToggleDetails={() => setShowPhotoDetails(!showPhotoDetails)}
                photoMatch={
                  photoResult.data?.photoMatch === undefined
                    ? undefined
                    : !!photoResult.data.photoMatch
                }
              />
            )}
          </div>
        </PanelCard>
      </div>

      <PanelCard title="History">
        {isLoadingHistory ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" aria-hidden="true" />
          </div>
        ) : history.length === 0 ? (
          <p className="py-2 text-sm text-nw-text-3">
            No identity checks have been run for this client yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-nw-bg text-left text-xs font-medium text-nw-text-3">
                  <th scope="col" className="px-3 py-2.5">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Check
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-t border-nw-line align-top">
                    <td className="px-3 py-3 whitespace-nowrap text-nw-ink">
                      {new Date(entry.submittedAt).toLocaleString('en-ZA', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-3 text-nw-ink">
                      {entry.checkType.startsWith('idv_with_photo')
                        ? 'IDV with photo'
                        : 'Identity verification'}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill tone={checkStatusTone(entry.status)}>
                        {entry.status === 'completed'
                          ? 'Verification complete'
                          : entry.status === 'failed'
                            ? 'Failed'
                            : entry.status}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-3 text-nw-text-2">{entry.summary || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>
    </div>
  );
}

function IdField({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-nw-text-3">{label}</dt>
      <dd
        className={`mt-1 text-sm ${value ? 'text-nw-ink' : 'text-nw-text-3'} ${mono && value ? 'font-mono' : ''}`}
      >
        {value ?? 'Not set'}
      </dd>
    </div>
  );
}

function CheckResult({
  result,
  successLabel,
  failureLabel,
  showDetails,
  onToggleDetails,
  photoMatch,
}: {
  result: IdvResult;
  successLabel: string;
  failureLabel: string;
  showDetails: boolean;
  onToggleDetails: () => void;
  photoMatch?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-nw-line p-3 text-sm">
      <StatusPill tone={result.success ? 'good' : 'bad'}>
        {result.success ? successLabel : failureLabel}
      </StatusPill>
      {result.error && <p className="text-xs text-red-700">{result.error}</p>}
      {photoMatch !== undefined && (
        <p className={`text-xs font-medium ${photoMatch ? 'text-emerald-700' : 'text-amber-700'}`}>
          {photoMatch ? 'Photo matches bureau records' : 'Photo match inconclusive or failed'}
        </p>
      )}
      {result.success && (
        <>
          {result.matterId && (
            <p className="text-xs text-nw-text-2">
              Matter ID <span className="font-mono text-nw-ink">{result.matterId}</span>
            </p>
          )}
          <button
            type="button"
            onClick={onToggleDetails}
            className="text-xs font-medium text-nw-violet hover:underline"
          >
            {showDetails ? 'Hide' : 'Show'} full response
          </button>
          {showDetails && (
            <pre className="max-h-48 overflow-auto rounded bg-gray-900 p-2 font-mono text-xs text-gray-100">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
