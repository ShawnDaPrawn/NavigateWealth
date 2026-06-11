/**
 * Shared PWA display-mode detection.
 *
 * The whole point of this helper is to answer one question reliably: "are we
 * running as the genuinely installed Navigate Wealth app, or in a web browser?"
 *
 * This matters because the installed PWA is a portal-only app (custom login →
 * client portal, no marketing site), whereas the website must always stay the
 * full website. The two experiences are gated on this single signal.
 *
 * The naive check — `matchMedia('(display-mode: standalone)')` — is NOT enough:
 * in-app browsers (Facebook, Instagram, WhatsApp, LinkedIn, …) and Android
 * WebViews frequently report `display-mode: standalone` even though they are
 * just a browser embedded in another app. A client tapping a link to the site
 * from one of those apps would otherwise be wrongly flipped into the PWA login.
 * So we explicitly treat in-app browsers as regular browsers (the website).
 */

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

// User-agent fragments for the common in-app browsers / embedded WebViews that
// lie about their display-mode. Genuine installed PWAs never carry these.
const IN_APP_BROWSER_UA =
  /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|WhatsApp|MicroMessenger|WeChat|Snapchat|LinkedInApp|musical_ly|TikTok|Pinterest|GSA\/|; wv\)/i;

/**
 * True when the current context is an in-app browser or an Android WebView —
 * i.e. a browser embedded inside another app, which should be treated as the
 * website, never as the installed PWA.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return IN_APP_BROWSER_UA.test(navigator.userAgent || '');
}

/**
 * True only when running as the genuinely installed PWA, launched in standalone
 * display mode. Returns false for normal browser tabs AND for in-app browsers /
 * WebViews that merely report `display-mode: standalone`.
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;

  // iOS home-screen web apps expose this and in-app browsers do not, so it is a
  // trustworthy positive signal on its own.
  const iosStandalone = (window.navigator as NavigatorWithStandalone).standalone === true;
  if (iosStandalone) return true;

  // Everywhere else, only trust standalone display when it is not an embedded
  // in-app browser faking it.
  const displayStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  return displayStandalone && !isInAppBrowser();
}
