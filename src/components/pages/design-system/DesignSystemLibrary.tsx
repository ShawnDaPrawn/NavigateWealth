/**
 * Embeds the central component library (design-system/untitled-ui-react) on the
 * /design-system page.
 *
 * The library is a separate React 19 app with its own theme, so it cannot be
 * rendered inside this React 18 page without restyling the site. It is built
 * to /design-system-library/ and shown here in a same-origin iframe instead.
 * The iframe never scrolls: the library reports its height, and asks this page
 * to scroll when one of its index links is clicked.
 */
import { useEffect, useRef, useState } from 'react';
import { isLibraryMessage, LIBRARY_MARKER, LIBRARY_PATH } from './designSystemLibraryMessages';

/** Room left above a section after a jump, for the site's sticky header. */
const HEADER_OFFSET = 96;

type Status = 'checking' | 'ready' | 'missing';

export function DesignSystemLibrary() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<Status>('checking');
  const [height, setHeight] = useState(1200);

  // Only keep the library if it was built. Otherwise the site's SPA fallback
  // answers and the iframe would show the site inside itself, so the loaded
  // page is checked for the library's marker (same origin, so it is readable).
  // Once the library has loaded, a later page without the marker means the
  // iframe was navigated away from it, so the library is loaded again.
  const onFrameLoad = () => {
    const frame = frameRef.current;
    let found = false;
    try {
      found = Boolean(frame?.contentDocument?.querySelector(LIBRARY_MARKER));
    } catch {
      // Another origin's page is unreadable, so it is not the library.
    }
    if (found) {
      setStatus('ready');
    } else if (status === 'ready' && frame) {
      frame.src = LIBRARY_PATH;
    } else {
      setStatus('missing');
    }
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      if (!isLibraryMessage(event.data)) return;
      if (event.data.type === 'height') {
        setHeight(Math.max(200, Math.ceil(event.data.height)));
      } else {
        // Clear the site's sticky header, which is about 70px tall.
        const frameTop = frameRef.current.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: frameTop + event.data.top - HEADER_OFFSET, behavior: 'smooth' });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (status === 'missing') {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 md:p-8">
        <h3 className="text-lg font-semibold text-gray-900">
          The component library is not built here
        </h3>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          The library is built alongside the site when it deploys. To see it locally, build it once
          with{' '}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
            npm run design-system:build
          </code>{' '}
          and preview the build, or run it on its own with{' '}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
            npm run design-system:dev
          </code>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      {status === 'checking' && (
        <div className="rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          Loading the component library…
        </div>
      )}
      <iframe
        ref={frameRef}
        src={LIBRARY_PATH}
        title="Navigate Wealth component library"
        onLoad={onFrameLoad}
        className={status === 'ready' ? 'block w-full border-0' : 'sr-only'}
        style={status === 'ready' ? { height } : undefined}
        aria-hidden={status === 'ready' ? undefined : true}
      />
    </>
  );
}
