/**
 * PreferencesSummary — Summary card showing current preference state + save button.
 */

import { Settings, Shield, TrendingUp, CheckCircle2, XCircle, Save, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Separator } from '../../../ui/separator';
import type { CommunicationSettings } from '../types';

interface PreferencesSummaryProps {
  preferences: CommunicationSettings;
  isSaving: boolean;
  onSave: () => void;
}

function StatusBadge({ active, variant }: { active: boolean; variant: 'green' | 'purple' }) {
  if (active) {
    const cls = variant === 'green'
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-[#6d28d9]/10 text-[#6d28d9] border-[#6d28d9]/20';
    return (
      <Badge className={cls}>
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-gray-100 text-gray-600">
      <XCircle className="h-3 w-3 mr-1" />
      Inactive
    </Badge>
  );
}

export function PreferencesSummary({ preferences, isSaving, onSave }: PreferencesSummaryProps) {
  return (
    <Card className="border-gray-200">
      <CardHeader className="bg-gradient-to-br from-gray-50 to-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-[#6d28d9]" />
          </div>
          <div>
            <CardTitle>Preferences Summary</CardTitle>
            <CardDescription>Quick overview of your current settings</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transactional */}
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-900">Essential Communications</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Email</span>
                <StatusBadge active={preferences.transactional.email} variant="green" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">SMS</span>
                <StatusBadge active={preferences.transactional.sms} variant="green" />
              </div>
            </div>
          </div>

          {/* Marketing */}
          <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-[#6d28d9]" />
              <span className="text-sm text-purple-900">Marketing & Insights</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Email</span>
                <StatusBadge active={preferences.marketing.email} variant="purple" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">SMS</span>
                <StatusBadge active={preferences.marketing.sms} variant="purple" />
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600 text-center sm:text-left">
            Need help with your preferences?
            <a href="/contact" className="text-[#6d28d9] hover:underline ml-1">
              Contact Support
            </a>
          </p>

          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white w-full sm:w-auto"
          >
            {isSaving ? (
              <div className="contents">
                <Activity className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </div>
            ) : (
              <div className="contents">
                <Save className="h-4 w-4 mr-2" />
                Save Preferences
              </div>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
