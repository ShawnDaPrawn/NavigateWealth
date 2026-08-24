import { Loader2 } from 'lucide-react';

/** Suspense fallback shown while a lazy wizard/dialog chunk loads. */
export function StepFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}
