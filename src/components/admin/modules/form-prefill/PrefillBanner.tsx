import { Link } from 'react-router';
import { Button } from '../../../ui/button';
import { Info, Loader2, RefreshCw } from 'lucide-react';

interface PrefillBannerProps {
  loading?: boolean;
  matchCount?: number;
  appliedCount?: number;
  resolverVersion?: string;
  clientId?: string;
  missingProfileHints?: string[];
  onReview?: () => void;
  onReapply?: () => void;
  onRefreshFromPolicies?: () => void;
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
  onRefreshFromPolicies,
}: PrefillBannerProps) {
  const profileEditUrl = clientId
    ? `/admin?module=clients&clientId=${encodeURIComponent(clientId)}`
    : '/admin?module=clients';

  return (
    <div className="space-y-2" data-resolver-version={resolverVersion || undefined}>
      <div
        role="status"
        className="flex flex-col gap-3 rounded-lg border border-[var(--nw-info-line)] bg-[var(--nw-info-bg)] px-4 py-3 text-sm text-[var(--nw-info-dark)] sm:flex-row sm:items-center"
      >
        <span className="flex flex-1 items-start gap-2.5">
          {loading ? (
            <Loader2 className="mt-0.5 h-4 w-4 flex-none animate-spin" aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          )}
          <span>
            {loading && 'Matching client data…'}
            {!loading && appliedCount > 0 && (
              <>
                <strong className="font-semibold">
                  Prefilled {appliedCount} field{appliedCount === 1 ? '' : 's'} from the client
                  record.
                </strong>{' '}
                You can edit any of them.
              </>
            )}
            {!loading && appliedCount === 0 && matchCount > 0 && (
              <>
                <strong className="font-semibold">
                  {matchCount} value{matchCount === 1 ? '' : 's'} found in the client record.
                </strong>{' '}
                Review them before they fill the form.
              </>
            )}
            {!loading && matchCount === 0 && appliedCount === 0 && 'No client data to match yet.'}
          </span>
        </span>
        <div className="flex flex-wrap gap-2 max-sm:[&>button]:h-11 max-sm:[&>button]:flex-1">
          {onReview && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onReview}
              disabled={loading}
              data-testid="prefill-review-matches"
              className="bg-white"
            >
              {matchCount > 0 && appliedCount === 0
                ? `Review ${matchCount} match${matchCount === 1 ? '' : 'es'}`
                : 'Review matches'}
            </Button>
          )}
          {onRefreshFromPolicies && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRefreshFromPolicies}
              disabled={loading}
              data-testid="prefill-refresh-from-policies"
              className="bg-white"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Load from policies
            </Button>
          )}
          {onReapply && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onReapply}
              disabled={loading}
              className="text-[var(--nw-info-dark)] hover:bg-white/60"
            >
              Re-apply
            </Button>
          )}
        </div>
      </div>
      {!loading && matchCount === 0 && appliedCount === 0 && missingProfileHints.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-nw-warn-line bg-nw-warn-bg px-4 py-3 text-sm text-nw-warn-dark">
          <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          <span>
            Profile may be incomplete — add {missingProfileHints.slice(0, 4).join(', ')}
            {missingProfileHints.length > 4 ? '…' : ''} for richer matches.{' '}
            <Link to={profileEditUrl} className="font-semibold underline-offset-2 hover:underline">
              Edit client profile
            </Link>
          </span>
        </div>
      )}
    </div>
  );
}
