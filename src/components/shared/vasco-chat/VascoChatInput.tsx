/**
 * VascoChatInput — Unified chat input area with send button
 *
 * Auto-expanding textarea with an embedded send button,
 * error alert, and optional footer text.
 *
 * @module shared/vasco-chat/VascoChatInput
 */

import React, { useRef, useEffect } from 'react';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Alert, AlertDescription } from '../../ui/alert';

export interface VascoChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  error?: string | null;
  placeholder?: string;
  disabled?: boolean;
  /** Optional footer line (e.g. disclaimer or CTA) */
  footer?: React.ReactNode;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

export function VascoChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  error,
  placeholder = 'Ask Vasco about financial planning...',
  disabled = false,
  footer,
  autoFocus = false,
}: VascoChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      {error && (
        <Alert className="mb-3 border-amber-200 bg-amber-50 py-2">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-xs">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[55px] max-h-[120px] pr-14 resize-none py-3.5 px-4 rounded-xl border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary bg-gray-50 text-sm"
          disabled={isLoading || disabled}
        />
        <Button
          onClick={onSubmit}
          disabled={!value.trim() || isLoading || disabled}
          className="absolute right-2 bottom-2 h-9 w-9 p-0 rounded-lg bg-primary hover:bg-primary/90 shadow-sm transition-all"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <Send className="h-4 w-4 text-white ml-0.5" />
          )}
        </Button>
      </div>

      {footer && <div className="mt-2 px-1">{footer}</div>}
    </div>
  );
}
