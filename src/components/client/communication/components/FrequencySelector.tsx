/**
 * FrequencySelector — Radio-style card picker for notification frequency.
 */

import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/card';
import type { NotificationFrequency } from '../types';

const FREQUENCY_OPTIONS: { value: NotificationFrequency; label: string; description: string }[] = [
  { value: 'realtime', label: 'Real-time', description: 'Receive updates as they happen' },
  { value: 'daily', label: 'Daily Digest', description: 'One summary email per day' },
  { value: 'weekly', label: 'Weekly Summary', description: 'One summary email per week' },
];

interface FrequencySelectorProps {
  value: NotificationFrequency;
  onChange: (frequency: NotificationFrequency) => void;
}

export function FrequencySelector({ value, onChange }: FrequencySelectorProps) {
  return (
    <Card className="border-gray-200">
      <CardHeader className="bg-gradient-to-br from-gray-50 to-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-[#6d28d9]" />
          </div>
          <div>
            <CardTitle>Notification Frequency</CardTitle>
            <CardDescription>Control how often you receive non-urgent updates</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FREQUENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                value === opt.value
                  ? 'border-[#6d28d9] bg-[#6d28d9]/5 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    value === opt.value ? 'border-[#6d28d9]' : 'border-gray-300'
                  }`}
                >
                  {value === opt.value && (
                    <div className="h-2.5 w-2.5 rounded-full bg-[#6d28d9]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-gray-900 mb-1">{opt.label}</p>
                  <p className="text-xs text-gray-600">{opt.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
