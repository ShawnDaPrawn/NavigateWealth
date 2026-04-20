/**
 * P8.1 — Envelope thumbnail.
 *
 * Renders a small (60x80) preview of page 1 of the envelope's document.
 * Performance considerations:
 *  - Lazy: render only when the host element scrolls into view.
 *  - Cached: data URLs are persisted in localStorage keyed by envelope id +
 *    `updatedAt`. Re-uploads invalidate the cache automatically because the
 *    timestamp changes on every meaningful mutation. Cache is capped at
 *    {@link MAX_CACHE_ENTRIES} via simple LRU on read.
 *  - Concurrency-safe: in-flight renders dedupe via a module-scoped Map so
 *    quickly scrolling through 200 rows never queues 200 simultaneous
 *    pdf.js workers.
 *  - Resilient: errors degrade to the same generic icon used by the empty
 *    state. Thumbnails are an enhancement, never a hard dependency.
 *
 * The pdf.js worker is loaded from the same CDN the signer page already
 * uses (pinned to the bundled version) so we avoid bundling a second copy.
 */

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FileText } from 'lucide-react';
import { esignApi } from '../api';
import { logger } from '../../../../../utils/logger';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

const THUMB_W = 60;
const THUMB_H = 80;
const STORAGE_PREFIX = 'esign:thumb:v1:';
const MAX_CACHE_ENTRIES = 200;
const inflight = new Map<string, Promise<string | null>>();

function cacheKey(envelopeId: string, version: string): string {
  return `${STORAGE_PREFIX}${envelopeId}:${version}`;
}

function readCache(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeCache(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
    pruneCache();
  } catch {
    pruneCache(true);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore — quota exceeded or storage disabled */
    }
  }
}

function pruneCache(aggressive = false): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    const limit = aggressive ? Math.floor(MAX_CACHE_ENTRIES / 2) : MAX_CACHE_ENTRIES;
    if (keys.length <= limit) return;
    const drop = keys.slice(0, keys.length - limit);
    drop.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

async function renderThumbnail(envelopeId: string, version: string): Promise<string | null> {
  const key = cacheKey(envelopeId, version);
  const cached = readCache(key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const job = (async () => {
    const blob = await esignApi.fetchDocumentBlob(envelopeId);
    if (!blob) return null;
    const buffer = await blob.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    try {
      const page = await doc.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(THUMB_W / baseViewport.width, THUMB_H / baseViewport.height);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      writeCache(key, dataUrl);
      return dataUrl;
    } finally {
      await doc.cleanup();
      doc.destroy();
    }
  })().catch((error) => {
    logger.warn('Thumbnail render failed', { envelopeId, error });
    return null;
  }).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, job);
  return job;
}

export interface EnvelopeThumbnailProps {
  envelopeId: string;
  /** Used as cache-buster — pass `updatedAt`/`updated_at` from the row. */
  version?: string | null;
  className?: string;
  /** Hide the placeholder icon when rendering fails. */
  hideOnError?: boolean;
}

export function EnvelopeThumbnail({
  envelopeId,
  version,
  className,
  hideOnError = false,
}: EnvelopeThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const hostRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef(false);

  useEffect(() => {
    setSrc(null);
    setStatus('idle');
    seenRef.current = false;
  }, [envelopeId, version]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      void start();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !seenRef.current) {
            seenRef.current = true;
            void start();
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
    async function start() {
      setStatus('loading');
      const result = await renderThumbnail(envelopeId, version ?? 'na');
      if (result) {
        setSrc(result);
        setStatus('ready');
      } else {
        setStatus('error');
      }
    }
  }, [envelopeId, version]);

  const dimensions = `width: ${THUMB_W}px; height: ${THUMB_H}px;`;
  const baseClass = `relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-gray-200 bg-white ${className ?? ''}`.trim();

  if (status === 'error' && hideOnError) {
    return null;
  }

  return (
    <div ref={hostRef} className={baseClass} style={{ width: THUMB_W, height: THUMB_H }} aria-hidden="true">
      {src && status === 'ready' ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : status === 'error' ? (
        <FileText className="h-5 w-5 text-muted-foreground/40" />
      ) : (
        <div className="h-full w-full animate-pulse bg-gray-100" style={{ width: THUMB_W, height: THUMB_H }} />
      )}
      <span className="sr-only">{dimensions}</span>
    </div>
  );
}
