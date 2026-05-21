/**
 * Converts a full Edge Function URL into a relative path for the API client.
 * Accepts paths that are already relative (start with /).
 */
const EDGE_FUNCTION_MARKER = '/functions/v1/make-server-91ed8379';

export function resolveApiEndpoint(urlOrPath: string): string {
  if (urlOrPath.startsWith('/')) {
    return urlOrPath;
  }

  try {
    const parsed = new URL(urlOrPath);
    const markerIndex = parsed.pathname.indexOf(EDGE_FUNCTION_MARKER);
    if (markerIndex >= 0) {
      const suffix = parsed.pathname.slice(markerIndex + EDGE_FUNCTION_MARKER.length);
      const query = parsed.search || '';
      return `${suffix || '/'}${query}`;
    }
  } catch {
    // Not a valid URL — return as-is and let the API client surface the error.
  }

  return urlOrPath;
}
