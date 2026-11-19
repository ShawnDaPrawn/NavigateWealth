/**
 * The redesigned legal document page's data: the same request the live page
 * makes, and the two small changes the board makes to how a document is laid
 * out (never to what it says).
 */
import { useEffect, useState } from 'react';
import { projectId } from '../../utils/supabase/info';
import type { PublicLegalDocumentResponse } from '../../components/pages/legalDocumentContent';

const LEGAL_DOCUMENT_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/resources/legal`;

export function legalDocumentUrl(slug: string): string {
  return `${LEGAL_DOCUMENT_URL}/${slug}`;
}

/**
 * The live page's request and states, message for message: loading until the
 * answer arrives; "not available yet" when the route has no published
 * version; the HTTP status or the network's own message when it fails.
 */
export function useLegalDocument(slug: string | undefined) {
  const [documentResponse, setDocumentResponse] = useState<PublicLegalDocumentResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDocument() {
      if (!slug) {
        setError('Legal document not found');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // A public route (no auth middleware, and the function runs with
        // verify_jwt = false), so no bearer: see anon-key-bearer-ratchet.test.ts.
        const res = await fetch(legalDocumentUrl(slug));

        if (!res.ok) {
          throw new Error(`Failed to fetch document (${res.status})`);
        }

        const data = (await res.json()) as PublicLegalDocumentResponse;
        if (!active) return;

        if (!data.available || !data.document) {
          setError('This legal document is not available yet.');
        }
        setDocumentResponse(data);
      } catch (fetchError) {
        if (!active) return;
        setError(
          fetchError instanceof Error ? fetchError.message : 'Unable to load legal document',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDocument();
    return () => {
      active = false;
    };
  }, [slug]);

  return { documentResponse, loading, error };
}

/**
 * The page has one H1, the document's title, so a heading the document marks
 * as H1 is shown as H2, as the board shows it. Ids and text are untouched, so
 * the contents list and its links are the live page's.
 */
export function demoteDocumentHeadings(html: string): string {
  if (typeof window === 'undefined' || !html.includes('<h1')) return html;
  const doc = new window.DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll('h1').forEach((h1) => {
    const h2 = doc.createElement('h2');
    for (const attr of Array.from(h1.attributes)) h2.setAttribute(attr.name, attr.value);
    while (h1.firstChild) h2.appendChild(h1.firstChild);
    h1.replaceWith(h2);
  });
  return doc.body.innerHTML;
}

/**
 * Whether a contents entry is indented as a subsection. As on the board, a
 * document whose top headings are all H3s lists them flush; otherwise an
 * entry below level 2 is indented.
 */
export function tocIndents(toc: ReadonlyArray<{ level: number }>): boolean[] {
  const hasTopLevel = toc.some((entry) => entry.level <= 2);
  return toc.map((entry) => hasTopLevel && entry.level > 2);
}

/** How far down a section heading lands, clear of the sticky header (the board's 96px). */
export const HEADING_OFFSET = 96;

/** Once the reader is this far down, the back-to-top button appears (live and board). */
export const BACK_TO_TOP_AFTER = 1200;

/** Reading progress through the page, 0–100, as the board's bar draws it. */
export function readingProgress(scrollY: number, scrollHeight: number, viewport: number): number {
  const max = Math.max(1, scrollHeight - viewport);
  return Math.min(100, Math.max(0, Math.round((scrollY / max) * 100)));
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** "A4 · Portrait · Version 1.1", the preview's subtitle. */
export function pdfMetaLine(
  config: { pageSize: string; orientation: string } | undefined,
  version: string,
): string {
  const pageSize = config?.pageSize || 'A4';
  const orientation = config?.orientation || 'portrait';
  return `${pageSize} · ${orientation.charAt(0).toUpperCase()}${orientation.slice(1)} · Version ${version}`;
}
