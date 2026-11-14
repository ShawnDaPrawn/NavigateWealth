/**
 * Publications Feature - ErrorState Component
 *
 * Displays error messages with optional retry action.
 */

import { AlertCircle } from 'lucide-react';
import { ErrorState as SharedErrorState } from '../../../layout/page';

interface ErrorStateProps {
  title?: string;
  /** The technical message — shown behind "Show details". */
  message: string;
  onRetry?: () => void;
  fullPage?: boolean;
}

/** Publications' error state: the shared one (error pill, Try again, details). */
export function ErrorState({ title = 'Unable to load', message, onRetry }: ErrorStateProps) {
  return <SharedErrorState title={title} onRetry={onRetry} details={message} />;
}

/**
 * Inline error message (for forms, etc.)
 */
export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600 text-sm">
      <AlertCircle className="w-4 h-4" />
      <span>{message}</span>
    </div>
  );
}
