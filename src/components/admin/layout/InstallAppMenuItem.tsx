import React from 'react';
import { Download } from 'lucide-react';
import { DropdownMenuItem } from '../../ui/dropdown-menu';
import { toast } from 'sonner@2.0.3';

interface InstallAppMenuItemProps {
  isInstalling?: boolean;
  isVisible: boolean;
  onInstallApp: () => Promise<'accepted' | 'dismissed' | null>;
  onShowInstallHelp: () => void;
}

export function InstallAppMenuItem({
  isInstalling = false,
  isVisible,
  onInstallApp,
  onShowInstallHelp,
}: InstallAppMenuItemProps) {
  if (!isVisible) {
    return null;
  }

  const handleInstall = async (e: React.MouseEvent) => {
    e.preventDefault();

    const loadingToast = toast.loading('Preparing installation...');

    try {
      const outcome = await onInstallApp();

      toast.dismiss(loadingToast);

      if (!outcome) {
        console.log('PWA: Install prompt unavailable');
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
      disabled={isInstalling}
      className="text-purple-600 focus:text-purple-600 focus:bg-purple-50"
    >
      <Download className="mr-2 h-4 w-4" />
      Install App
    </DropdownMenuItem>
  );
}
