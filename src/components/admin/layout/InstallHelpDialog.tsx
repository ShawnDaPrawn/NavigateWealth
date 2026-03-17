import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Download, Monitor, MoreVertical } from 'lucide-react';

interface InstallHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallHelpDialog({ open, onOpenChange }: InstallHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-purple-600" />
            Install Admin App
          </DialogTitle>
          <DialogDescription>
            The browser's automatic install prompt is not ready yet. You can install the app manually.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="mt-0.5 p-1.5 bg-background rounded-md shadow-sm">
              <Monitor className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Desktop (Chrome / Edge)</p>
              <p className="text-xs text-muted-foreground">
                Look for the <span className="font-semibold text-foreground">Install</span> icon 
                on the right side of the address bar.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
             <div className="mt-0.5 p-1.5 bg-background rounded-md shadow-sm">
              <MoreVertical className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Alternative Method</p>
              <p className="text-xs text-muted-foreground">
                Click the browser menu (three dots) <span className="mx-1">→</span> 
                <span className="font-semibold text-foreground">Save and Share</span> <span className="mx-1">→</span> 
                <span className="font-semibold text-foreground">Install Navigate Wealth Admin</span>
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
