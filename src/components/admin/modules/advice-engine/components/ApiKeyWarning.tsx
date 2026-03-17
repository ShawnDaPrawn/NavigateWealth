/**
 * ApiKeyWarning Component
 * 
 * Warning alert for missing or invalid API key.
 * 
 * @module advice-engine/components/ApiKeyWarning
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Badge } from '../../../../ui/badge';
import type { ApiKeyWarningProps } from '../types';

/**
 * API key warning component
 * 
 * @example
 * <ApiKeyWarning
 *   status={{ configured: false, valid: false }}
 *   onDismiss={() => console.log('Dismissed')}
 * />
 */
export function ApiKeyWarning({ status, onDismiss }: ApiKeyWarningProps) {
  // Don't show if API key is configured
  if (!status || status.configured) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Main Warning Alert */}
      <Alert className="border-amber-200 bg-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-900 text-sm">
          <strong>Action Required:</strong> OpenAI API key needs to be updated.
          {status.error && (
            <span className="block mt-1 text-xs">
              Error: {status.error}
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Compliance Badge */}
      <Badge
        variant="outline"
        className="border-orange-200 bg-orange-50 text-orange-700 w-full justify-start py-2"
      >
        <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
        <span className="text-xs">
          AI guidance only. Verify all information before advising clients. Ensure FAIS compliance.
        </span>
      </Badge>
    </div>
  );
}
