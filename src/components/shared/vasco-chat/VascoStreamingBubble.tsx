/**
 * VascoStreamingBubble — Live-updating message bubble during SSE streaming
 *
 * Renders the partially-received assistant response with a
 * "Vasco is responding..." footer indicator.
 *
 * @module shared/vasco-chat/VascoStreamingBubble
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { MessageRenderer } from '../MessageRenderer';
import { VascoAvatar } from './VascoAvatar';

export interface VascoStreamingBubbleProps {
  /** Accumulated streaming content so far */
  content: string;
}

export function VascoStreamingBubble({ content }: VascoStreamingBubbleProps) {
  if (!content) return null;

  return (
    <div className="flex gap-3 justify-start">
      <VascoAvatar size="sm" />
      <div className="max-w-[85%] flex flex-col gap-1.5">
        <div className="rounded-2xl px-5 py-3.5 shadow-sm bg-white border border-gray-200 text-gray-900 rounded-bl-none shadow-xs">
          <div className="text-sm leading-relaxed markdown-content">
            <MessageRenderer content={content} role="assistant" />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Loader2 className="h-3 w-3 animate-spin text-primary/50" />
            <span className="text-[10px] text-gray-400">
              Vasco is responding...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
