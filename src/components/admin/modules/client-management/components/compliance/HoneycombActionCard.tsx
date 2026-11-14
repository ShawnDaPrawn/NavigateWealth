/**
 * HoneycombActionCard — Reusable card for triggering Honeycomb compliance checks.
 *
 * Displays a titled card with icon, description, and action button.
 * Shows loading state during API call and result summary on completion.
 */

import React, { useState } from 'react';
import { Button } from '../../../../../ui/button';
import { Loader2 } from 'lucide-react';
import { StatusPill } from './ComplianceShared';
import { toast } from 'sonner';
import { api } from '../../../../../../utils/api';

interface HoneycombActionCardProps {
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Kept for callers; the design (CM-K-*) shows no icon in the card header. */
  icon?: React.ReactNode;
  /** Label for the action button */
  actionLabel: string;
  /** Server route path (relative to /integrations/honeycomb/) */
  endpoint: string;
  /** Request body to send */
  requestBody: Record<string, unknown>;
  /** Whether the action button should be disabled */
  disabled?: boolean;
  /** Tooltip/reason why the button is disabled */
  disabledReason?: string;
  /** Kept for callers; every card is now the same white card. */
  variant?: 'default' | 'blue' | 'green' | 'amber';
  /** Custom content to render above the button (e.g. extra form fields) */
  children?: React.ReactNode;
  /** Called after a successful response */
  onSuccess?: (data: unknown) => void;
  /** Called after an error */
  onError?: (error: string) => void;
}

export function HoneycombActionCard({
  title,
  description,
  actionLabel,
  endpoint,
  requestBody,
  disabled = false,
  disabledReason,
  children,
  onSuccess,
  onError,
}: HoneycombActionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(
    null,
  );
  const [showRawResponse, setShowRawResponse] = useState(false);

  const handleAction = async () => {
    setIsLoading(true);
    setResult(null);
    const toastId = toast.loading(`Running ${title}...`);

    try {
      const data = await api.post<unknown>(`/integrations/honeycomb/${endpoint}`, requestBody);

      setResult({ success: true, data });
      toast.success(`${title} completed successfully`, { id: toastId });
      onSuccess?.(data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setResult({ success: false, error: errorMsg });
      toast.error(errorMsg, { id: toastId });
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const matterId =
    result?.success && result.data ? (result.data as Record<string, unknown>).matterId : undefined;

  return (
    <section className="flex flex-col rounded-xl border border-nw-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-nw-ink">{title}</h3>
        {result && (
          <StatusPill tone={result.success ? 'good' : 'bad'}>
            {result.success ? 'Completed' : 'Failed'}
          </StatusPill>
        )}
      </div>
      <p className="mt-2 text-sm text-nw-text-2">{description}</p>

      {children && <div className="mt-3 space-y-3">{children}</div>}

      <div className="mt-4">
        <Button
          variant="outline"
          onClick={handleAction}
          disabled={isLoading || disabled}
          title={disabled ? disabledReason : undefined}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {actionLabel}
        </Button>
      </div>

      {disabled && disabledReason && (
        <p className="mt-2 text-xs text-nw-amber-700">{disabledReason}</p>
      )}

      {result && (result.error || result.success) && (
        <div className="mt-3 space-y-2 text-sm">
          {result.error && <p className="text-xs text-red-700">{result.error}</p>}
          {result.success && !!result.data && (
            <>
              {!!matterId && (
                <p className="text-xs text-nw-text-2">
                  Matter ID <span className="font-mono text-nw-ink">{String(matterId)}</span>
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowRawResponse(!showRawResponse)}
                className="text-xs font-medium text-nw-violet hover:underline"
              >
                {showRawResponse ? 'Hide' : 'Show'} details
              </button>
              {showRawResponse && (
                <pre className="max-h-48 overflow-auto rounded bg-gray-900 p-2 font-mono text-xs text-gray-100">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
