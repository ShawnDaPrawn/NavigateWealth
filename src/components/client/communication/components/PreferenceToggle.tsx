/**
 * PreferenceToggle — Reusable row for toggling a communication channel preference.
 */

import type { LucideIcon } from 'lucide-react';
import { Switch } from '../../../ui/switch';

interface PreferenceToggleProps {
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Whether the card should highlight when active */
  highlightActive?: boolean;
}

export function PreferenceToggle({
  icon: Icon,
  iconBgClass,
  iconColorClass,
  title,
  subtitle,
  checked,
  onChange,
  highlightActive = false,
}: PreferenceToggleProps) {
  const baseClass = highlightActive
    ? checked
      ? 'border-[#6d28d9]/30 bg-[#6d28d9]/5'
      : 'border-gray-200 bg-white hover:border-gray-300'
    : 'border-gray-200 bg-white hover:border-[#6d28d9]/30';

  return (
    <div className={`p-4 rounded-lg border transition-colors ${baseClass}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBgClass}`}
          >
            <Icon className={`h-5 w-5 ${iconColorClass}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900">{title}</p>
            <p className="text-sm text-gray-600 truncate">{subtitle}</p>
          </div>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          className="data-[state=checked]:bg-[#6d28d9] flex-shrink-0"
        />
      </div>
    </div>
  );
}
