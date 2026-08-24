/**
 * Envelope settings: title, message, expiry and signing mode.
 *
 *
 * Split out of `PrepareFormStudio.tsx` (1,529 lines), whose `return` held the
 * toolbar, recipient strip, bulk-action bar, canvas and five dialogs together.
 * Presentational — it owns no state.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../../../../ui/button';
import { Loader2, Settings as SettingsIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Textarea } from '../../../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import type { SettingsDraft } from './settingsDraft';

interface SettingsDialogProps {
  handleSaveSettings: () => void;
  savingSettings: boolean;
  setSettingsDraft: Dispatch<SetStateAction<SettingsDraft>>;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  settingsDraft: SettingsDraft;
  showSettings: boolean;
}

export function SettingsDialog({
  handleSaveSettings,
  savingSettings,
  setSettingsDraft,
  setShowSettings,
  settingsDraft,
  showSettings,
}: SettingsDialogProps) {
  return (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-purple-600" />
            Envelope settings
          </DialogTitle>
          <DialogDescription>
            Update the envelope title, message, signing order, and expiry. Changes apply immediately
            to this draft.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="env-title">Title</Label>
            <Input
              id="env-title"
              value={settingsDraft.title}
              onChange={(e) => setSettingsDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Investment Mandate – Jane Smith"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="env-message">Message to recipients</Label>
            <Textarea
              id="env-message"
              value={settingsDraft.message}
              onChange={(e) => setSettingsDraft((d) => ({ ...d, message: e.target.value }))}
              placeholder="Optional. Shown to every recipient in the email and signing screen."
              rows={3}
              maxLength={1000}
            />
            <p className="text-[11px] text-gray-400 text-right">
              {settingsDraft.message.length}/1000
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="env-expiry">Expires in (days)</Label>
              <Input
                id="env-expiry"
                type="number"
                min={1}
                max={365}
                value={settingsDraft.expiryDays}
                onChange={(e) =>
                  setSettingsDraft((d) => ({
                    ...d,
                    expiryDays: Math.max(1, Math.min(365, parseInt(e.target.value || '30', 10))),
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Signing order</Label>
              <Select
                value={settingsDraft.signingMode}
                onValueChange={(v) =>
                  setSettingsDraft((d) => ({ ...d, signingMode: v as 'sequential' | 'parallel' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="parallel">Parallel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowSettings(false)}
            disabled={savingSettings}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
