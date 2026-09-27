/**
 * Turn a caller-supplied redirect target into a same-origin path, or null.
 *
 * The login page used to accept any `returnUrl` that started with `/` and not
 * `//`. Browsers treat a backslash as a slash in http(s) URLs, so
 * `/\evil.example` passed that check and then resolved to the host after the
 * backslash — another site entirely. An open redirect off a sign-in link is the
 * classic phishing hop ("sign in to Navigate Wealth" → a look-alike page).
 *
 * The target is resolved the way the browser will resolve it and kept only if
 * it lands on `origin`. What is returned is the resolved path, search and
 * hash, never the raw input, so no spelling the browser would read differently
 * survives.
 */
export function safeInternalPath(target: string | null | undefined, origin: string): string | null {
  if (!target) return null;
  // Absolute URLs, protocol-relative forms and schemes such as `javascript:`
  // are refused outright; only a path is an acceptable return target.
  if (!target.startsWith('/')) return null;

  let resolved: URL;
  try {
    resolved = new URL(target, origin);
  } catch {
    return null;
  }
  if (resolved.origin !== new URL(origin).origin) return null;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
