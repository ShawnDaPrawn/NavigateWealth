/**
 * Identity Verification Panel
 *
 * Runs IDV checks against the correct Honeycomb endpoint:
 *   POST /natural-person-idv-no-photo-no-upload
 *
 * Replaces the old broken /reports/idv endpoint that was guessing paths.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Label } from '../../../../../ui/label';
import {
  UserCheck,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Shield,
  History,
  Camera,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../../../../../../utils/supabase/info';
import { getAuthToken } from './compliance-auth';
import { Input } from '../../../../../ui/input';

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

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/honeycomb`;

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
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [clientId]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/checks/history/${clientId}/idv_no_photo`, {
        headers: { Authorization: `Bearer ${await getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('[IDV Panel] Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleRunIdv = async () => {
    setIsRunning(true);
    setResult(null);
    const toastId = toast.loading('Running Identity Verification...');

    try {
      const res = await fetch(`${API_BASE}/idv/no-photo`, {
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
          secondary: includeSecondary,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error);
        setResult({ success: false, error: errMsg });
        toast.error(errMsg, { id: toastId });
        return;
      }

      setResult({ success: true, data: data.data, matterId: data.matterId, checkType: data.checkType });
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
      const res = await fetch(`${API_BASE}/idv/with-photo`, {
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
          photo: photoBase64,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error);
        setPhotoResult({ success: false, error: errMsg });
        toast.error(errMsg, { id: toastId });
        return;
      }

      setPhotoResult({ success: true, data: data.data, matterId: data.matterId, checkType: data.checkType });
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

  return (
    <div className="space-y-4">
      {/* IDV Action Card */}
      <Card className="bg-blue-50/50 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-medium flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-600" />
            Identity Verification (IDV)
          </CardTitle>
          <CardDescription>
            Verify the client's identity using their SA ID number or passport via the
            Honeycomb bureau integration. This creates a matter and runs a real-time IDV check.
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

          {/* Secondary sources toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeSecondary}
              onChange={(e) => setIncludeSecondary(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-gray-600">Include secondary verification sources</span>
          </label>

          {!hasIdentification && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                No valid ID number or passport on file. Update the client's profile before running IDV.
              </p>
            </div>
          )}

          <Button
            className="w-full"
            variant="secondary"
            onClick={handleRunIdv}
            disabled={isRunning || !hasIdentification}
          >
            {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Shield className="mr-2 h-4 w-4" />
            Run IDV Check
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
                  {result.success ? 'Verification Complete' : 'Verification Failed'}
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

      {/* ──── Phase 3: IDV with Photo ──── */}
      <Card className="bg-purple-50/50 border-purple-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-medium flex items-center gap-2">
            <Camera className="h-5 w-5 text-purple-600" />
            IDV with Photo Verification
          </CardTitle>
          <CardDescription>
            Enhanced identity verification that includes facial comparison. Upload a photo of the
            client (passport photo, selfie, or ID document photo) to match against bureau records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Photo upload */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Client Photo</Label>
            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer">
                <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed transition-colors ${
                  photoBase64
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50'
                }`}>
                  <Upload className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {photoFileName || 'Click to upload photo (JPG, PNG — max 5 MB)'}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
              {photoBase64 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setPhotoBase64(null); setPhotoFileName(null); }}
                  className="text-xs text-gray-500"
                >
                  Clear
                </Button>
              )}
            </div>
            {photoBase64 && (
              <div className="flex items-center gap-2 text-xs text-green-700">
                <CheckCircle className="h-3 w-3" />
                Photo loaded ({Math.round(photoBase64.length * 0.75 / 1024)} KB)
              </div>
            )}
          </div>

          {!hasIdentification && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Client ID/passport required for photo IDV.
              </p>
            </div>
          )}

          <Button
            className="w-full"
            variant="secondary"
            onClick={handleRunIdvWithPhoto}
            disabled={isRunningPhoto || !hasIdentification || !photoBase64}
          >
            {isRunningPhoto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Camera className="mr-2 h-4 w-4" />
            Run IDV with Photo
          </Button>

          {!photoBase64 && hasIdentification && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Upload className="h-3 w-3" />
              Upload a photo above to enable this check.
            </p>
          )}

          {/* Photo IDV Result */}
          {photoResult && (
            <div className={`rounded-lg p-3 text-sm ${
              photoResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2 font-medium">
                {photoResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className={photoResult.success ? 'text-green-800' : 'text-red-800'}>
                  {photoResult.success ? 'Photo Verification Complete' : 'Photo Verification Failed'}
                </span>
              </div>

              {photoResult.error && (
                <p className="mt-1 text-red-700 text-xs">{photoResult.error}</p>
              )}

              {photoResult.success && (
                <div className="mt-2 space-y-1">
                  {photoResult.matterId && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <span>Matter ID:</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {photoResult.matterId}
                      </Badge>
                    </div>
                  )}

                  {/* Photo match indicator */}
                  {photoResult.data?.photoMatch !== undefined && (
                    <div className="flex items-center gap-1 text-xs mt-1">
                      {photoResult.data.photoMatch ? (
                        <div className="contents">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span className="text-green-700 font-medium">Photo matches bureau records</span>
                        </div>
                      ) : (
                        <div className="contents">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          <span className="text-amber-700 font-medium">Photo match inconclusive or failed</span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setShowPhotoDetails(!showPhotoDetails)}
                    className="flex items-center gap-1 mt-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showPhotoDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showPhotoDetails ? 'Hide' : 'Show'} full response
                  </button>

                  {showPhotoDetails && (
                    <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-auto max-h-48 font-mono">
                      {JSON.stringify(photoResult.data, null, 2)}
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
              IDV Check History
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
                No IDV checks have been run for this client yet.
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