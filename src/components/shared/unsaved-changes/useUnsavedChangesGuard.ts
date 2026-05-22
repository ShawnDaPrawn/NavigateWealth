import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useBeforeUnload } from 'react-router';
import type { UnsavedChangesGuardOptions } from './types';

const DEFAULT_MESSAGE =
  'You have unsaved changes. Would you like to save before leaving?';

type PendingAction = (() => void) | null;

export function useUnsavedChangesGuard({
  isDirty,
  onSave,
  onDiscard,
  enabled = true,
  message = DEFAULT_MESSAGE,
}: UnsavedChangesGuardOptions) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const pendingActionRef = useRef<PendingAction>(null);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const shouldBlockNavigation = enabled && isDirty;

  useBeforeUnload(
    useCallback(
      (event) => {
        if (shouldBlockNavigation) {
          event.preventDefault();
        }
      },
      [shouldBlockNavigation],
    ),
  );

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => {
        if (!enabled || !isDirtyRef.current) return false;
        return (
          currentLocation.pathname !== nextLocation.pathname ||
          currentLocation.search !== nextLocation.search ||
          currentLocation.hash !== nextLocation.hash
        );
      },
      [enabled],
    ),
  );

  const clearPending = useCallback(() => {
    pendingActionRef.current = null;
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    clearPending();
  }, [clearPending]);

  const runPendingAction = useCallback(() => {
    const action = pendingActionRef.current;
    clearPending();
    setDialogOpen(false);
    action?.();
  }, [clearPending]);

  const openDialog = useCallback((action: () => void) => {
    pendingActionRef.current = action;
    setDialogOpen(true);
  }, []);

  const tryAction = useCallback(
    (action: () => void) => {
      if (!enabled || !isDirtyRef.current) {
        action();
        return;
      }
      openDialog(action);
    },
    [enabled, openDialog],
  );

  const handleStay = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
    closeDialog();
  }, [blocker, closeDialog]);

  const handleDiscard = useCallback(() => {
    onDiscard();
    if (blocker.state === 'blocked') {
      blocker.proceed();
      return;
    }
    runPendingAction();
  }, [blocker, onDiscard, runPendingAction]);

  const handleSaveAndLeave = useCallback(async () => {
    setIsSaving(true);
    try {
      const saved = await onSave();
      if (!saved) {
        if (blocker.state === 'blocked') {
          blocker.reset();
        }
        closeDialog();
        return;
      }

      if (blocker.state === 'blocked') {
        blocker.proceed();
        return;
      }

      runPendingAction();
    } finally {
      setIsSaving(false);
    }
  }, [blocker, closeDialog, onSave, runPendingAction]);

  useEffect(() => {
    if (blocker.state === 'blocked' && enabled && isDirtyRef.current) {
      pendingActionRef.current = null;
      setDialogOpen(true);
    }
  }, [blocker.state, enabled]);

  return {
    dialogProps: {
      open: dialogOpen,
      message,
      isSaving,
      onStay: handleStay,
      onDiscard: handleDiscard,
      onSaveAndLeave: handleSaveAndLeave,
    },
    tryAction,
  };
}
