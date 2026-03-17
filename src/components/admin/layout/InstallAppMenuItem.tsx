import React from 'react';
import { Download } from 'lucide-react';
import { DropdownMenuItem } from '../../ui/dropdown-menu';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { toast } from 'sonner@2.0.3';

interface InstallAppMenuItemProps {
  onShowInstallHelp: () => void;
}

export function InstallAppMenuItem({ onShowInstallHelp }: InstallAppMenuItemProps) {
  const { isInstallable, installApp } = usePWAInstall();

  const handleInstall = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Create a loading toast
    const loadingToast = toast.loading('Preparing installation...');

    try {
      // Attempt installation (waits up to 3s if needed)
      const outcome = await installApp();
      
      toast.dismiss(loadingToast);

      // If still no prompt, show help
      if (!outcome) {
        console.log('PWA: Install failed - deferredPrompt is null');
        onShowInstallHelp();
        return;
      }

      if (outcome === 'accepted') {
        toast.success('Installation started');
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Install error:', error);
    }
  };

  return (
    <DropdownMenuItem 
      onSelect={handleInstall}
      className="text-purple-600 focus:text-purple-600 focus:bg-purple-50"
    >
      <Download className="mr-2 h-4 w-4" />
      Install App
    </DropdownMenuItem>
  );
}
