import { useEffect } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';

import { scrubSensitiveUrl } from './utils/analytics/scrubSensitiveUrl';
import { logger } from './utils/logger';
import { validateEnv, logEnvironmentInfo } from './config/env';
import { AppProviders } from './components/providers/AppProviders';
import { SkipToContent } from './components/shared/AccessibilityHelpers';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import {
  reportRuntimeClientIssue,
  runtimeIssueFromUnknown,
} from './utils/quality/runtimeIssueReporter';
import { isWebLockStealAbort } from './utils/errorUtils';
import { isStaleChunkLoadFailure, reloadOnceForStaleChunk } from './utils/staleChunkRecovery';

export default function App() {
  // Validate environment variables on first render
  // v5.1: Submissions UI aligned to TaskManagementModule pattern
  useEffect(() => {
    try {
      validateEnv();
      logEnvironmentInfo();
    } catch (error) {
      console.error('Environment validation failed:', error);
    }

    // WCAG 2.1 AA §3.1.1: Set document language for screen readers
    document.documentElement.lang = 'en';
  }, []);

  // Initialize Google Analytics
  useEffect(() => {
    // Suppress TradingView iframe errors in sandboxed/preview environments
    // TradingView's external embedding scripts attempt to access contentWindow on
    // cross-origin iframes, which is unavailable in sandboxed contexts (e.g. preview iframes).
    // This is non-fatal — widgets may still render correctly in production.
    const handleWindowError = (event: ErrorEvent) => {
      if (isStaleChunkLoadFailure(event.message) || isStaleChunkLoadFailure(event.error)) {
        event.preventDefault();
        return reloadOnceForStaleChunk();
      }

      if (
        event.message?.includes('contentWindow') ||
        event.message?.includes('Cannot listen to the event from the provided iframe')
      ) {
        event.preventDefault();
        logger.debug(
          '[TradingView] Suppressed non-fatal iframe access error in preview environment.',
        );
        return true;
      }

      void reportRuntimeClientIssue({
        kind: 'window-error',
        title: event.error instanceof Error ? event.error.name : 'Window error',
        message: event.message || 'Unhandled window error',
        stack: event.error instanceof Error ? event.error.stack : undefined,
        filePath: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };
    window.addEventListener('error', handleWindowError);

    // Also suppress unhandled promise rejections from TradingView scripts
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isWebLockStealAbort(event.reason)) {
        event.preventDefault();
        return;
      }

      const reason = String(event.reason ?? '');
      if (isStaleChunkLoadFailure(event.reason) || isStaleChunkLoadFailure(reason)) {
        event.preventDefault();
        reloadOnceForStaleChunk();
        return;
      }

      if (
        reason.includes('contentWindow') ||
        reason.includes('Cannot listen to the event from the provided iframe')
      ) {
        event.preventDefault();
        logger.debug(
          '[TradingView] Suppressed non-fatal iframe promise rejection in preview environment.',
        );
      }

      void reportRuntimeClientIssue(runtimeIssueFromUnknown('unhandled-rejection', event.reason));
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    const handleVitePreloadError = (event: Event) => {
      event.preventDefault();
      reloadOnceForStaleChunk();
    };
    window.addEventListener('vite:preloadError', handleVitePreloadError);

    // Create and append Google Analytics script
    const script1 = document.createElement('script');
    script1.src = 'https://www.googletagmanager.com/gtag/js?id=G-11PXRZJXB6';
    script1.async = true;
    document.head.appendChild(script1);

    // Add gtag configuration.
    //
    // SECURITY (SECURITY-AUDIT S8): `gtag('config', …)` sends an automatic
    // page_view whose `page_location` is the FULL current URL. Signer links are
    // `/sign?token=<uuid>`, and that token is the signer's credential, so the
    // default behaviour copied it to Google on the first paint of the page the
    // signer landed on. `page_location` is therefore pinned to a scrubbed URL
    // rather than left to default.
    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-11PXRZJXB6', ${JSON.stringify({
        page_location: scrubSensitiveUrl(window.location.href),
      })});
    `;
    document.head.appendChild(script2);

    // JSZip is no longer loaded globally — the ZipEncryptTool uses @zip.js/zip.js
    // via npm import, so the CDN script was dead weight on every page load.

    // Initialize PWA (Service Worker)
    // The web app manifest, theme-color, and apple-mobile-web-app-* meta tags are
    // declared statically in index.html (and served from /manifest.json) so the
    // browser can read them on first paint — required for reliable installability
    // and correct start_url/scope resolution. Here we only ensure the viewport and
    // register the service worker.
    const initPWA = () => {
      // 0. Ensure Viewport (Critical for mobile/PWA installability)
      // WCAG 2.1 AA §1.4.4: user-scalable must not be disabled — users must be able to zoom to 200%
      if (!document.querySelector('meta[name="viewport"]')) {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1';
        document.head.appendChild(meta);
      }

      // 1. Register Service Worker (All environments to allow install testing)
      if ('serviceWorker' in navigator) {
        const registerSW = () => {
          navigator.serviceWorker
            .register('/service-worker.js')
            .then((registration) => {
              logger.info('SW registered', { registration });
            })
            .catch((registrationError) => {
              logger.info('SW registration failed', { error: registrationError });
            });
        };

        if (document.readyState === 'complete') {
          registerSW();
        } else {
          window.addEventListener('load', registerSW);
        }
      }
    };

    initPWA();

    return () => {
      // Cleanup scripts if component unmounts (though this rarely happens for the main App component)
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('vite:preloadError', handleVitePreloadError);
      if (script1.parentNode) document.head.removeChild(script1);
      if (script2.parentNode) document.head.removeChild(script2);
    };
  }, []);

  return (
    <ErrorBoundary
      fallbackTitle="Application Error"
      fallbackMessage="Navigate Wealth encountered an unexpected error. Please refresh the page to try again."
    >
      <SkipToContent targetId="main-content" />
      <SpeedInsights />
      {/* beforeSend drops the signer token before it leaves the browser (S8). */}
      <Analytics beforeSend={(event) => ({ ...event, url: scrubSensitiveUrl(event.url) })} />
      <AppProviders />
    </ErrorBoundary>
  );
}
