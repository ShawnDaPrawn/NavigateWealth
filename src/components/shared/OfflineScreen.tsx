/**
 * Full-screen "no connection" state for the signed-in app.
 *
 * Every screen behind a sign-in is server-backed, so without a connection the
 * app cannot do anything useful — before this it simply sat on skeletons, and
 * the admin sidebar collapsed to the two modules that need no permission check.
 *
 * The page underneath stays MOUNTED (only covered and made inert), so a
 * half-filled form survives a dropped connection; React Query pauses while
 * disconnected and refetches on its own once the connection returns.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloudOff, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { useConnectivity } from '../../hooks/useConnectivity';
import { checkConnectivityNow } from '../../utils/network/connectivity';

/** Short drops (Wi-Fi roaming, a router blip) recover on their own; don't flash a takeover for them. */
export const OFFLINE_SCREEN_DELAY_MS = 1500;
/** Keep "Checking…" up long enough to register, even when the answer is instant. */
const MIN_CHECK_MS = 600;

const COPY = {
  offline: {
    Icon: WifiOff,
    title: "You're offline",
    body: "Your device isn't connected to the internet. Navigate Wealth needs a connection to load and save your information.",
  },
  unreachable: {
    Icon: CloudOff,
    title: "Can't reach Navigate Wealth",
    body: "Your device is connected to a network, but that network can't reach the internet right now. Check that your router or mobile data has a working connection.",
  },
} as const;

interface OfflineScreenProps {
  /** When false this renders nothing, e.g. for pages that still read fine offline. */
  enabled?: boolean;
}

export function OfflineScreen({ enabled = true }: OfflineScreenProps) {
  const status = useConnectivity();
  const disconnected = enabled && status !== 'online';
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stillDown, setStillDown] = useState(false);
  const shownRef = useRef(false);
  const retryRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    if (!disconnected) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), OFFLINE_SCREEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [disconnected]);

  // While shown, nothing behind it should take focus or be read out, and the
  // retry button is where keyboard users land.
  useEffect(() => {
    if (!visible) return;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    retryRef.current?.focus();
    return () => root?.removeAttribute('inert');
  }, [visible]);

  // The page underneath is about to refresh itself; tell the user why.
  useEffect(() => {
    if (visible) {
      shownRef.current = true;
      return;
    }
    if (!shownRef.current) return;
    shownRef.current = false;
    setStillDown(false);
    if (status === 'online') toast.success("You're back online");
  }, [visible, status]);

  const handleRetry = async () => {
    if (checking) return;
    setChecking(true);
    setStillDown(false);
    const [connected] = await Promise.all([
      checkConnectivityNow(),
      new Promise((resolve) => setTimeout(resolve, MIN_CHECK_MS)),
    ]);
    setChecking(false);
    if (!connected) setStillDown(true);
  };

  if (!visible || !disconnected) return null;

  const { Icon, title, body } = status === 'offline' ? COPY.offline : COPY.unreachable;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-50/90 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Icon className="size-8 text-primary" aria-hidden="true" />
        </div>

        <h2 id={titleId} className="text-xl font-semibold text-gray-900">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-relaxed text-gray-600">
          {body}
        </p>

        <div
          className="mt-6 flex min-h-5 items-center justify-center gap-2 text-sm text-gray-500"
          aria-live="polite"
        >
          {stillDown ? (
            <span>Still no connection. We&apos;ll keep trying in the background.</span>
          ) : (
            <>
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              <span>Reconnecting automatically…</span>
            </>
          )}
        </div>

        <Button
          ref={retryRef}
          onClick={handleRetry}
          aria-disabled={checking}
          className="mt-6 w-full"
        >
          {checking ? (
            <>
              <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
              Checking…
            </>
          ) : (
            <>
              <RefreshCw aria-hidden="true" />
              Try again
            </>
          )}
        </Button>

        <p className="mt-4 text-xs leading-relaxed text-gray-500">
          Keep this tab open — the page you were on is still here and will refresh once you&apos;re
          reconnected.
        </p>
      </div>
    </div>,
    document.body,
  );
}
