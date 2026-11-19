import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Download, Plus, Share, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { logger } from '../../utils/logger';
import { isStandaloneDisplay } from '../../utils/pwa/displayMode';
import { isArticleEscapeHost } from '../../utils/pwa/escapeHost';
import { SITE_DESIGN } from '../../site/design';
import type { InstallNotice } from '../../site/components/NavigatorInstallPrompt';

// The Navigator design's banner, toast and sheet: a lazy chunk, fetched only
// when the prompt is about to show in that design, so the legacy site's
// bundle and every page that never shows the prompt stay as they were.
const NavigatorInstallPrompt = lazy(() => import('../../site/components/NavigatorInstallPrompt'));

// Dismissal is scoped to the browser session (sessionStorage) so the prompt
// re-appears at most once per session — never again after install.
const DISMISS_KEY = 'nw-pwa-install-dismissed-session';
const INSTALLED_KEY = 'nw-pwa-installed';

// Per the product decision, the "Download our app" prompt only appears on the
// homepage and the auth entry points — not on deep marketing pages.
const PROMPT_ROUTES = ['/', '/login', '/signup'];

type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<unknown[]>;
};

// The install prompt is disabled on mobile devices — visitors found it intrusive.
// Detect phones/tablets via the UA (plus touch-capable MacIntel for iPadOS, which
// reports as desktop Safari) so the banner only ever shows on desktop browsers.
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaDataMobile = (navigator as Navigator & { userAgentData?: { mobile?: boolean } })
    .userAgentData?.mobile;
  if (uaDataMobile) return true;
  return (
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// iOS Safari never fires `beforeinstallprompt`, so the only way to install is the
// manual "Share -> Add to Home Screen" flow. Detect iOS Safari to show instructions
// rather than a (non-functional) one-tap install button. iPadOS reports as desktop
// Safari, so also treat a touch-capable MacIntel as iOS.
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Exclude in-app/3rd-party iOS browsers where Add-to-Home-Screen is unavailable.
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa/i.test(ua);
  return isIos && isSafari;
}

function readInstalledFlag(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeInstalledFlag(): void {
  try {
    localStorage.setItem(INSTALLED_KEY, 'true');
  } catch {
    /* localStorage unavailable (private mode / blocked) — non-fatal */
  }
}

function clearInstalledFlag(): void {
  try {
    localStorage.removeItem(INSTALLED_KEY);
  } catch {
    /* non-fatal */
  }
}

function isDismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * How the prompt reports an install in progress. The legacy design uses the
 * site's sonner toasts; the Navigator design draws its own toast beside the
 * banner, as the "Install prompt" board does. The messages and when they are
 * shown and cleared are the same in both.
 */
interface InstallNotifier {
  loading: (message: string) => string | number;
  success: (message: string) => void;
  dismiss: (id: string | number) => void;
}

const sonnerNotifier: InstallNotifier = {
  loading: (message) => toast.loading(message),
  success: (message) => {
    toast.success(message);
  },
  dismiss: (id) => {
    toast.dismiss(id);
  },
};

/**
 * "Download our app" install prompt for the Navigate Wealth client portal.
 *
 * Shows a dismissible banner on the homepage and auth pages inviting users to
 * install the PWA. The banner is suppressed entirely on mobile devices (phones
 * and tablets) — visitors found it intrusive — so it only appears in desktop
 * browsers. On Android/desktop Chrome it triggers the native install
 * prompt captured by {@link usePWAInstall}; on iOS Safari it opens a sheet with
 * "Add to Home Screen" instructions. Once the app is installed it never asks
 * again — a persistent `nw-pwa-installed` flag suppresses the prompt across
 * future browser visits (the only reliable safeguard on iOS).
 *
 * The build's design switch picks the presentation; both run the same logic
 * (useInstallAppPrompt below), so the triggers, the storage keys and the
 * timing are identical whichever design is live.
 */
export function InstallAppPrompt() {
  return SITE_DESIGN === 'navigator' ? <NavigatorInstallAppPrompt /> : <LegacyInstallAppPrompt />;
}

function useInstallAppPrompt(notifier: InstallNotifier) {
  const location = useLocation();
  const { showInstallOption, isAppInstalled, installApp } = usePWAInstall();

  const [installedFlag, setInstalledFlag] = useState(readInstalledFlag);
  const [dismissed, setDismissed] = useState(isDismissedThisSession);
  const [showIosSheet, setShowIosSheet] = useState(false);

  const isStandalone = isStandaloneDisplay();
  const iosSafari = isIosSafari();

  // Reconcile the persisted "installed" flag with reality so we never suppress
  // the prompt for a user who has since uninstalled the app.
  useEffect(() => {
    const markInstalled = () => {
      writeInstalledFlag();
      setInstalledFlag(true);
    };
    const markUninstalled = () => {
      clearInstalledFlag();
      setInstalledFlag(false);
    };

    // Running inside the installed app (or already detected as installed).
    if (isAppInstalled || isStandalone) {
      markInstalled();
    }

    // Fires the moment the user accepts the native install prompt.
    const handleAppInstalled = () => markInstalled();
    window.addEventListener('appinstalled', handleAppInstalled);

    // Chromium-only: authoritative check of whether our PWA is currently
    // installed. Set the flag if it is, and CLEAR it if it isn't (e.g. the user
    // uninstalled) so the install prompt can return.
    const nav = navigator as NavigatorWithRelatedApps;
    if (typeof nav.getInstalledRelatedApps === 'function') {
      nav
        .getInstalledRelatedApps()
        .then((apps) => {
          if (Array.isArray(apps) && apps.length > 0) markInstalled();
          else if (!isStandalone) markUninstalled();
        })
        .catch(() => {
          /* unsupported or rejected — ignore */
        });
    }

    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, [isAppInstalled, isStandalone]);

  // `beforeinstallprompt` only fires when the app is installable, i.e. NOT
  // currently installed. Treat it as proof and clear any stale installed flag.
  useEffect(() => {
    if (showInstallOption && !isStandalone) {
      clearInstalledFlag();
      setInstalledFlag(false);
    }
  }, [showInstallOption, isStandalone]);

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* non-fatal */
    }
    setDismissed(true);
  }, []);

  const handleInstall = useCallback(async () => {
    // iOS: no programmatic install — show the manual instructions.
    if (iosSafari) {
      setShowIosSheet(true);
      return;
    }

    const loadingToast = notifier.loading('Preparing installation…');
    try {
      const outcome = await installApp();
      notifier.dismiss(loadingToast);

      if (outcome === 'accepted') {
        notifier.success('Installing Navigate Wealth…');
        writeInstalledFlag();
        setInstalledFlag(true);
      } else if (outcome === null) {
        // The browser had no deferred prompt ready — fall back to manual help.
        setShowIosSheet(true);
      }
    } catch (error) {
      notifier.dismiss(loadingToast);
      logger.info('PWA: client install failed', { error });
    }
  }, [iosSafari, installApp, notifier]);

  const onPromptRoute = PROMPT_ROUTES.includes(location.pathname);
  // On Android/desktop the live signals (standalone + beforeinstallprompt) are
  // authoritative, so the persisted flag only suppresses on iOS — where Safari
  // gives us no way to detect install state from the browser.
  const alreadyInstalled = isAppInstalled || isStandalone || (iosSafari && installedFlag);
  // Android/desktop need a captured prompt; iOS Safari is always eligible.
  const canPrompt = iosSafari || showInstallOption;
  // Never offer to install from the apex host: it exists purely so emailed
  // article links open in a browser the installed app cannot capture, and a
  // second app installed from there would start capturing them (escapeHost.ts).
  const visible =
    onPromptRoute &&
    !alreadyInstalled &&
    !dismissed &&
    canPrompt &&
    !isMobileDevice() &&
    !isArticleEscapeHost();

  return { visible, iosSafari, showIosSheet, setShowIosSheet, handleInstall, handleDismiss };
}

