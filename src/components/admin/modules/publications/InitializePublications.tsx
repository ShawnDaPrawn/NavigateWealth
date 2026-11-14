/**
 * "Setup required" (design system: States) — shown only when the API has
 * positively reported that Publications has no categories or article types.
 * A failed status check shows an error instead (see PublicationsModule).
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { Notice } from '../../layout/page';
import { usePublicationsInit } from './hooks';

interface InitializePublicationsProps {
  onInitialized?: () => void;
}

export function InitializePublications({ onInitialized }: InitializePublicationsProps = {}) {
  const { initialize, isInitializing } = usePublicationsInit();
  const [error, setError] = useState<string | null>(null);

  const handleInitialize = async () => {
    setError(null);
    try {
      await initialize({
        create_default_categories: true,
        create_default_types: true,
      });
      toast.success('Publications is set up');
      if (onInitialized) onInitialized();
      else window.location.reload();
    } catch (err) {
      console.error('Error initializing publications:', err);
      setError(err instanceof Error ? err.message : 'Setup did not finish');
    }
  };

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border border-nw-line bg-white px-6 py-12 text-center"
      data-testid="publications-setup"
    >
      <span className="rounded-full bg-nw-violet-50 px-2.5 py-0.5 text-xs font-medium text-nw-violet-600">
        Setup required
      </span>
      <h2 className="text-lg font-semibold text-nw-ink">Set up Publications</h2>
      <p className="max-w-md text-sm text-nw-text-3">
        Publications needs its categories and article types created before you can write. This takes
        a few seconds and only happens once.
      </p>
      {error ? (
        <Notice kind="error" title="Setup did not finish:" className="max-w-md text-left">
          {error}
        </Notice>
      ) : null}
      <Button onClick={() => void handleInitialize()} disabled={isInitializing} className="mt-1">
        {isInitializing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {isInitializing ? 'Setting up…' : error ? 'Try again' : 'Initialise publications'}
      </Button>
    </div>
  );
}
