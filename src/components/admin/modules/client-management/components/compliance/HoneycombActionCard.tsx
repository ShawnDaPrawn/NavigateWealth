/**
 * HoneycombActionCard — Reusable card for triggering Honeycomb compliance checks.
 *
 * Displays a titled card with icon, description, and action button.
 * Shows loading state during API call and result summary on completion.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { Loader2, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../../../../../../utils/supabase/info';
import { getAuthToken } from './compliance-auth';

interface HoneycombActionCardProps {
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Icon component to render in the header */
  icon: React.ReactNode;
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
  /** Card background colour variant */
  variant?: 'default' | 'blue' | 'green' | 'amber';
  /** Custom content to render above the button (e.g. extra form fields) */
  children?: React.ReactNode;
  /** Called after a successful response */
  onSuccess?: (data: unknown) => void;
  /** Called after an error */
  onError?: (error: string) => void;
}

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/honeycomb`;

const variantStyles: Record<string, string> = {
  default: 'bg-slate-50 border-slate-200',
  blue: 'bg-blue-50/50 border-blue-200',
  green: 'bg-green-50/50 border-green-200',
  amber: 'bg-amber-50/50 border-amber-200',
};

export function HoneycombActionCard({
  title,
  description,
  icon,
  actionLabel,
  endpoint,
  requestBody,
  disabled = false,
  disabledReason,
  variant = 'default',
  children,
  onSuccess,
  onError,
}: HoneycombActionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  const [showRawResponse, setShowRawResponse] = useState(false);

  const handleAction = async () => {
    setIsLoading(true);
    setResult(null);
    const toastId = toast.loading(`Running ${title}...`);

    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = data?.error || `Request failed (${res.status})`;
        const errorStr = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
        setResult({ success: false, error: errorStr });
        toast.error(errorStr, { id: toastId });
        onError?.(errorStr);
        return;
      }

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

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className="pb-3">
        <CardTitle className="text-md font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}

        <Button
          className="w-full"
          variant="secondary"
          onClick={handleAction}
          disabled={isLoading || disabled}
          title={disabled ? disabledReason : undefined}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {actionLabel}
        </Button>

        {disabled && disabledReason && (
          <p className="text-xs text-amber-600">{disabledReason}</p>
        )}

        {/* Result display */}
        {result && (
          <div className={`mt-3 rounded-lg p-3 text-sm ${
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-2 font-medium">
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <span className={result.success ? 'text-green-800' : 'text-red-800'}>
                {result.success ? 'Check Completed' : 'Check Failed'}
              </span>
            </div>

            {result.error && (
              <p className="mt-1 text-red-700 text-xs">{result.error}</p>
            )}

            {result.success && result.data && (
              <div className="mt-2">
                {/* Show matterId if present */}
                {(result.data as Record<string, unknown>)?.matterId && (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <span>Matter ID:</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {String((result.data as Record<string, unknown>).matterId)}
                    </Badge>
                  </div>
                )}

                {/* Toggle raw response */}
                <button
                  onClick={() => setShowRawResponse(!showRawResponse)}
                  className="flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showRawResponse ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showRawResponse ? 'Hide' : 'Show'} details
                </button>

                {showRawResponse && (
                  <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-auto max-h-48 font-mono">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}