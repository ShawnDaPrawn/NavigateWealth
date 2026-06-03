import { Link } from 'react-router';
import { Alert, AlertDescription } from '../../../ui/alert';
import { Button } from '../../../ui/button';
import { Info, Loader2, Sparkles } from 'lucide-react';

interface PrefillBannerProps {
  loading?: boolean;
  matchCount?: number;
  appliedCount?: number;
  resolverVersion?: string;
  clientId?: string;
  missingProfileHints?: string[];
  onReview?: () => void;
  onReapply?: () => void;
}

export function PrefillBanner({
  loading = false,
  matchCount = 0,
  appliedCount = 0,
  resolverVersion,
  clientId,
  missingProfileHints = [],
  onReview,
  onReapply,
}: PrefillBannerProps) {
  const profileEditUrl = clientId
    ? `/admin?module=clients&clientId=${encodeURIComponent(clientId)}`
    : '/admin?module=clients';

  return (
    <div className="space-y-2">
      <Alert className="border-purple-100 bg-purple-50/40">
        <Sparkles className="h-4 w-4 text-purple-600" />
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm">
            {loading && (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Matching client data…
              </span>
            )}
            {!loading && appliedCount > 0 && (
              <span>
                Prefilled {appliedCount} field{appliedCount === 1 ? '' : 's'} from the client record
                {resolverVersion ? ` (resolver ${resolverVersion})` : ''}.
              </span>
            )}
            {!loading && appliedCount === 0 && matchCount > 0 && (
              <span>
                {matchCount} client data match{matchCount === 1 ? '' : 'es'} available — review
                before applying
                {resolverVersion ? ` (v${resolverVersion})` : ''}.
              </span>
            )}
            {!loading && matchCount === 0 && appliedCount === 0 && (
              <span className="inline-flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                Client data can be matched to this form when available.
              </span>
            )}
          </span>
          <div className="flex flex-wrap gap-2">
            {onReview && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onReview}
                disabled={loading}
                data-testid="prefill-review-matches"
              >
                Review matches
              </Button>
            )}
            {onReapply && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onReapply}
                disabled={loading}
              >
                Re-apply
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
      {!loading && matchCount === 0 && appliedCount === 0 && missingProfileHints.length > 0 && (
        <Alert className="border-amber-100 bg-amber-50/50">
          <Info className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-sm text-amber-900">
            Profile may be incomplete — add {missingProfileHints.slice(0, 4).join(', ')}
            {missingProfileHints.length > 4 ? '…' : ''} for richer matches.{' '}
            <Link to={profileEditUrl} className="font-medium text-primary hover:underline">
              Edit client profile
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
