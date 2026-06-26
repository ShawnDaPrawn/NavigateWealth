/**
 * AuthTrustBar — compact trust indicators shown below auth forms.
 *
 * In the split browser layout the dark brand panel carries the compliance
 * context from the `md` breakpoint up, so the bar is hidden there. In the
 * installed PWA (which never renders the brand panel) it stays visible at all
 * sizes — controlled via `hideWhenBrandPanelVisible`.
 */

import { Shield, CheckCircle, Lock } from 'lucide-react';

const TRUST_ITEMS = [
  { label: 'FSP 54606', icon: Shield },
  { label: 'FSCA Regulated', icon: CheckCircle },
  { label: 'POPIA Compliant', icon: Lock },
] as const;

interface AuthTrustBarProps {
  /**
   * When true, hide the bar from the `md` breakpoint up — appropriate when the
   * split brand panel is rendered alongside the form and provides the same
   * trust context. When false (installed PWA), keep it visible on all sizes.
   */
  hideWhenBrandPanelVisible?: boolean;
}

export function AuthTrustBar({ hideWhenBrandPanelVisible = false }: AuthTrustBarProps) {
  return (
    <div className={`mt-6 ${hideWhenBrandPanelVisible ? 'md:hidden' : ''}`}>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-3 px-4 rounded-lg bg-gray-50 border border-gray-100">
        {TRUST_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500"
            >
              <Icon className="h-3.5 w-3.5 text-green-600" />
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
