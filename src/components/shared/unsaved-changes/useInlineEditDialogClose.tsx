import { useCallback, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';

function stableSerialize(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Guards closing an inline edit dialog when the edited item has changed
 * since edit mode was entered.
 */
export function useInlineEditDialogClose<T>({
  getItem,
  onCancelEdit,
  itemLabel = 'this item',
}: {
  getItem: (id: string) => T | undefined;
  onCancelEdit: (id: string) => void;
  itemLabel?: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const editSnapshotsRef = useRef<Map<string, string>>(new Map());

  const beginEdit = useCallback(
    (id: string) => {
      const item = getItem(id);
      if (item !== undefined) {
        editSnapshotsRef.current.set(id, stableSerialize(item));
      }
    },
    [getItem],
  );

  const isItemDirty = useCallback(
    (id: string) => {
      const snapshot = editSnapshotsRef.current.get(id);
      if (!snapshot) return false;
      const item = getItem(id);
      if (item === undefined) return false;
      return snapshot !== stableSerialize(item);
    },
    [getItem],
  );

  const clearSnapshot = useCallback((id: string) => {
    editSnapshotsRef.current.delete(id);
  }, []);

  const handleDialogOpenChange = useCallback(
    (id: string, open: boolean) => {
      if (open) {
        beginEdit(id);
        return;
      }

      if (!isItemDirty(id)) {
        clearSnapshot(id);
        onCancelEdit(id);
        return;
      }

      setPendingId(id);
      setConfirmOpen(true);
    },
    [beginEdit, clearSnapshot, isItemDirty, onCancelEdit],
  );

  const handleKeepEditing = useCallback(() => {
    setConfirmOpen(false);
    setPendingId(null);
  }, []);

  const handleDiscard = useCallback(() => {
    if (pendingId) {
      clearSnapshot(pendingId);
      onCancelEdit(pendingId);
    }
    setConfirmOpen(false);
    setPendingId(null);
  }, [clearSnapshot, onCancelEdit, pendingId]);

  const confirmDialog = (
    <AlertDialog open={confirmOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved edits?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes to {itemLabel}. Discard them or keep editing?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleKeepEditing}>Keep Editing</AlertDialogCancel>
          <AlertDialogAction onClick={handleDiscard} className="bg-red-600 hover:bg-red-700">
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    handleDialogOpenChange,
    trackEditStart: beginEdit,
    confirmDialog,
    clearSnapshot,
  };
}
