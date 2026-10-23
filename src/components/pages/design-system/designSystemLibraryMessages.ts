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

/** Height of the site's sticky header, which covers the top of the window. */
export const STICKY_HEADER_HEIGHT = 72;

/**
 * The message this page sends the library: the part of the iframe that is on
 * screen, in the iframe's own pixels. The library pins its modals to it, since
 * the iframe is as tall as the whole library and a modal centred in it would
 * open far outside the visitor's window.
 */
export type HostViewportMessage = {
  source: 'nw-design-system-host';
  type: 'viewport';
  top: number;
  height: number;
};

export function viewportMessage(
  frame: { top: number; height: number },
  windowHeight: number,
): HostViewportMessage {
  const top = Math.min(frame.height, Math.max(0, STICKY_HEADER_HEIGHT - frame.top));
  const bottom = Math.max(top, Math.min(frame.height, windowHeight - frame.top));
  return { source: 'nw-design-system-host', type: 'viewport', top, height: bottom - top };
}
