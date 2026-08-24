/**
 * Settings dialog of the Linktree tab: page title, bio, theme, and social
 * profile URLs. Pure view over props from LinktreeTab.
 */
/**
 * Linktree Tab — Admin management UI for link-in-bio page
 *
 * CRUD for company links that render on a public /links page.
 * Persisted via KV store linktree:links / linktree:settings.
 *
 * Features:
 *   - Full CRUD for links with reordering
 *   - Quick Add templates for common Navigate Wealth links
 *   - Social profile management (icon row on public page)
 *   - Settings (title, bio, theme)
 *   - Click analytics per link
 *
 * @module social-media/LinktreeTab
 */

import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Link as Loader2, X } from 'lucide-react';
import { BRAND } from '../constants';
import { SOCIAL_PLATFORMS, type LinktreeSettings } from './linktreeModel';

interface LinktreeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sTitle: string;
  setSTitle: (value: string) => void;
  sBio: string;
  setSBio: (value: string) => void;
  sTheme: LinktreeSettings['theme'];
  setSTheme: (value: LinktreeSettings['theme']) => void;
  sSocialProfiles: Record<string, string>;
  setSSocialProfiles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: boolean;
  onSave: () => void;
}

export function LinktreeSettingsDialog({
  open,
  onOpenChange,
  sTitle,
  setSTitle,
  sBio,
  setSBio,
  sTheme,
  setSTheme,
  sSocialProfiles,
  setSSocialProfiles,
  saving,
  onSave,
}: LinktreeSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Page Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* General */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              General
            </h3>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Page Title</Label>
              <Input value={sTitle} onChange={(e) => setSTitle(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Bio / Tagline</Label>
              <Textarea
                value={sBio}
                onChange={(e) => setSBio(e.target.value)}
                rows={2}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Theme</Label>
              <Select
                value={sTheme}
                onValueChange={(v) => setSTheme(v as LinktreeSettings['theme'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="navy">Navy (Brand Default)</SelectItem>
                  <SelectItem value="gold">Gold Accent</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Social Profiles */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Social Profiles
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Displayed as icon buttons below your bio on the public page
              </p>
            </div>
            {SOCIAL_PLATFORMS.map((platform) => (
              <div key={platform.key} className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: BRAND.navyLight }}
                >
                  <span style={{ color: BRAND.navy }}>{platform.icon}</span>
                </div>
                <Input
                  placeholder={platform.placeholder}
                  value={sSocialProfiles[platform.key] || ''}
                  onChange={(e) =>
                    setSSocialProfiles((prev) => ({
                      ...prev,
                      [platform.key]: e.target.value,
                    }))
                  }
                  className="flex-1 text-sm"
                />
                {sSocialProfiles[platform.key] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                    onClick={() =>
                      setSSocialProfiles((prev) => {
                        const next = { ...prev };
                        delete next[platform.key];
                        return next;
                      })
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="text-white"
            style={{ backgroundColor: BRAND.navy }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
