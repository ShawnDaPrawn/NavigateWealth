/**
 * useSignedCopyDownload — "Download Copy" on the signing-complete page: the
 * signed PDF fetched from the signer download route and saved under the
 * envelope's title.
 *
 * Moved verbatim out of SigningCompletePage.tsx so the live page and the
 * Navigator redesign (src/site/sections/ESignComplete.tsx) make the same
 * request and differ only in how the page is drawn.
 */
import { useState } from 'react';
import type { SignerSessionData } from '../types';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

export function useSignedCopyDownload({
  sessionData,
  token,
}: {
  sessionData: SignerSessionData | null;
  token: string;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!token) return;
    setIsDownloading(true);

    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/esign/signer/download/${encodeURIComponent(token)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${sessionData?.envelope_title || 'signed_document'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return { isDownloading, handleDownload };
}
