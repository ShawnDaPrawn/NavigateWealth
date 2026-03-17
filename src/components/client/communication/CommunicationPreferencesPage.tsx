/**
 * CommunicationPreferencesPage — Client Portal
 *
 * Thin composition layer for managing communication preferences.
 * All data flows through React Query hooks.
 * Guidelines refs: §4.1, §7, §11.2
 */

import { useState } from 'react';
import {
  Mail,
  MessageSquare,
  Shield,
  CheckCircle,
  Info,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Inbox,
  Loader2,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Alert, AlertDescription } from '../../ui/alert';
import { Separator } from '../../ui/separator';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../auth/AuthContext';

import { TRANSACTIONAL_EXAMPLES, MARKETING_EXAMPLES, DEFAULT_PREFERENCES } from './constants';
import { countActiveChannels } from './utils';
import { useCommunicationPreferences, useUpdatePreferences } from './hooks/useCommunicationPreferences';
import { PreferenceToggle } from './components/PreferenceToggle';
import { FrequencySelector } from './components/FrequencySelector';
import { PreferencesSummary } from './components/PreferencesSummary';
import { PreferencesHeader } from './components/PreferencesHeader';
import type { CommunicationSettings, NotificationFrequency } from './types';

export function CommunicationPreferencesPage() {
  const { user } = useAuth();
  const { data: savedPrefs, isLoading: isFetching } = useCommunicationPreferences();
  const updateMutation = useUpdatePreferences();

  // Local draft state — initialised from server data or defaults
  const [preferences, setPreferences] = useState<CommunicationSettings>(
    savedPrefs ?? DEFAULT_PREFERENCES,
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync from server when data arrives (first load)
  // Using a ref-like approach: if savedPrefs changed and we haven't edited yet
  const [hydrated, setHydrated] = useState(false);
  if (savedPrefs && !hydrated) {
    setPreferences(savedPrefs);
    setHydrated(true);
  }

  const handleChange = (
    category: 'transactional' | 'marketing',
    method: 'email' | 'sms',
    value: boolean,
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [category]: { ...prev[category], [method]: value },
    }));
    setSaveSuccess(false);
  };

  const handleFrequencyChange = (frequency: NotificationFrequency) => {
    setPreferences((prev) => ({ ...prev, frequency }));
    setSaveSuccess(false);
  };

  const handleQuickToggle = (type: 'all' | 'none') => {
    if (type === 'all') {
      setPreferences((prev) => ({
        ...prev,
        transactional: { email: true, sms: true },
        marketing: { email: true, sms: true },
      }));
    } else {
      setPreferences((prev) => ({
        ...prev,
        transactional: { email: true, sms: false },
        marketing: { email: false, sms: false },
      }));
    }
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(preferences);
      setSaveSuccess(true);
      toast.success('Communication preferences saved.');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error('Unable to save preferences. Please try again.');
    }
  };

  const activeCount = countActiveChannels(preferences);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Loading overlay */}
      {isFetching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <p className="text-sm text-gray-600">Loading your preferences...</p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Header + stats + quick actions — extracted component */}
        <PreferencesHeader
          preferences={preferences}
          activeCount={activeCount}
          onQuickToggle={handleQuickToggle}
        />

        {/* Save success */}
        {saveSuccess && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Your communication preferences have been saved successfully!
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Important notice */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            <strong>Important:</strong> You can opt-out of marketing communications while continuing to receive essential account notifications for security and compliance.
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {/* Essential Communications */}
          <Card className="border-gray-200">
            <CardHeader className="bg-gradient-to-br from-green-50 to-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle>Essential Communications</CardTitle>
                      <Badge className="bg-green-100 text-green-700 border-green-200">Required</Badge>
                    </div>
                    <CardDescription className="mt-1">
                      Critical account updates and security notifications
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid gap-4">
                <PreferenceToggle
                  icon={Mail}
                  iconBgClass="bg-blue-100"
                  iconColorClass="text-blue-600"
                  title="Email Notifications"
                  subtitle={user?.email ?? 'Your registered email'}
                  checked={preferences.transactional.email}
                  onChange={(v) => handleChange('transactional', 'email', v)}
                />
                <PreferenceToggle
                  icon={MessageSquare}
                  iconBgClass="bg-green-100"
                  iconColorClass="text-green-600"
                  title="SMS Alerts"
                  subtitle="Instant notifications to your mobile"
                  checked={preferences.transactional.sms}
                  onChange={(v) => handleChange('transactional', 'sms', v)}
                />
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Inbox className="h-4 w-4 text-gray-600" />
                  <p className="text-sm text-gray-900">What you'll receive:</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {TRANSACTIONAL_EXAMPLES.map((ex, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{ex}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800">
                  <strong>Legal Requirement:</strong> Some notifications (security alerts, regulatory notices) cannot be disabled as they're required by law and essential for account protection.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Marketing Communications */}
          <Card className="border-gray-200">
            <CardHeader className="bg-gradient-to-br from-purple-50 to-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-[#6d28d9]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle>Marketing & Insights</CardTitle>
                      <Badge variant="outline" className="border-[#6d28d9]/30 text-[#6d28d9]">Optional</Badge>
                    </div>
                    <CardDescription className="mt-1">
                      Market updates, newsletters, and educational content
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid gap-4">
                <PreferenceToggle
                  icon={Mail}
                  iconBgClass={preferences.marketing.email ? 'bg-[#6d28d9]/20' : 'bg-purple-100'}
                  iconColorClass={preferences.marketing.email ? 'text-[#6d28d9]' : 'text-purple-600'}
                  title="Email Marketing"
                  subtitle="Newsletters and market insights"
                  checked={preferences.marketing.email}
                  onChange={(v) => handleChange('marketing', 'email', v)}
                  highlightActive
                />
                <PreferenceToggle
                  icon={MessageSquare}
                  iconBgClass={preferences.marketing.sms ? 'bg-[#6d28d9]/20' : 'bg-orange-100'}
                  iconColorClass={preferences.marketing.sms ? 'text-[#6d28d9]' : 'text-orange-600'}
                  title="SMS Marketing"
                  subtitle="Time-sensitive opportunities"
                  checked={preferences.marketing.sms}
                  onChange={(v) => handleChange('marketing', 'sms', v)}
                  highlightActive
                />
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Inbox className="h-4 w-4 text-gray-600" />
                  <p className="text-sm text-gray-900">What you might receive:</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {MARKETING_EXAMPLES.map((ex, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-[#6d28d9] mt-0.5 flex-shrink-0" />
                      <span>{ex}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Alert className="border-[#6d28d9]/20 bg-[#6d28d9]/5">
                <Shield className="h-4 w-4 text-[#6d28d9]" />
                <AlertDescription className="text-sm text-gray-800">
                  <strong>Privacy Guarantee:</strong> We respect your privacy and will never share your contact information with third parties. Unsubscribe anytime.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Frequency */}
          <FrequencySelector value={preferences.frequency} onChange={handleFrequencyChange} />

          {/* Summary + Save */}
          <PreferencesSummary
            preferences={preferences}
            isSaving={updateMutation.isPending}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
