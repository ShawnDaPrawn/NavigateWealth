import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../ui/alert-dialog';
import { cn } from '../../../ui/utils';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  /** Label of the confirming button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label of the cancelling button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Red confirming button, for actions that delete or cannot be undone. */
  destructive?: boolean;
}

/**
 * A centred confirmation dialog in place of the browser's `confirm()`.
 *
 * ```tsx
 * const { confirm, confirmDialog } = useConfirm();
 * if (!(await confirm({ title: 'Delete this packet?', destructive: true }))) return;
 * // …render {confirmDialog} once, anywhere in the component.
 * ```
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    // A second request answers the first with "no" rather than leaving it hanging.
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const confirmDialog = (
    <AlertDialog
      open={options !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      {/* Explicit ids: the title sits inside the header, where the content's
          own title detection does not look. */}
      <AlertDialogContent
        aria-labelledby={titleId}
        aria-describedby={options?.description ? descriptionId : undefined}
      >
        <AlertDialogHeader>
          <AlertDialogTitle id={titleId}>{options?.title}</AlertDialogTitle>
          {options?.description ? (
            <AlertDialogDescription id={descriptionId}>
              {options.description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {options?.cancelLabel ?? 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              options?.destructive &&
                'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
            )}
            onClick={() => settle(true)}
          >
            {options?.confirmLabel ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, confirmDialog };
}
