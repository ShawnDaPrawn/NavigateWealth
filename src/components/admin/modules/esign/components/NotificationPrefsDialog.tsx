/**
 * P5.2 — Sender notification preferences dialog.
 *
 * Four modes, mutually exclusive:
 *   - Every event        — receive an email for every signer activity
 *   - Completion only    — receive an email only when an envelope terminates
 *   - Daily digest       — one summary email per day
 *   - Off                — no sender emails at all (not recommended)
 *
 * We keep the UI intentionally small so there's nothing to "learn". The
 * helper copy under each option describes the impact so the sender can
 * pick without reading a doc.
 */

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../../../ui/radio-group';
import { toast } from 'sonner';
import { esignApi } from '../api';
import { logger } from '../../../../../utils/logger';

type Mode = 'every_event' | 'completion_only' | 'digest' | 'off';

interface NotificationPrefsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OPTIONS: Array<{ value: Mode; label: string; description: string }> = [
  {
    value: 'every_event',
    label: 'Every event',
    description: 'Get an email for every signer action (signed, declined, expired, completed).',
  },
  {
    value: 'completion_only',
    label: 'Completion only',
    description: 'Email me only when an envelope is completed, declined, or expires.',
  },
  {
    value: 'digest',
    label: 'Daily digest',
    description: 'One summary email per day with all events. Completion emails still land immediately.',
  },
  {
    value: 'off',
    label: 'Off',
    description: 'No sender emails at all. Use only if you check the dashboard daily.',
  },
];

export function NotificationPrefsDialog({ open, onOpenChange }: NotificationPrefsDialogProps) {
  const [mode, setMode] = useState<Mode>('every_event');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { preferences } = await esignApi.getNotificationPreferences();
        if (!cancelled) setMode(preferences.mode);
      } catch (err) {
        logger.error('Failed to load notification preferences:', err);
        toast.error('Failed to load preferences');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await esignApi.setNotificationPreferences({ mode });
      toast.success('Preferences saved');
      onOpenChange(false);
    } catch (err) {
      logger.error('Failed to save notification preferences:', err);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Notification preferences</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="space-y-3">
              {OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  htmlFor={`prefs-${opt.value}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    mode === opt.value ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <RadioGroupItem id={`prefs-${opt.value}`} value={opt.value} className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor={`prefs-${opt.value}`} className="text-sm font-medium cursor-pointer">
                      {opt.label}
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">{opt.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || saving}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
