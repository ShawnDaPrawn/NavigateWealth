/**
 * Where the central component library is served, and the messages its page
 * (design-system/untitled-ui-react/src/showcase/showcase.tsx) sends the
 * /design-system page that embeds it.
 */

export const LIBRARY_PATH = '/design-system-library/';

/** Selects the meta tag the library's page carries, so a fallback page is never kept. */
export const LIBRARY_MARKER = 'meta[name="nw-design-system-library"]';

export type LibraryMessage =
  | { source: 'nw-design-system'; type: 'height'; height: number }
  | { source: 'nw-design-system'; type: 'scrollTo'; top: number };

export function isLibraryMessage(data: unknown): data is LibraryMessage {
  if (typeof data !== 'object' || data === null) return false;
  const message = data as Record<string, unknown>;
  if (message.source !== 'nw-design-system') return false;
  if (message.type === 'height') return typeof message.height === 'number';
  if (message.type === 'scrollTo') return typeof message.top === 'number';
  return false;
}
