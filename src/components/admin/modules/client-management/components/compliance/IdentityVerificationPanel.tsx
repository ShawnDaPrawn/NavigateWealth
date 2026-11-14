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
import { PanelCard } from './ComplianceShared';
import { CheckHistoryCard, CheckResult, ClientIdentificationCard } from './CheckBlocks';
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

import type { CheckHistoryEntry, CheckRunResult as IdvResult } from './CheckBlocks';

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

  const latestMatterId = photoResult?.matterId ?? result?.matterId ?? history[0]?.matterId ?? null;

  return (
    <div className="space-y-4">
      {/* Design CM-K-Identity: identification, the two checks side by side, then history. */}
      <ClientIdentificationCard idNumber={idNumber} passport={passport} matterId={latestMatterId} />

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

      <CheckHistoryCard
        loading={isLoadingHistory}
        history={history}
        emptyText="No identity checks have been run for this client yet."
        checkLabel={(entry) =>
          entry.checkType.startsWith('idv_with_photo') ? 'IDV with photo' : 'Identity verification'
        }
        completeLabel="Verification complete"
      />
    </div>
  );
}
