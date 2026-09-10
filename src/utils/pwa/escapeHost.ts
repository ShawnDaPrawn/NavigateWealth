import { SITE_ORIGIN_APEX_HOST } from '../siteOrigin';

/**
 * The apex host is the browser-only escape hatch for emailed article links.
 *
 * Emailed article links point at the apex precisely because it sits outside the
 * installed PWA's scope, so Android opens them in a real browser instead of
 * handing them to the app (see `SITE_ORIGIN_APEX`). That only holds while the
 * apex never becomes an installable app origin of its own: if a client installed
 * the site from the apex, Android would mint a second WebAPK covering the apex
 * and start capturing the very links this host exists to keep out of the app.
 *
 * So on the apex we deliberately do NOT register the service worker, do NOT
 * expose the manifest, and never show the install prompt. Installability is a
 * `www` concern; the apex only has to render the article.
 */
export function isArticleEscapeHost(hostname?: string): boolean {
  const host = hostname ?? (typeof window === 'undefined' ? '' : window.location.hostname);
  return host.toLowerCase() === SITE_ORIGIN_APEX_HOST;
}

/**
 * Removes the `<link rel="manifest">` declared in `index.html` when running on
 * the escape host, so the browser never treats the apex as installable.
 *
 * `index.html` is a single static shell served for every host, so the tag cannot
 * be omitted at build time — it is dropped at runtime instead. Chrome only reads
 * the manifest when the user reaches for "Add to home screen", which is well
 * after the app has mounted, so removing it here is early enough.
 */
export function removeManifestLinkOnEscapeHost(doc: Document = document): void {
  if (!isArticleEscapeHost()) return;
  doc.querySelectorAll('link[rel="manifest"]').forEach((link) => {
    link.remove();
  });
}
