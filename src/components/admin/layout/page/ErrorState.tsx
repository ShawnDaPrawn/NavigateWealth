import { useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../../ui/button';

interface ErrorStateProps {
  /** What failed, e.g. "Unable to load tasks". */
  title: string;
  /** Reassurance. Defaults to "Something went wrong … Nothing you entered was lost." */
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  /** Technical detail, shown behind "Show details". */
  details?: string;
  /** A second action, e.g. "Back to clients" for a record that could not be opened. */
  secondaryAction?: ReactNode;
}

/** What a page shows when its data can't load (design system: ErrorState). */
export function ErrorState({
  title,
  description = 'Something went wrong while loading. Nothing you entered was lost.',
  onRetry,
  retryLabel = 'Try again',
  details,
  secondaryAction,
}: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-nw-line bg-white px-6 py-12 text-center"
    >
      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
        Error
      </span>
      <h2 className="text-lg font-semibold text-nw-ink">{title}</h2>
      <p className="max-w-md text-sm text-nw-text-3">{description}</p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {secondaryAction}
        {onRetry && (
          <Button onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {retryLabel}
          </Button>
        )}
        {details && (
          <Button variant="ghost" onClick={() => setShowDetails((v) => !v)}>
            {showDetails ? 'Hide details' : 'Show details'}
          </Button>
        )}
      </div>
      {details && showDetails && (
        <pre className="mt-2 max-h-48 w-full max-w-2xl overflow-auto rounded-lg bg-nw-bg p-3 text-left text-xs whitespace-pre-wrap text-nw-text-2">
          {details}
        </pre>
      )}
    </div>
  );
}
