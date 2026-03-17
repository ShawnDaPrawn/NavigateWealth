/**
 * VascoTypingIndicator — Bouncing dots shown while waiting for a response
 *
 * @module shared/vasco-chat/VascoTypingIndicator
 */

import React from 'react';
import { VascoAvatar } from './VascoAvatar';

export function VascoTypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <VascoAvatar size="sm" />
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-5 py-4 shadow-xs">
        <div className="flex gap-1.5">
          <div
            className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <div
            className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}
