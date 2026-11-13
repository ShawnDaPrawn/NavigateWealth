/**
 * Automation settings & playbooks — the operator's levers, editable without a
 * deploy, on a page of their own (design system: long forms are pages).
 *
 * Everything a routine reads at run time lives in the database: counts,
 * channels, slots, the style guide, the compliance rules and the two
 * playbooks. Saving here changes the next run; the routines' trigger prompts
 * never need to change. The five sections are a segmented control kept in the
 * address (?section=).
 */

import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Checkbox } from '../../../../ui/checkbox';
import { Input } from '../../../../ui/input';
import { NumberInputField } from '../../../../ui/number-input';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import { Tabs, TabsContent } from '../../../../ui/tabs';
import { Textarea } from '../../../../ui/textarea';
import { Skeleton } from '../../../../ui/skeleton';
import {
  ErrorState,
  PageHeader,
  SegmentedList,
  SegmentedTrigger,
  useUrlState,
} from '../../../layout/page';
import {
  useSocialAutomationSettings,
  useSocialPlaybooks,
  useUpdateSocialPlaybook,
  useUpdateSocialSettings,
} from '../hooks/useSocialAssets';
import type { SocialChannel } from './assetsTypes';
import {
  CHANNEL_LABEL,
  CHANNEL_ORDER,
  formToPatch,
  settingsToForm,
  type SettingsFormState,
} from './assetsModel';

const SECTIONS = ['general', 'slots', 'style', 'compliance', 'playbooks'] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABEL: Record<Section, string> = {
  general: 'General',
  slots: 'Posting slots',
  style: 'Style guide',
  compliance: 'Compliance',
  playbooks: 'Playbooks',
};

export function AutomationSettingsPage({ onBack }: { onBack: () => void }) {
  const settingsQuery = useSocialAutomationSettings();
  const playbooksQuery = useSocialPlaybooks(true);
  const updateSettings = useUpdateSocialSettings();
  const updatePlaybook = useUpdateSocialPlaybook();
  const settings = settingsQuery.data;
  const playbooks = playbooksQuery.data ?? [];
  const saving = updateSettings.isPending || updatePlaybook.isPending;

  const [section, setSection] = useUrlState<Section>('section', 'general', SECTIONS);
  const [form, setForm] = useState<SettingsFormState>(() => settingsToForm(settings));
  const [error, setError] = useState<string | null>(null);
  const [playbookDrafts, setPlaybookDrafts] = useState<
    Record<string, { title: string; instructions: string }>
  >({});

  useEffect(() => {
    setForm(settingsToForm(settings));
    setError(null);
  }, [settings]);

  useEffect(() => {
    const drafts: Record<string, { title: string; instructions: string }> = {};
    for (const pb of playbooksQuery.data ?? [])
      drafts[pb.id] = { title: pb.title, instructions: pb.instructions };
    setPlaybookDrafts(drafts);
  }, [playbooksQuery.data]);

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
    await updateSettings.mutateAsync(patch).catch(() => undefined);
  };

  const onSavePlaybook = (id: string, patch: { title?: string; instructions?: string }) =>
    updatePlaybook
      .mutateAsync({ id: id as (typeof playbooks)[number]['id'], patch })
      .catch(() => undefined);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Weekly pipeline
      </button>
      <PageHeader
        title="Automation settings & playbooks"
        description="The routines read these at run time. Changes apply to the next run."
        actions={
          section === 'playbooks' ? undefined : (
            <Button onClick={() => void handleSave()} disabled={saving || !settings}>
              {updateSettings.isPending ? 'Saving…' : 'Save'}
            </Button>
          )
        }
      />

      {settingsQuery.isLoading ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : settingsQuery.error ? (
        <ErrorState
          title="Could not load the automation settings"
          description={
            settingsQuery.error instanceof Error ? settingsQuery.error.message : undefined
          }
          onRetry={() => void settingsQuery.refetch()}
        />
      ) : (
        <Tabs value={section} onValueChange={(v) => setSection(v as Section)} className="gap-4">
          <SegmentedList aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <SegmentedTrigger key={s} value={s}>
                {SECTION_LABEL[s]}
              </SegmentedTrigger>
            ))}
          </SegmentedList>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="rounded-xl border border-nw-line bg-white p-5">
            <TabsContent value="general" className="space-y-4 mt-0">
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
                  <NumberInputField
                    id="assets-per-channel"
                    value={form.assets_per_channel}
                    onChange={(e) => update('assets_per_channel', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="posts-per-week">Posts scheduled per channel per week</Label>
                  <NumberInputField
                    id="posts-per-week"
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
            <TabsContent value="slots" className="space-y-4 mt-0">
              <p className="text-sm text-muted-foreground">
                One slot per line as <code>dow HH:MM</code> in the posting timezone (e.g.{' '}
                <code>tue 07:30</code>). The scheduling routine picks from these and may deviate
                with a reason.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {CHANNEL_ORDER.map((channel) => (
                  <div key={channel}>
                    <Label htmlFor={`slots-${channel}`}>{CHANNEL_LABEL[channel]}</Label>
                    <Textarea
                      id={`slots-${channel}`}
                      className="mt-1 min-h-[140px] font-mono text-sm"
                      value={form.slots[channel]}
                      onChange={(e) =>
                        update('slots', { ...form.slots, [channel]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="style" className="mt-0">
              <Label htmlFor="style-guide">Style guide (read by both routines)</Label>
              <Textarea
                id="style-guide"
                className="mt-1 min-h-[360px] text-sm"
                value={form.style_guide}
                onChange={(e) => update('style_guide', e.target.value)}
              />
            </TabsContent>
            <TabsContent value="compliance" className="mt-0">
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
            <TabsContent value="playbooks" className="space-y-6 mt-0">
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
                        onClick={() => void onSavePlaybook(pb.id, draft)}
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
          </div>
        </Tabs>
      )}
    </div>
  );
}
