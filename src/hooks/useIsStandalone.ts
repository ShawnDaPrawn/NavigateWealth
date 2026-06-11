import { useEffect, useState } from 'react';

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function getStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const matchesStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as NavigatorWithStandalone).standalone === true;
  return matchesStandalone || iosStandalone;
}

/**
 * Returns true when the app is running as an installed PWA (standalone display
 * mode, including iOS home-screen apps). Reactive to display-mode changes.
 *
 * Use this to tailor the installed-app experience without affecting the website
 * rendered in a normal browser tab.
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(getStandalone);

  useEffect(() => {
    const mql = window.matchMedia?.('(display-mode: standalone)');
    if (!mql) return;
    const handler = () => setStandalone(getStandalone());
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, []);

  return standalone;
}
