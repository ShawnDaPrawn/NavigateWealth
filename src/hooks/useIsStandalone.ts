import { useEffect, useState } from 'react';
import { isStandaloneDisplay } from '../utils/pwa/displayMode';

/**
 * Returns true when the app is running as the genuinely installed PWA (standalone
 * display mode, including iOS home-screen apps). Reactive to display-mode changes.
 *
 * In-app browsers / WebViews that fake standalone are treated as the website, so
 * the full site renders normally inside them. Use this to tailor the installed-app
 * experience without affecting the website rendered in any browser.
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(isStandaloneDisplay);

  useEffect(() => {
    const mql = window.matchMedia?.('(display-mode: standalone)');
    if (!mql) return;
    const handler = () => setStandalone(isStandaloneDisplay());
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, []);

  return standalone;
}
