/**
 * TrustBar — FSP/regulatory trust indicators shown on quote pages.
 */

import React from 'react';
import { Shield, CheckCircle, Phone, Lock } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  CheckCircle,
  Phone,
  Lock,
};

const TRUST_ITEMS = [
  { label: 'FSP 54606', icon: 'Shield' },
  { label: 'FSCA Regulated', icon: 'CheckCircle' },
  { label: 'Free Consultation', icon: 'Phone' },
  { label: 'No Obligation', icon: 'Lock' },
] as const;

interface TrustBarProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export function TrustBar({ variant = 'light', className = '' }: TrustBarProps) {
  return (
    <div
      className={`
        flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4 px-4 rounded-xl
        ${variant === 'dark' ? 'bg-white/5' : 'bg-gray-50 border border-gray-100'}
        ${className}
      `}
    >
      {TRUST_ITEMS.map((item) => {
        const Icon = ICON_MAP[item.icon] ?? Shield;
        return (
          <div
            key={item.label}
            className={`flex items-center gap-1.5 text-xs font-medium ${
              variant === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${variant === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
            {item.label}
          </div>
        );
      })}
    </div>
  );
}