function LegacyInstallAppPrompt() {
  const { visible, iosSafari, showIosSheet, setShowIosSheet, handleInstall, handleDismiss } =
    useInstallAppPrompt(sonnerNotifier);

  if (!visible) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-xl border border-border bg-background p-3 shadow-lg sm:gap-4 sm:p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-12">
            <Download className="size-5 sm:size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium sm:text-base">Get the Navigate Wealth app</p>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              Install the client portal for quick, full-screen access.
            </p>
          </div>
          <Button size="sm" onClick={handleInstall} className="shrink-0">
            {iosSafari ? (
              <>
                <Share className="size-4" />
                How to
              </>
            ) : (
              <>
                <Download className="size-4" />
                Install
              </>
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="size-8 shrink-0"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <Sheet open={showIosSheet} onOpenChange={setShowIosSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Download className="size-5 text-primary" />
              Add to Home Screen
            </SheetTitle>
            <SheetDescription>
              Install Navigate Wealth on your device to open the client portal like a regular app.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 py-2">
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-background shadow-sm">
                <Share className="size-4" />
              </div>
              <p className="text-sm">
                Tap the <span className="font-semibold">Share</span> button in your browser's
                toolbar.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-background shadow-sm">
                <Plus className="size-4" />
              </div>
              <p className="text-sm">
                Scroll down and choose <span className="font-semibold">Add to Home Screen</span>.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * How long the success toast stays up: sonner's default lifetime, which the
 * public site's Toaster (AppProviders.tsx) does not override, so the
 * Navigator toast lasts exactly as long as the legacy one.
 */
const SUCCESS_NOTICE_MS = 4000;

function NavigatorInstallAppPrompt() {
  const [notice, setNotice] = useState<InstallNotice | null>(null);
  const lastId = useRef(0);
  const successTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(successTimer.current), []);

  // The sonner calls, mirrored: a loading toast stays until it is dismissed by
  // its id; a success toast replaces it and clears itself after its lifetime.
  const notifier = useMemo<InstallNotifier>(
    () => ({
      loading: (text) => {
        clearTimeout(successTimer.current);
        const id = ++lastId.current;
        setNotice({ id, kind: 'loading', text });
        return id;
      },
      success: (text) => {
        clearTimeout(successTimer.current);
        const id = ++lastId.current;
        setNotice({ id, kind: 'success', text });
        successTimer.current = setTimeout(
          () => setNotice((current) => (current?.id === id ? null : current)),
          SUCCESS_NOTICE_MS,
        );
      },
      dismiss: (id) => setNotice((current) => (current?.id === id ? null : current)),
    }),
    [],
  );

  const { visible, iosSafari, showIosSheet, setShowIosSheet, handleInstall, handleDismiss } =
    useInstallAppPrompt(notifier);

  // As in the legacy design, the banner and its sheet exist only while the
  // prompt is eligible; a toast outlives the banner (it reports an install the
  // banner has just disappeared for).
  if (!visible && !notice) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <NavigatorInstallPrompt
        bannerVisible={visible}
        iosSafari={iosSafari}
        notice={notice}
        sheetOpen={visible && showIosSheet}
        onSheetOpenChange={setShowIosSheet}
        onInstall={handleInstall}
        onDismiss={handleDismiss}
      />
    </Suspense>
  );
}
