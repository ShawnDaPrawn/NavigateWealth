/**
 * P8.5 — Single, consistent surface for toast notifications across the
 * e-signature module.
 *
 * `toastError` standardises error toasts with:
 *  - A consistent message format (`<context>: <reason>`).
 *  - An optional retry action that re-runs the failed operation.
 *  - Sensible duration / dedup behaviour (longer for errors with
 *    retry actions so the user has time to react).
 *
 * Why a wrapper instead of telling every caller to add `{ action: ... }`?
 * Because the dozens of `toast.error(...)` call sites in the module
 * each have slightly different conventions and most don't include a
 * retry. Centralising here means a single small change rolls out the
 * "errors are recoverable" rule everywhere we adopt it, without a
 * sweeping diff.
 */

import { toast } from 'sonner';

interface ToastErrorOptions {
  /** Optional async action to invoke when the user clicks "Retry". */
  retry?: () => void | Promise<void>;
  /** Toast id — pass to dedupe overlapping toasts (e.g. retry storms). */
  id?: string;
  /** Override the duration. Defaults to 6s for retryable, 4s otherwise. */
  duration?: number;
}

/**
 * Show a standard error toast. Pass `retry` to attach a "Retry" action
 * that re-runs the failed operation when the user clicks it.
 */
export function toastError(
  context: string,
  error: unknown,
  options: ToastErrorOptions = {},
): string | number {
  const reason = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'Unknown error';
  const message = context.endsWith('.') || context.endsWith('!') || context.endsWith('?')
    ? context
    : `${context}: ${reason}`;

  const action = options.retry
    ? {
        label: 'Retry',
        onClick: () => {
          try {
            const result = options.retry!();
            if (result instanceof Promise) {
              result.catch((err) => toastError(context, err, options));
            }
          } catch (err) {
            toastError(context, err, options);
          }
        },
      }
    : undefined;

  return toast.error(message, {
    id: options.id,
    duration: options.duration ?? (options.retry ? 6000 : 4000),
    action,
  });
}

/**
 * Show a standard success toast. Provided so call sites have one
 * import for both halves of the success/error pair, even though
 * success toasts don't currently need any extra behaviour beyond
 * `sonner`'s defaults.
 */
export function toastSuccess(message: string, id?: string): string | number {
  return toast.success(message, { id, duration: 3000 });
}

/**
 * Show a standard info toast. Mirrors `toastSuccess` for symmetry.
 */
export function toastInfo(message: string, id?: string): string | number {
  return toast.info(message, { id, duration: 3000 });
}
