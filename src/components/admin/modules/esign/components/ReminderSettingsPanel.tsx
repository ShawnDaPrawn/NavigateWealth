/**
 * ReminderSettingsPanel
 * Admin panel for configuring auto-reminder settings per envelope.
 * Includes auto-remind toggle, interval, max count, and expiry warning threshold.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  BellOff,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Settings,
  ListOrdered,
  Shuffle,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import { Input } from '../../../../ui/input';
import { esignApi } from '../api';
import type { ReminderConfig, SigningMode } from '../types';
import { toast } from 'react-toastify';

// ==================== REMINDER CONFIG PANEL ====================

interface ReminderConfigPanelProps {
  envelopeId: string;
  envelopeStatus: string;
}

export function ReminderConfigPanel({ envelopeId, envelopeStatus }: ReminderConfigPanelProps) {
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderResult, setReminderResult] = useState<string | null>(null);

  const isActive = ['sent', 'viewed', 'partially_signed', 'in_progress'].includes(envelopeStatus);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const { config: fetchedConfig } = await esignApi.getReminderConfig(envelopeId);
      setConfig(fetchedConfig);
    } catch (err) {
      console.error('Failed to load reminder config:', err);
    } finally {
      setLoading(false);
    }
  }, [envelopeId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleUpdate = async (updates: Partial<ReminderConfig>) => {
    if (!config) return;
    try {
      setSaving(true);
      const { config: updated } = await esignApi.updateReminderConfig(envelopeId, updates);
      setConfig(updated);
      toast.success('Reminder settings saved successfully');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save reminder settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSendReminder = async () => {
    try {
      setSendingReminder(true);
      setReminderResult(null);
      const result = await esignApi.sendReminder(envelopeId);
      setReminderResult(`Sent ${result.totalReminders} reminder(s)`);
      setTimeout(() => setReminderResult(null), 5000);
    } catch (err: unknown) {
      setReminderResult(err instanceof Error ? err.message : 'Failed to send reminders');
      setTimeout(() => setReminderResult(null), 5000);
    } finally {
      setSendingReminder(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading reminder settings...</span>
        </CardContent>
      </Card>
    );
  }

  if (!config) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-purple-600" />
            Reminder Settings
          </CardTitle>
          {isActive && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendReminder}
              disabled={sendingReminder}
              className="text-xs"
            >
              {sendingReminder ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Bell className="h-3 w-3 mr-1" />
              )}
              Send Reminder Now
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto-remind toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              {config.auto_remind ? (
                <Bell className="h-4 w-4 text-purple-600" />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
              Auto-Reminders
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically send reminders to pending signers
            </p>
          </div>
          <Switch
            checked={config.auto_remind}
            onCheckedChange={(checked) => handleUpdate({ auto_remind: checked })}
            disabled={saving || !isActive}
          />
        </div>

        {config.auto_remind && (
          <div className="contents">
            {/* P5.3 — cadence strategy */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cadence</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={saving || !isActive}
                  onClick={() => handleUpdate({ schedule: 'escalating' })}
                  className={`p-2.5 rounded-md border text-left transition-colors ${
                    (config.schedule ?? 'escalating') === 'escalating'
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } disabled:opacity-60`}
                >
                  <div className="text-xs font-medium text-gray-800">Escalating (recommended)</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Reminders at {(config.escalation_offsets_days ?? [3, 7, 10, 13]).join(', ')} days after invite.
                  </div>
                </button>
                <button
                  type="button"
                  disabled={saving || !isActive}
                  onClick={() => handleUpdate({ schedule: 'fixed' })}
                  className={`p-2.5 rounded-md border text-left transition-colors ${
                    config.schedule === 'fixed'
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } disabled:opacity-60`}
                >
                  <div className="text-xs font-medium text-gray-800">Fixed interval</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Every {config.remind_interval_days} day(s) until signed.
                  </div>
                </button>
              </div>
            </div>

            {/* Interval (fixed mode) + Max reminders */}
            <div className="grid grid-cols-2 gap-3">
              {config.schedule === 'fixed' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Interval (days)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={config.remind_interval_days}
                    onChange={(e) => handleUpdate({ remind_interval_days: parseInt(e.target.value) || 3 })}
                    disabled={saving || !isActive}
                    className="h-8 text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Offsets (days, comma-separated)
                  </Label>
                  <Input
                    type="text"
                    defaultValue={(config.escalation_offsets_days ?? [3, 7, 10, 13]).join(',')}
                    onBlur={(e) => {
                      const parsed = e.target.value
                        .split(',')
                        .map((s) => parseInt(s.trim(), 10))
                        .filter((n) => Number.isFinite(n) && n > 0);
                      if (parsed.length > 0) {
                        handleUpdate({ escalation_offsets_days: parsed });
                      }
                    }}
                    disabled={saving || !isActive}
                    className="h-8 text-sm"
                    placeholder="3,7,10,13"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Max Reminders
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={config.max_reminders}
                  onChange={(e) => handleUpdate({ max_reminders: parseInt(e.target.value) || 5 })}
                  disabled={saving || !isActive}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Expiry warning */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Urgent reminder (days before expiry)
              </Label>
              <Input
                type="number"
                min={1}
                max={14}
                value={config.remind_before_expiry_days}
                onChange={(e) => handleUpdate({ remind_before_expiry_days: parseInt(e.target.value) || 2 })}
                disabled={saving || !isActive}
                className="h-8 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Send an urgent reminder when the envelope is about to expire
              </p>
            </div>
          </div>
        )}

        {/* Manual reminder result */}
        {reminderResult && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md ${
            reminderResult.startsWith('Sent')
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}>
            {reminderResult.startsWith('Sent') ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {reminderResult}
          </div>
        )}

        {saving && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== SIGNING MODE SELECTOR ====================

interface SigningModeSelectorProps {
  envelopeId: string;
  currentMode: SigningMode;
  envelopeStatus: string;
  onModeChange?: (mode: SigningMode) => void;
}

export function SigningModeSelector({
  envelopeId,
  currentMode,
  envelopeStatus,
  onModeChange,
}: SigningModeSelectorProps) {
  const [mode, setMode] = useState<SigningMode>(currentMode);
  const [saving, setSaving] = useState(false);
  const canChange = ['draft', 'sent'].includes(envelopeStatus);

  const handleChange = async (newMode: SigningMode) => {
    if (newMode === mode || !canChange) return;
    try {
      setSaving(true);
      await esignApi.updateSigningMode(envelopeId, newMode);
      setMode(newMode);
      onModeChange?.(newMode);
    } catch (err) {
      console.error('Failed to update signing mode:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {mode === 'sequential' ? (
            <ListOrdered className="h-4 w-4 text-purple-600" />
          ) : (
            <Shuffle className="h-4 w-4 text-blue-600" />
          )}
          Signing Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleChange('sequential')}
            disabled={saving || !canChange}
            className={`relative p-3 rounded-lg border-2 text-left transition-all ${
              mode === 'sequential'
                ? 'border-purple-400 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${!canChange ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ListOrdered className={`h-4 w-4 ${mode === 'sequential' ? 'text-purple-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${mode === 'sequential' ? 'text-purple-700' : 'text-gray-700'}`}>
                Sequential
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Signers sign one at a time, in order. Next is notified when previous completes.
            </p>
            {mode === 'sequential' && (
              <div className="absolute top-2 right-2">
                <CheckCircle2 className="h-4 w-4 text-purple-600" />
              </div>
            )}
          </button>

          <button
            onClick={() => handleChange('parallel')}
            disabled={saving || !canChange}
            className={`relative p-3 rounded-lg border-2 text-left transition-all ${
              mode === 'parallel'
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${!canChange ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Shuffle className={`h-4 w-4 ${mode === 'parallel' ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${mode === 'parallel' ? 'text-blue-700' : 'text-gray-700'}`}>
                Parallel
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              All signers are invited at once and can sign in any order.
            </p>
            {mode === 'parallel' && (
              <div className="absolute top-2 right-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
              </div>
            )}
          </button>
        </div>

        {!canChange && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Signing mode can only be changed for draft or sent envelopes.
          </p>
        )}

        {saving && (
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating...
          </p>
        )}
      </CardContent>
    </Card>
  );
}