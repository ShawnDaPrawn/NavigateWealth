/**
 * AuthTrustBar — compact trust indicators shown below auth forms on mobile.
 * Hidden on desktop where the right-column showcase provides this context.
 */

import React from 'react';
import { Shield, CheckCircle, Lock } from 'lucide-react';

const TRUST_ITEMS = [
  { label: 'FSP 54606', icon: Shield },
  { label: 'FSCA Regulated', icon: CheckCircle },
  { label: 'POPIA Compliant', icon: Lock },
] as const;

export function AuthTrustBar() {
  return (
    <div className="mt-6 lg:hidden">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-3 px-4 rounded-lg bg-gray-50 border border-gray-100">
        {TRUST_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Icon className="h-3.5 w-3.5 text-green-600" />
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
