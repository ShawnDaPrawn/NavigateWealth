/**
 * What the page shows while loading, and when loading fails.
 *
 * Split out of `ArticleDetailPage.tsx` (1,486 lines), which held the page, its
 * loading and error states, the share menu, the fallback article set and every
 * helper in one file. Each was already a self-contained function; only its
 * address changed.
 */
import { useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '../../ui/button';
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';

export function ArticleLoadingState() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Skeleton header */}
      <div className="bg-[rgb(49,54,83)] pt-16 pb-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-24 bg-white/10 rounded" />
            <div className="flex gap-2">
              <div className="h-6 w-28 bg-white/10 rounded-full" />
              <div className="h-6 w-24 bg-white/10 rounded-full" />
            </div>
            <div className="h-12 bg-white/10 rounded w-3/4" />
            <div className="h-8 bg-white/10 rounded w-1/2" />
            <div className="flex gap-4 pt-2">
              <div className="h-4 w-32 bg-white/10 rounded" />
              <div className="h-4 w-28 bg-white/10 rounded" />
              <div className="h-4 w-24 bg-white/10 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Skeleton body */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-4/6" />
          </div>
          <div className="h-8 bg-gray-200 rounded w-1/3 mt-8" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArticleErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  useEffect(() => {
    let el = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      document.head.appendChild(el);
    }
    el.setAttribute('content', 'noindex, nofollow');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Article Not Found</h2>
        <p className="text-gray-600 mb-8">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/resources">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Resources
            </Button>
          </Link>
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Share menu
// ---------------------------------------------------------------------------
