import { useEffect } from 'react';

type PrefetchOptions = {
  /** Delay before scheduling idle prefetch (ms). */
  delayMs?: number;
  /** requestIdleCallback timeout (ms). */
  idleTimeoutMs?: number;
  /** Disable prefetch entirely. */
  enabled?: boolean;
};

function shouldPrefetch() {
  const nav: any = navigator;
  const connection = nav?.connection;

  // Respect user data saver / constrained networks.
  if (connection?.saveData) return false;
  const effectiveType: string | undefined = connection?.effectiveType;
  if (effectiveType && ['slow-2g', '2g', '3g'].includes(effectiveType)) return false;

  return true;
}

export function prefetchImages(urls: string[]) {
  if (typeof window === 'undefined') return;
  if (!shouldPrefetch()) return;

  urls.forEach((url) => {
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = url;
  });
}

export function useImagePrefetch(urls: string[], options: PrefetchOptions = {}) {
  const { delayMs = 2500, idleTimeoutMs = 3000, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (!urls.length) return;
    if (!shouldPrefetch()) return;

    const run = () => prefetchImages(urls);

    const timeoutId = window.setTimeout(() => {
      const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout: number }) => number);
      if (ric) {
        const id = ric(run, { timeout: idleTimeoutMs });
        return () => (window as any).cancelIdleCallback?.(id);
      }

      run();
      return undefined;
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [enabled, delayMs, idleTimeoutMs, urls]);
}

