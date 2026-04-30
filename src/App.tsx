import React, { useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { validateEnv, logEnvironmentInfo } from "./config/env";
import { AppProviders } from "./components/providers/AppProviders";
import { AppRoutes } from "./AppRoutes";
import { SkipToContent } from "./components/shared/AccessibilityHelpers";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import {
  reportRuntimeClientIssue,
  runtimeIssueFromUnknown,
} from "./utils/quality/runtimeIssueReporter";
import { isWebLockStealAbort } from "./utils/errorUtils";

const CHUNK_LOAD_RELOAD_KEY = "navigate-wealth:chunk-load-reload-at";
const CHUNK_LOAD_RELOAD_WINDOW_MS = 60_000;

function isDynamicImportLoadFailure(value: unknown): boolean {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : String(value ?? "");

  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("ChunkLoadError")
  );
}

function reloadOnceForChunkLoadFailure(): boolean {
  try {
    const now = Date.now();
    const lastReload = Number(
      window.sessionStorage.getItem(CHUNK_LOAD_RELOAD_KEY) || "0",
    );

    if (Number.isFinite(lastReload) && now - lastReload < CHUNK_LOAD_RELOAD_WINDOW_MS) {
      return false;
    }

    window.sessionStorage.setItem(CHUNK_LOAD_RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    window.location.reload();
    return true;
  }
}

export default function App() {
  const appIconVersion = "20260325b";
  const appIcon192 = `/favicon-192x192.png?v=${appIconVersion}`;
  const appIcon512 = `/favicon-512x512.png?v=${appIconVersion}`;

  // Validate environment variables on first render
  // v5.1: Submissions UI aligned to TaskManagementModule pattern
  useEffect(() => {
    try {
      validateEnv();
      logEnvironmentInfo();
    } catch (error) {
      console.error("Environment validation failed:", error);
    }

    // WCAG 2.1 AA §3.1.1: Set document language for screen readers
    document.documentElement.lang = "en";
  }, []);

  // Initialize Google Analytics
  useEffect(() => {
    // Suppress TradingView iframe errors in sandboxed/preview environments
    // TradingView's external embedding scripts attempt to access contentWindow on
    // cross-origin iframes, which is unavailable in sandboxed contexts (e.g. preview iframes).
    // This is non-fatal — widgets may still render correctly in production.
    const handleWindowError = (event: ErrorEvent) => {
      if (
        isDynamicImportLoadFailure(event.message) ||
        isDynamicImportLoadFailure(event.error)
      ) {
        event.preventDefault();
        return reloadOnceForChunkLoadFailure();
      }

      if (
        event.message?.includes("contentWindow") ||
        event.message?.includes(
          "Cannot listen to the event from the provided iframe",
        )
      ) {
        event.preventDefault();
        console.debug(
          "[TradingView] Suppressed non-fatal iframe access error in preview environment.",
        );
        return true;
      }

      void reportRuntimeClientIssue({
        kind: "window-error",
        title: event.error instanceof Error ? event.error.name : "Window error",
        message: event.message || "Unhandled window error",
        stack: event.error instanceof Error ? event.error.stack : undefined,
        filePath: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };
    window.addEventListener("error", handleWindowError);

    // Also suppress unhandled promise rejections from TradingView scripts
    const handleUnhandledRejection = (
      event: PromiseRejectionEvent,
    ) => {
      if (isWebLockStealAbort(event.reason)) {
        event.preventDefault();
        return;
      }

      const reason = String(event.reason ?? "");
      if (isDynamicImportLoadFailure(event.reason) || isDynamicImportLoadFailure(reason)) {
        event.preventDefault();
        reloadOnceForChunkLoadFailure();
        return;
      }

      if (
        reason.includes("contentWindow") ||
        reason.includes(
          "Cannot listen to the event from the provided iframe",
        )
      ) {
        event.preventDefault();
        console.debug(
          "[TradingView] Suppressed non-fatal iframe promise rejection in preview environment.",
        );
      }

      void reportRuntimeClientIssue(
        runtimeIssueFromUnknown("unhandled-rejection", event.reason),
      );
    };
    window.addEventListener(
      "unhandledrejection",
      handleUnhandledRejection,
    );
    const handleVitePreloadError = (event: Event) => {
      event.preventDefault();
      reloadOnceForChunkLoadFailure();
    };
    window.addEventListener("vite:preloadError", handleVitePreloadError);

    // Create and append Google Analytics script
    const script1 = document.createElement("script");
    script1.src =
      "https://www.googletagmanager.com/gtag/js?id=G-11PXRZJXB6";
    script1.async = true;
    document.head.appendChild(script1);

    // Add gtag configuration
    const script2 = document.createElement("script");
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-11PXRZJXB6');
    `;
    document.head.appendChild(script2);

    // JSZip is no longer loaded globally — the ZipEncryptTool uses @zip.js/zip.js
    // via npm import, so the CDN script was dead weight on every page load.

    // Initialize PWA (Manifest & Service Worker)
    const initPWA = () => {
      // 0. Ensure Viewport (Critical for mobile/PWA installability)
      // WCAG 2.1 AA §1.4.4: user-scalable must not be disabled — users must be able to zoom to 200%
      if (!document.querySelector('meta[name="viewport"]')) {
        const meta = document.createElement("meta");
        meta.name = "viewport";
        meta.content = "width=device-width, initial-scale=1";
        document.head.appendChild(meta);
      }

      // 1. Inject Dynamic Manifest with User's Icon
      // We generate this dynamically to use the bundled figma:asset URL correctly
      const manifest = {
        name: "Navigate Wealth Admin",
        short_name: "NW Admin",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0B1220",
        theme_color: "#0B1220",
        orientation: "any",
        description:
          "Admin portal for managing clients, requests, and financial workflows.",
        categories: ["finance", "productivity", "business"],
        icons: [
          {
            src: appIcon192,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: appIcon512,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      };

      const manifestBlob = new Blob(
        [JSON.stringify(manifest)],
        { type: "application/json" },
      );
      const manifestURL = URL.createObjectURL(manifestBlob);

      const existingLink = document.querySelector(
        'link[rel="manifest"]',
      );
      if (existingLink) {
        existingLink.setAttribute("href", manifestURL);
      } else {
        const link = document.createElement("link");
        link.rel = "manifest";
        link.href = manifestURL;
        document.head.appendChild(link);
      }

      // 2. Inject Theme Color
      if (!document.querySelector('meta[name="theme-color"]')) {
        const meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.content = "#0B1220";
        document.head.appendChild(meta);
      }

      // 3. Register Service Worker (All environments to allow install testing)
      if ("serviceWorker" in navigator) {
        const registerSW = () => {
          navigator.serviceWorker
            .register("/service-worker.js")
            .then((registration) => {
              console.log("SW registered: ", registration);
            })
            .catch((registrationError) => {
              console.log(
                "SW registration failed: ",
                registrationError,
              );
            });
        };

        if (document.readyState === "complete") {
          registerSW();
        } else {
          window.addEventListener("load", registerSW);
        }
      }
    };

    initPWA();

    return () => {
      // Cleanup scripts if component unmounts (though this rarely happens for the main App component)
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
      window.removeEventListener("vite:preloadError", handleVitePreloadError);
      if (script1.parentNode)
        document.head.removeChild(script1);
      if (script2.parentNode)
        document.head.removeChild(script2);
    };
  }, []);

  return (
    <ErrorBoundary
      fallbackTitle="Application Error"
      fallbackMessage="Navigate Wealth encountered an unexpected error. Please refresh the page to try again."
    >
      <AppProviders>
        <SkipToContent targetId="main-content" />
        <SpeedInsights />
        <Analytics />
        <AppRoutes />
      </AppProviders>
    </ErrorBoundary>
  );
}
