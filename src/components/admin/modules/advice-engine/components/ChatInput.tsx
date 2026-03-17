/**
 * ChatInput Component
 * 
 * Multi-line input for chat messages with auto-resize.
 * Supports keyboard shortcuts and character count.
 * 
 * @module advice-engine/components/ChatInput
 */

import React, { useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Textarea } from '../../../../ui/textarea';
import { Button } from '../../../../ui/button';
import type { ChatInputProps } from '../types';

/**
 * Chat input component with auto-resize
 * 
 * @example
 * <ChatInput
 *   value={input}
 *   onChange={setInput}
 *   onSubmit={handleSubmit}
 *   isLoading={false}
 *   placeholder="Ask a question..."
 *   maxLength={4000}
 * />
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  disabled = false,
  placeholder = 'Type your message... (Shift+Enter for new line)',
  maxLength = 4000,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && !disabled && value.trim()) {
        onSubmit();
      }
    }
  };

  const characterCount = value.length;
  const isOverLimit = characterCount > maxLength;
  const showCount = characterCount > maxLength * 0.8; // Show when 80% full

  return (
    <div className="space-y-2">
      {/* Input Area */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={`min-h-[80px] max-h-[300px] resize-none pr-12 ${
            isOverLimit ? 'border-red-300 focus:border-red-500' : ''
          }`}
          rows={1}
        />

        {/* Send Button */}
        <Button
          onClick={onSubmit}
          disabled={disabled || isLoading || !value.trim() || isOverLimit}
          size="sm"
          className="absolute right-3 bottom-3 h-8 w-8 p-0 rounded-full"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>

        {/* Character Count */}
        {showCount && (
            <div
              className={`absolute bottom-3 right-14 text-[10px] mr-2 ${
                isOverLimit ? 'text-red-600 font-bold' : 'text-muted-foreground'
              }`}
            >
              {characterCount}/{maxLength}
            </div>
          )}
      </div>

      {/* Footer / Help Text */}
      <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-2">
           <span className="flex items-center gap-1">
             <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-sans text-[10px]">Enter</kbd> to send
           </span>
           <span className="flex items-center gap-1">
             <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-sans text-[10px]">Shift + Enter</kbd> for new line
           </span>
        </div>
      </div>
    </div>
  );
}
