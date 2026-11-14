import { RefreshCw } from 'lucide-react';
import { Button } from '../../../../ui/button';

interface CardErrorProps {
  /** What failed, e.g. "Couldn't load tasks due today". */
  title: string;
  onRetry: () => void;
}

/**
 * The standard inline error for one dashboard card: the rest of the page
 * keeps working, and Try again reloads only this card's data.
 */
export function CardError({ title, onRetry }: CardErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-red-200 bg-red-50/40 px-4 py-6 text-center"
    >
      <p className="text-sm font-medium text-nw-ink">{title}</p>
      <p className="text-xs text-nw-text-3">Something went wrong while loading.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
