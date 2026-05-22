import React from 'react';
import { Alert, AlertDescription } from '../../../ui/alert';
import { Button } from '../../../ui/button';
import { Info, Loader2, Sparkles } from 'lucide-react';

interface PrefillBannerProps {
  loading?: boolean;
  matchCount?: number;
  appliedCount?: number;
  onReview?: () => void;
  onReapply?: () => void;
}

export function PrefillBanner({
  loading = false,
  matchCount = 0,
  appliedCount = 0,
  onReview,
  onReapply,
}: PrefillBannerProps) {
  return (
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
              Prefilled {appliedCount} field{appliedCount === 1 ? '' : 's'} from the client record.
            </span>
          )}
          {!loading && appliedCount === 0 && matchCount > 0 && (
            <span>{matchCount} client data match{matchCount === 1 ? '' : 'es'} available — review before applying.</span>
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
            <Button type="button" size="sm" variant="outline" onClick={onReview} disabled={loading}>
              Review matches
            </Button>
          )}
          {onReapply && (
            <Button type="button" size="sm" variant="ghost" onClick={onReapply} disabled={loading}>
              Re-apply
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
