/**
 * useSignedCopyDownload — "Download Copy" on the signing-complete page: the
 * signed PDF fetched from the signer download route and saved under the
 * envelope's title.
 *
 * Shared by the live page and the Navigator redesign
 * (src/site/sections/ESignComplete.tsx) so both make the same request and
 * differ only in how the page is drawn.
 *
 * Three things this used to get wrong, all at once (2026-11-23):
 * - It downloaded with the signing token, which the server rotates the
 *   moment the signer submits — so every press answered 404.
 *   It now uses the download-only grant the submit response carries
 *   (`sessionData.download_token`), falling back to the token for a signer
 *   who reopened an already-completed envelope.
 * - The final signer lands here while the signed copy is still being sealed
 *   in the background. The route now says so (409, `retryable`), and the
 *   hook waits for it instead of giving up.
 * - Failures were swallowed: the button spun and nothing happened. The hook
 *   now returns a `notice` for the page to show.
 */
import { useEffect, useRef, useState } from 'react';
import type { SignerSessionData } from '../types';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

/** How often, and for how long, to wait for a copy that is being sealed. */
const PREPARE_POLL_MS = 3000;
const PREPARE_TIMEOUT_MS = 90_000;

export interface SignedCopyNotice {
  tone: 'info' | 'error';
  text: string;
}

const NOT_YET: SignedCopyNotice = {
  tone: 'info',
  text: 'Your signed copy will be available once everyone has signed. We will email it to you.',
};

function saveBlob(blob: Blob, title: string | undefined) {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `${title || 'signed_document'}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(blobUrl);
  document.body.removeChild(a);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useSignedCopyDownload({
  sessionData,
  token,
}: {
  sessionData: SignerSessionData | null;
  token: string;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [notice, setNotice] = useState<SignedCopyNotice | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  // The submit response says whether this signer was the last one. When
  // others still have to sign there is nothing to download yet.
  const available = sessionData?.envelope_complete !== false;
  const downloadKey = sessionData?.download_token || token;

  const handleDownload = async () => {
    if (!downloadKey) return;
    if (!available) {
      setNotice(NOT_YET);
      return;
    }
    setIsDownloading(true);
    setNotice(null);

    const url = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/esign/signer/download/${encodeURIComponent(downloadKey)}`;
    const deadline = Date.now() + PREPARE_TIMEOUT_MS;

    try {
      for (;;) {
        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });

        if (response.ok) {
          saveBlob(await response.blob(), sessionData?.envelope_title);
          if (mounted.current) setNotice(null);
          return;
        }

        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          retryable?: boolean;
        };

        if (response.status === 409 && body.retryable && Date.now() < deadline) {
          if (mounted.current) {
            setNotice({
              tone: 'info',
              text: 'Preparing your signed copy. This usually takes a few seconds…',
            });
          }
          await wait(PREPARE_POLL_MS);
          if (!mounted.current) return;
          continue;
        }

        if (mounted.current) {
          setNotice(
            response.status === 409 && !body.retryable
              ? NOT_YET
              : {
                  tone: 'error',
                  text: body.retryable
                    ? 'Your signed copy is taking longer than usual. It will be emailed to you as soon as it is ready.'
                    : body.error ||
                      'We could not download your signed copy. It has also been emailed to you.',
                },
          );
        }
        return;
      }
    } catch (err) {
      console.error('Download failed:', err);
      if (mounted.current) {
        setNotice({
          tone: 'error',
          text: 'Download failed. Please check your connection and try again.',
        });
      }
    } finally {
      if (mounted.current) setIsDownloading(false);
    }
  };

  return { isDownloading, handleDownload, notice, available };
}
