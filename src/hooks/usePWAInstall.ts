import { useState, useEffect } from 'react';

// Type definition for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    // Handler for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA: beforeinstallprompt fired', e);
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
      // Optional: Clear the deferred prompt if it exists
      setDeferredPrompt(null);
    };

    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setIsAppInstalled(true);
      setIsInstallable(false);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async (): Promise<'accepted' | 'dismissed' | null> => {
    // If we don't have the prompt yet, we can try to wait a short moment
    // in case the browser is just slightly delayed (race condition).
    if (!deferredPrompt) {
        return new Promise((resolve) => {
            let timeout: ReturnType<typeof setTimeout>;
            
            const handleLatePrompt = (e: Event) => {
                e.preventDefault();
                clearTimeout(timeout);
                window.removeEventListener('beforeinstallprompt', handleLatePrompt);
                
                // Prompt arrived! Trigger it immediately.
                const promptEvent = e as BeforeInstallPromptEvent;
                setDeferredPrompt(promptEvent);
                
                promptEvent.prompt().then(() => {
                    promptEvent.userChoice.then((choice) => {
                        setDeferredPrompt(null);
                        setIsInstallable(false);
                        resolve(choice.outcome);
                    });
                });
            };

            window.addEventListener('beforeinstallprompt', handleLatePrompt);

            // Wait 3 seconds max
            timeout = setTimeout(() => {
                window.removeEventListener('beforeinstallprompt', handleLatePrompt);
                resolve(null);
            }, 3000);
        });
    }

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const choiceResult = await deferredPrompt.userChoice;
    
    // Reset the deferred prompt variable
    setDeferredPrompt(null);
    setIsInstallable(false);
    
    return choiceResult.outcome;
  };

  return { isInstallable, isAppInstalled, installApp };
}