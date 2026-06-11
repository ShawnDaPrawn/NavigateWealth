/**
 * System Health Dialog
 *
 * Compact modal wrapper around `SystemHealthPanel`, opened from the
 * dashboard header. Because the panel fetches on mount and Radix only
 * mounts dialog content when open, no requests are made until the
 * dialog is actually opened.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../../ui/dialog';
import { Server } from 'lucide-react';
import { SystemHealthPanel } from './SystemHealthCard';
import type { SystemHealthDialogProps } from '../types';

export function SystemHealthDialog({ open, onOpenChange }: SystemHealthDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 rounded-lg">
              <Server className="h-4 w-4 text-gray-600" />
            </div>
            System Health
          </DialogTitle>
          <DialogDescription>KV store maintenance status</DialogDescription>
        </DialogHeader>
        <SystemHealthPanel />
      </DialogContent>
    </Dialog>
  );
}
