/**
 * VascoAvatar — Nautical compass avatar for Vasco AI
 *
 * Shared between public and portal chat interfaces.
 * Uses a gradient purple compass icon in a circular container.
 *
 * @module shared/vasco-chat/VascoAvatar
 */

import React from 'react';
import { Compass } from 'lucide-react';

const SIZE_MAP = {
  sm: { container: 'h-8 w-8', icon: 'h-4 w-4' },
  md: { container: 'h-10 w-10', icon: 'h-5 w-5' },
  lg: { container: 'h-14 w-14', icon: 'h-7 w-7' },
  xl: { container: 'h-20 w-20', icon: 'h-10 w-10' },
} as const;

export function VascoAvatar({ size = 'md' }: { size?: keyof typeof SIZE_MAP }) {
  const s = SIZE_MAP[size];
  return (
    <div
      className={`${s.container} rounded-full bg-gradient-to-br from-primary via-[#5b21b6] to-[#4c1d95] flex items-center justify-center shadow-lg flex-shrink-0 ring-2 ring-white/10`}
    >
      <Compass className={`${s.icon} text-white`} />
    </div>
  );
}
