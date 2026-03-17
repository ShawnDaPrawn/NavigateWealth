/**
 * PreferencesHeader — Header area with icon, title, stats grid, and quick-toggle actions.
 *
 * Extracted from CommunicationPreferencesPage to keep the page as a thin composition layer.
 * Guidelines refs: §4.1 (module structure), §8.3 (stat card standards)
 */

import {
  Bell,
  Mail,
  Smartphone,
  Activity,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '../../../ui/button';
import type { CommunicationSettings } from '../types';

interface PreferencesHeaderProps {
  /** Current (draft) preferences state */
  preferences: CommunicationSettings;
  /** Number of active channels out of 4 */
  activeCount: number;
  /** Quick-toggle handler */
  onQuickToggle: (type: 'all' | 'none') => void;
}

export function PreferencesHeader({
  preferences,
  activeCount,
  onQuickToggle,
}: PreferencesHeaderProps) {
  return (
    <div className="mb-6 lg:mb-8">
      <div className="flex flex-col gap-4">
        {/* Title row */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 lg:h-16 lg:w-16 rounded-full bg-gradient-to-br from-[#6d28d9] to-[#5b21b6] flex items-center justify-center shadow-lg">
            <Bell className="h-7 w-7 lg:h-8 lg:w-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl text-gray-900">Communication Preferences</h1>
            <p className="text-sm lg:text-base text-gray-600 mt-1">
              Customize how you receive updates from Navigate Wealth
            </p>
          </div>
        </div>

        {/* Quick Stats & Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="grid grid-cols-3 gap-3 flex-1">
            {/* Active channels */}
            <div className="p-3 rounded-lg bg-white border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Active</span>
                <Activity className="h-3 w-3 text-green-600" />
              </div>
              <p className="text-lg text-gray-900">{activeCount}/4</p>
            </div>

            {/* Email status */}
            <div className="p-3 rounded-lg bg-white border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Email</span>
                <Mail className="h-3 w-3 text-[#6d28d9]" />
              </div>
              <p className="text-lg text-gray-900">
                {preferences.transactional.email || preferences.marketing.email ? 'On' : 'Off'}
              </p>
            </div>

            {/* SMS status */}
            <div className="p-3 rounded-lg bg-white border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">SMS</span>
                <Smartphone className="h-3 w-3 text-[#6d28d9]" />
              </div>
              <p className="text-lg text-gray-900">
                {preferences.transactional.sms || preferences.marketing.sms ? 'On' : 'Off'}
              </p>
            </div>
          </div>

          {/* Quick toggles */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onQuickToggle('all')}
              className="flex-1 sm:flex-none"
            >
              <Volume2 className="h-4 w-4 mr-2" />
              Enable All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onQuickToggle('none')}
              className="flex-1 sm:flex-none"
            >
              <VolumeX className="h-4 w-4 mr-2" />
              Disable Optional
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
