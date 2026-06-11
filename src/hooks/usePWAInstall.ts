import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { isStandaloneDisplay } from '../utils/pwa/displayMode';

// Type definition for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Handler for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      logger.info('PWA: beforeinstallprompt fired', { event: e });
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Handler for appinstalled event
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsAppInstalled(true);
      setIsInstalling(false);
    };

    const displayModeMediaQuery = window.matchMedia('(display-mode: standalone)');

    const syncInstalledState = () => {
      // In-app browsers fake standalone; isStandaloneDisplay() excludes them so we
      // never wrongly mark the app as installed inside an embedded browser.
      const installed = isStandaloneDisplay();
      setIsAppInstalled(installed);

      if (installed) {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    };

    syncInstalledState();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    displayModeMediaQuery.addEventListener?.('change', syncInstalledState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      displayModeMediaQuery.removeEventListener?.('change', syncInstalledState);
    };
  }, []);

  const installApp = async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferredPrompt) {
      return null;
    }

    setIsInstalling(true);

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      setDeferredPrompt(null);
      setIsInstallable(false);

      if (choiceResult.outcome === 'accepted') {
        setIsAppInstalled(true);
      }

      return choiceResult.outcome;
    } finally {
      setIsInstalling(false);
    }
  };

  const showInstallOption = isInstallable && !isAppInstalled;

  return {
    isInstallable,
    isAppInstalled,
    isInstalling,
    showInstallOption,
    installApp,
  };
}
