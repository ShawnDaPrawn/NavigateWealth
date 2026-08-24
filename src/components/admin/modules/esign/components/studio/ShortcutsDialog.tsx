/**
 * The keyboard shortcut reference.
 *
 *
 * Split out of `PrepareFormStudio.tsx` (1,529 lines), whose `return` held the
 * toolbar, recipient strip, bulk-action bar, canvas and five dialogs together.
 * Presentational — it owns no state.
 */
import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';

interface ShortcutsDialogProps {
  setShowShortcuts: Dispatch<SetStateAction<boolean>>;
  showShortcuts: boolean;
}

export function ShortcutsDialog({ setShowShortcuts, showShortcuts }: ShortcutsDialogProps) {
  return (
    <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-purple-600" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Power-user controls for placing and arranging fields quickly.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2 text-sm">
          {[
            ['Save', '⌘ / Ctrl + S'],
            ['Undo', '⌘ / Ctrl + Z'],
            ['Redo', '⇧ + ⌘ / Ctrl + Z'],
            ['Copy', '⌘ / Ctrl + C'],
            ['Paste', '⌘ / Ctrl + V'],
            ['Duplicate', '⌘ / Ctrl + D'],
            ['Select all', '⌘ / Ctrl + A'],
            ['Delete', 'Delete / Backspace'],
            ['Nudge field', 'Arrow keys'],
            ['Nudge ×10', 'Shift + Arrow'],
            ['Bypass snap', 'Hold Alt while drag'],
            ['Multi-select', 'Shift + click / drag'],
            ['Clear selection', 'Esc'],
            // P2.5 2.11
            ['Pick recipient 1–9', '1 … 9'],
            ['Show this help', '?'],
          ].map(([label, keys]) => (
            <React.Fragment key={label}>
              <span className="text-gray-600">{label}</span>
              <span className="font-mono text-xs text-gray-800 text-right">{keys}</span>
            </React.Fragment>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
