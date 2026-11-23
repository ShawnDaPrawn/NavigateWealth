/**
 * Full-screen "no connection" state for the signed-in app, in the Navigator design.
 *
 * Every screen behind a sign-in is server-backed, so without a connection the
 * app cannot do anything useful — before this it simply sat on skeletons, and
 * the admin sidebar collapsed to the two modules that need no permission check.
 *
 * The page underneath stays MOUNTED (only covered and made inert), so a
 * half-filled form survives a dropped connection; React Query pauses while
 * disconnected and refetches on its own once the connection returns.
 *
 * The look is the site-wide loader's family (brand-loader.tsx): paper and chart
 * grid, the sail mark, a serif title, violet only on the action. The mark sits
 * inside range rings with a violet ping going out, so it reads as "searching for
 * a signal" rather than as another loader.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeftRight,
  Loader2,
  Plane,
  RefreshCw,
  Router,
  ShieldCheck,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConnectivity } from '../../hooks/useConnectivity';
import { checkConnectivityNow } from '../../utils/network/connectivity';
import { BrandLoaderMark } from '../ui/brand-loader-mark';
import { cn } from '../ui/utils';
import '../ui/brand-loader.css';
import './offline-screen.css';

/** Short drops (Wi-Fi roaming, a router blip) recover on their own; don't flash a takeover for them. */
export const OFFLINE_SCREEN_DELAY_MS = 1500;
/** Keep "Checking…" up long enough to register, even when the answer is instant. */
const MIN_CHECK_MS = 600;

interface Tip {
  Icon: LucideIcon;
  text: string;
}

const COPY: Record<'offline' | 'unreachable', { title: string; body: string; tips: Tip[] }> = {
  offline: {
    title: "You're offline",
    body: "Your device isn't connected to the internet. Navigate Wealth needs a connection to load and save your information.",
    tips: [
      { Icon: Wifi, text: 'Turn on Wi-Fi or mobile data.' },
      { Icon: Plane, text: 'Make sure flight mode is off.' },
    ],
  },
  // `unreachable` is inferred from requests to OUR backend failing while the
  // browser says it is online, so the copy does not pin it on the user's router.
  unreachable: {
    title: "Can't reach Navigate Wealth",
    body: "Your device is on a network, but Navigate Wealth isn't answering through it. Usually that network has lost its connection to the internet.",
    tips: [
      { Icon: Router, text: "Check your router's internet light, or restart it." },
      { Icon: ArrowLeftRight, text: 'Switch between Wi-Fi and mobile data.' },
    ],
  },
};

const timeFormat = new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit' });

/** The sail mark inside two range rings, with a violet ping going out from it. */
function SignalPlot() {
  return (
    <div className="nwo-plot" aria-hidden="true">
      <svg className="nwo-rings" viewBox="0 0 132 132" focusable="false">
        <circle className="nwo-ring-outer" cx="66" cy="66" r="64" />
        <circle className="nwo-ring-inner" cx="66" cy="66" r="44" />
        {Array.from({ length: 12 }, (_, i) => i * 30)
          .filter((angle) => angle !== 0)
          .map((angle) => (
            <line
              key={angle}
              className={angle % 90 === 0 ? 'nwo-cardinal' : undefined}
              x1="66"
              x2="66"
              y1="2"
              y2={angle % 90 === 0 ? 9 : 6}
              transform={`rotate(${angle} 66 66)`}
            />
          ))}
        {/* North: the loader's violet lubber head. */}
        <path className="nwo-lubber" d="M61.5 -1.5h9L66 5.5z" />
      </svg>
      <span className="nwo-ping" />
      <span className="nwo-ping nwo-ping-2" />
      <BrandLoaderMark className="nwo-mark" height={58} />
    </div>
  );
}

interface OfflineScreenProps {
  /** When false this renders nothing, e.g. for pages that still read fine offline. */
  enabled?: boolean;
}

export function OfflineScreen({ enabled = true }: OfflineScreenProps) {
  const status = useConnectivity();
  const disconnected = enabled && status !== 'online';
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stillDownAt, setStillDownAt] = useState<Date | null>(null);
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
    setStillDownAt(null);
    if (status === 'online') toast.success("You're back online");
  }, [visible, status]);

  const handleRetry = async () => {
    if (checking) return;
    setChecking(true);
    setStillDownAt(null);
    const [connected] = await Promise.all([
      checkConnectivityNow(),
      new Promise((resolve) => setTimeout(resolve, MIN_CHECK_MS)),
    ]);
    setChecking(false);
    if (!connected) setStillDownAt(new Date());
  };

  if (!visible || !disconnected) return null;

  const { title, body, tips } = status === 'offline' ? COPY.offline : COPY.unreachable;
  const phase = checking ? 'is-checking' : stillDownAt ? 'is-down' : 'is-waiting';

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className={cn('nwo nwl-tokens', checking && 'is-checking')}
    >
      <div className="nwo-grid" aria-hidden="true" />
      <div className="nwo-scroll">
        <div className="nwo-center">
          <div className="nwo-card">
            <div className="nwo-body">
              <SignalPlot />

              <h2 id={titleId} className="nwo-title">
                {title}
              </h2>
              <p id={bodyId} className="nwo-lead">
                {body}
              </p>

              <ul className="nwo-tips" aria-label="Things to try">
                {tips.map(({ Icon, text }) => (
                  <li key={text} className="nwo-tip">
                    <span className="nwo-tip-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

              <p className={cn('nwo-status', phase)} aria-live="polite">
                <span className="nwo-dot" aria-hidden="true" />
                {checking ? (
                  'Checking your connection…'
                ) : stillDownAt ? (
                  <>
                    Still no connection at{' '}
                    <time dateTime={stillDownAt.toISOString()}>
                      {timeFormat.format(stillDownAt)}
                    </time>
                    . We&apos;ll keep trying.
                  </>
                ) : (
                  'Reconnecting automatically…'
                )}
              </p>

              <button
                ref={retryRef}
                type="button"
                className="nwo-btn"
                onClick={handleRetry}
                aria-disabled={checking}
              >
                {checking ? (
                  <>
                    <Loader2 className="nwo-spin" aria-hidden="true" />
                    Checking…
                  </>
                ) : (
                  <>
                    <RefreshCw className="nwo-refresh" aria-hidden="true" />
                    Try again
                  </>
                )}
              </button>
            </div>

            <p className="nwo-safe">
              <ShieldCheck aria-hidden="true" />
              <span>
                <strong>Your work is safe.</strong> Keep this tab open — the page you were on is
                still here, including anything you&apos;d typed, and carries on once you&apos;re
                reconnected.
              </span>
            </p>
          </div>

          <p className="nwo-sig">
            <span className="nwo-sig-name">Navigate Wealth</span>
            <span className="nwo-sig-dot" aria-hidden="true">
              ·
            </span>
            <span>FSP 54606</span>
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
