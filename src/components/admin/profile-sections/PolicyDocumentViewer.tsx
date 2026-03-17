/**
 * POLICY DOCUMENT VIEWER
 *
 * Full-screen dialog for viewing uploaded policy documents (PDFs) inline
 * within the admin panel. Uses an iframe to render the signed URL from
 * Supabase Storage. Provides download-to-new-tab fallback and document
 * metadata display.
 *
 * @module PolicyDocumentViewer
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  FileText,
  ExternalLink,
  Loader2,
  AlertCircle,
  Download,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { createClient } from '../../../utils/supabase/client';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

/** Minimal document meta needed for display */
export interface ViewerDocumentMeta {
  fileName: string;
  fileSize: number;
  documentType?: string;
  uploadDate?: string;
}

interface PolicyDocumentViewerProps {
  /** Controls dialog visibility */
  open: boolean;
  /** Called when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Policy ID to fetch the document for */
  policyId: string;
  /** Client ID that owns the policy */
  clientId: string;
  /** Optional provider name for the dialog title */
  providerName?: string;
  /** Pre-loaded document metadata (avoids needing a separate fetch) */
  documentMeta?: ViewerDocumentMeta | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  policy_schedule: 'Policy Schedule',
  amendment: 'Amendment',
  statement: 'Statement',
  benefit_summary: 'Benefit Summary',
  other: 'Other',
};

export function PolicyDocumentViewer({
  open,
  onOpenChange,
  policyId,
  clientId,
  providerName,
  documentMeta,
}: PolicyDocumentViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [docInfo, setDocInfo] = useState<ViewerDocumentMeta | null>(documentMeta || null);

  const getAuthToken = useCallback(async (): Promise<string> => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || publicAnonKey;
  }, []);

  const fetchSignedUrl = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSignedUrl(null);

    try {
      const token = await getAuthToken();
      const res = await fetch(
        `${API_BASE}/policy-documents/download?policyId=${encodeURIComponent(policyId)}&clientId=${encodeURIComponent(clientId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load document (${res.status})`);
      }

      const data = await res.json();
      setSignedUrl(data.url);

      // Update doc info from server response if we didn't have it
      if (data.document && !docInfo) {
        setDocInfo({
          fileName: data.document.fileName,
          fileSize: data.document.fileSize,
          documentType: data.document.documentType,
          uploadDate: data.document.uploadDate,
        });
      }
    } catch (err: unknown) {
      console.error('Policy document viewer error:', err);
      setError((err as Error)?.message || 'Failed to load document');
    } finally {
      setIsLoading(false);
    }
  }, [policyId, clientId, getAuthToken, docInfo]);

  // Fetch signed URL when dialog opens
  useEffect(() => {
    if (open) {
      setDocInfo(documentMeta || null);
      fetchSignedUrl();
    } else {
      // Cleanup when closing
      setSignedUrl(null);
      setError(null);
      setIsFullscreen(false);
    }
  }, [open, policyId, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenExternal = () => {
    if (signedUrl) window.open(signedUrl, '_blank');
  };

  const titleText = providerName
    ? `Document — ${providerName}`
    : 'Policy Document';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${
          isFullscreen
            ? 'fixed inset-4 max-w-none w-auto h-auto translate-x-0 translate-y-0 top-0 left-0'
            : 'max-w-5xl w-[90vw] h-[85vh]'
        } flex flex-col p-0 gap-0 overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50/80 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-gray-800 truncate">
                {titleText}
              </DialogTitle>
              {docInfo && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-gray-500 truncate max-w-[200px]">
                    {docInfo.fileName}
                  </span>
                  <span className="text-gray-300 text-[10px]">|</span>
                  <span className="text-[11px] text-gray-400">
                    {formatFileSize(docInfo.fileSize)}
                  </span>
                  {docInfo.documentType && (
                    <div className="contents">
                      <span className="text-gray-300 text-[10px]">|</span>
                      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[9px] px-1.5 py-0">
                        {DOC_TYPE_LABELS[docInfo.documentType] || docInfo.documentType}
                      </Badge>
                    </div>
                  )}
                  {docInfo.uploadDate && (
                    <div className="contents">
                      <span className="text-gray-300 text-[10px]">|</span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(docInfo.uploadDate).toLocaleDateString('en-ZA', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 ml-3">
            {signedUrl && (
              <div className="contents">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenExternal}
                  title="Open in new tab"
                  className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-gray-100 relative">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-3" />
              <p className="text-sm text-gray-500">Loading document...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10">
              <div className="bg-white rounded-lg border border-red-200 p-6 max-w-sm text-center shadow-sm">
                <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-800 mb-1">Unable to load document</p>
                <p className="text-xs text-gray-500 mb-4">{error}</p>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={fetchSignedUrl}>
                    Try Again
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="text-gray-500"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}

          {signedUrl && !error && (
            <iframe
              src={signedUrl}
              title={docInfo?.fileName || 'Policy Document'}
              className="w-full h-full border-0"
              style={{ minHeight: '100%' }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
