/**
 * AutomationSettingsDialog — the operator's levers, editable without a deploy.
 *
 * Everything a routine reads at run time lives in the database: counts,
 * channels, slots, the style guide, the compliance rules and the two
 * playbooks. Saving here changes the next run; the routines' trigger prompts
 * never need to change.
 */

import { useEffect, useState } from 'react';
import { Button } from '../../../../ui/button';
import { Checkbox } from '../../../../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Textarea } from '../../../../ui/textarea';
import type {
  SocialAutomationPlaybook,
  SocialAutomationSettings,
  SocialAutomationSettingsPatch,
  SocialChannel,
} from './assetsTypes';
import {
  CHANNEL_LABEL,
  CHANNEL_ORDER,
  formToPatch,
  settingsToForm,
  type SettingsFormState,
} from './assetsModel';

interface AutomationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: SocialAutomationSettings;
  playbooks: SocialAutomationPlaybook[];
  saving?: boolean;
  onSaveSettings: (patch: SocialAutomationSettingsPatch) => Promise<unknown>;
  onSavePlaybook: (
    id: SocialAutomationPlaybook['id'],
    patch: { title?: string; instructions?: string },
  ) => Promise<unknown>;
}

export function AutomationSettingsDialog({
  open,
  onOpenChange,
  settings,
  playbooks,
  saving,
  onSaveSettings,
  onSavePlaybook,
}: AutomationSettingsDialogProps) {
  const [form, setForm] = useState<SettingsFormState>(() => settingsToForm(settings));
  const [error, setError] = useState<string | null>(null);
  const [playbookDrafts, setPlaybookDrafts] = useState<
    Record<string, { title: string; instructions: string }>
  >({});

  useEffect(() => {
    if (open) {
      setForm(settingsToForm(settings));
      setError(null);
      const drafts: Record<string, { title: string; instructions: string }> = {};
      for (const pb of playbooks)
        drafts[pb.id] = { title: pb.title, instructions: pb.instructions };
      setPlaybookDrafts(drafts);
    }
  }, [open, settings, playbooks]);

  const update = <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleChannel = (channel: SocialChannel, checked: boolean) =>
    update(
      'channels',
      checked
        ? [...new Set([...form.channels, channel])]
        : form.channels.filter((c) => c !== channel),
    );

  const handleSave = async () => {
    const { patch, error: validation } = formToPatch(form);
    if (!patch) {
      setError(validation ?? 'Invalid settings');
      return;
    }
    setError(null);
    await onSaveSettings(patch);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Automation settings &amp; playbooks</DialogTitle>
          <DialogDescription>
            The routines read these at run time. Changes apply to the next run — no deploy, no
            change to the routine itself.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-2">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="slots">Posting slots</TabsTrigger>
            <TabsTrigger value="style">Style guide</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <Switch
                id="settings-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => update('enabled', Boolean(v))}
              />
              <Label htmlFor="settings-enabled">Automation enabled (kill switch)</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="assets-per-channel">Assets generated per channel</Label>
                <Input
                  id="assets-per-channel"
                  type="number"
                  min={1}
                  max={20}
                  value={form.assets_per_channel}
                  onChange={(e) => update('assets_per_channel', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="posts-per-week">Posts scheduled per channel per week</Label>
                <Input
                  id="posts-per-week"
                  type="number"
                  min={0}
                  max={7}
                  value={form.posts_per_channel_per_week}
                  onChange={(e) => update('posts_per_channel_per_week', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="posting-timezone">Posting timezone</Label>
                <Input
                  id="posting-timezone"
                  value={form.posting_timezone}
                  onChange={(e) => update('posting_timezone', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="site-origin">Site origin (for article links)</Label>
                <Input
                  id="site-origin"
                  value={form.site_origin}
                  onChange={(e) => update('site_origin', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Channels</Label>
              <div className="flex flex-wrap gap-4 mt-2">
                {CHANNEL_ORDER.map((channel) => (
                  <div key={channel} className="flex items-center gap-2">
                    <Checkbox
                      id={`channel-${channel}`}
                      checked={form.channels.includes(channel)}
                      onCheckedChange={(checked) => toggleChannel(channel, checked === true)}
                    />
                    <Label htmlFor={`channel-${channel}`}>{CHANNEL_LABEL[channel]}</Label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="slots" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              One slot per line as <code>dow HH:MM</code> in the posting timezone (e.g.{' '}
              <code>tue 07:30</code>). The scheduling routine picks from these and may deviate with
              a reason.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CHANNEL_ORDER.map((channel) => (
                <div key={channel}>
                  <Label htmlFor={`slots-${channel}`}>{CHANNEL_LABEL[channel]}</Label>
                  <Textarea
                    id={`slots-${channel}`}
                    className="mt-1 min-h-[140px] font-mono text-sm"
                    value={form.slots[channel]}
                    onChange={(e) => update('slots', { ...form.slots, [channel]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="style" className="mt-4">
            <Label htmlFor="style-guide">Style guide (read by both routines)</Label>
            <Textarea
              id="style-guide"
              className="mt-1 min-h-[360px] text-sm"
              value={form.style_guide}
              onChange={(e) => update('style_guide', e.target.value)}
            />
          </TabsContent>

          <TabsContent value="compliance" className="mt-4">
            <Label htmlFor="compliance-rules">
              Compliance rules (non-negotiable for the routines)
            </Label>
            <Textarea
              id="compliance-rules"
              className="mt-1 min-h-[360px] text-sm"
              value={form.compliance_rules}
              onChange={(e) => update('compliance_rules', e.target.value)}
            />
          </TabsContent>

          <TabsContent value="playbooks" className="space-y-6 mt-4">
            <p className="text-sm text-muted-foreground">
              The step-by-step instructions a routine (Claude or ChatGPT) reads from the database
              and follows. Model-agnostic: only SQL, the Buffer connection and web search.
            </p>
            {playbooks.map((pb) => {
              const draft = playbookDrafts[pb.id] ?? {
                title: pb.title,
                instructions: pb.instructions,
              };
              const dirty = draft.title !== pb.title || draft.instructions !== pb.instructions;
              return (
                <div key={pb.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      aria-label={`${pb.id} playbook title`}
                      value={draft.title}
                      onChange={(e) =>
                        setPlaybookDrafts((prev) => ({
                          ...prev,
                          [pb.id]: { ...draft, title: e.target.value },
                        }))
                      }
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      v{pb.version}
                    </span>
                  </div>
                  <Textarea
                    aria-label={`${pb.id} playbook instructions`}
                    className="min-h-[320px] font-mono text-xs"
                    value={draft.instructions}
                    onChange={(e) =>
                      setPlaybookDrafts((prev) => ({
                        ...prev,
                        [pb.id]: { ...draft, instructions: e.target.value },
                      }))
                    }
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!dirty || saving || !draft.instructions.trim()}
                      onClick={() => onSavePlaybook(pb.id, draft)}
                    >
                      Save {pb.id} playbook
                    </Button>
                  </div>
                </div>
              );
            })}
            {playbooks.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No playbooks found — run the social automation migration.
              </p>
            )}
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={saving || !settings}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
