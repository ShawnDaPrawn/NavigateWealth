/**
 * Newsletter Studio — campaign composer.
 *
 * Content editing only; lifecycle actions (test/schedule/send/pause) live on
 * the campaign detail view. Drafts and scheduled campaigns are editable —
 * anything later is locked server-side.
 */
import React, { Suspense, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Checkbox } from '../../../../ui/checkbox';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Skeleton } from '../../../../ui/skeleton';
import { Switch } from '../../../../ui/switch';
import { MERGE_FIELDS } from '../constants';
import {
  useCreateCampaign,
  useStudioLists,
  useStudioTemplates,
  useUpdateCampaign,
} from '../hooks/useNewsletterStudio';
import type { CreateCampaignInput, NewsletterCampaign } from '../types';

/**
 * Cross-module dependency: newsletter → publications (public barrel surface).
 * The shared TipTap editor is owned by publications; importing it through the
 * barrel keeps the §3.1 boundary, and the lazy wrapper keeps `vendor-editor`
 * off this module's initial chunk.
 */
const RichTextEditor = React.lazy(() =>
  import('../../publications').then((m) => ({ default: m.RichTextEditor })),
);

interface CampaignEditorProps {
  campaign: NewsletterCampaign | null;
  onBack: () => void;
  onSaved: (campaign: NewsletterCampaign) => void;
}

export function CampaignEditor({ campaign, onBack, onSaved }: CampaignEditorProps) {
  const { data: lists = [], isLoading: listsLoading } = useStudioLists();
  const { data: templates = [] } = useStudioTemplates();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();

  const [name, setName] = useState(campaign?.name ?? '');
  const [subject, setSubject] = useState(campaign?.subject ?? '');
  const [preheader, setPreheader] = useState(campaign?.preheader ?? '');
  const [fromName, setFromName] = useState(campaign?.fromName ?? 'Navigate Wealth');
  const [listIds, setListIds] = useState<string[]>(
    campaign?.listIds ?? ['sys_newsletter_contacts'],
  );
  const [trackClicks, setTrackClicks] = useState(campaign?.trackClicks ?? true);
  const [bodyHtml, setBodyHtml] = useState(campaign?.bodyHtml ?? '');

  const saving = createCampaign.isPending || updateCampaign.isPending;

  const selectedMemberEstimate = useMemo(
    () =>
      lists
        .filter((list) => listIds.includes(list.id))
        .reduce((sum, list) => sum + list.memberCount, 0),
    [lists, listIds],
  );

  const canSave = name.trim() && subject.trim() && bodyHtml.trim() && listIds.length > 0;

  const toggleList = (id: string, checked: boolean) => {
    setListIds((current) => (checked ? [...current, id] : current.filter((x) => x !== id)));
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    if (template.subject && !subject.trim()) setSubject(template.subject);
    setBodyHtml(template.bodyHtml);
  };

  const handleSave = async () => {
    const input: CreateCampaignInput = {
      name: name.trim(),
      subject: subject.trim(),
      preheader: preheader.trim() || undefined,
      fromName: fromName.trim() || undefined,
      listIds,
      bodyHtml,
      trackClicks,
    };
    const saved = campaign
      ? await updateCampaign.mutateAsync({ id: campaign.id, patch: input })
      : await createCampaign.mutateAsync(input);
    onSaved(saved);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Back
        </Button>
        <Button onClick={handleSave} disabled={!canSave || saving}>
          {saving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="mr-1 h-4 w-4" aria-hidden />
          )}
          {campaign ? 'Save changes' : 'Create draft'}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nl-campaign-name">Campaign name</Label>
                <Input
                  id="nl-campaign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="September market wrap"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-campaign-from">From name</Label>
                <Input
                  id="nl-campaign-from"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Navigate Wealth"
                  maxLength={120}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-campaign-subject">Subject</Label>
              <Input
                id="nl-campaign-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Your September update from Navigate Wealth"
                maxLength={300}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-campaign-preheader">Preview text (preheader)</Label>
              <Input
                id="nl-campaign-preheader"
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                placeholder="The one-minute version of this month's insights"
                maxLength={300}
              />
            </div>

            {templates.length > 0 && !campaign ? (
              <div className="space-y-1.5">
                <Label>Start from a template</Label>
                <Select onValueChange={applyTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional — choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>Body</Label>
              <Suspense fallback={<Skeleton className="h-72 w-full" />}>
                <RichTextEditor
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  placeholder="Write your newsletter…"
                  minHeight="320px"
                  enableAI={false}
                  enableSlashMenu={false}
                />
              </Suspense>
              <p className="text-xs text-muted-foreground">
                Merge fields:{' '}
                {MERGE_FIELDS.map((field, i) => (
                  <span key={field.token}>
                    {i > 0 ? ' · ' : ''}
                    <code className="rounded bg-muted px-1 py-0.5">{field.token}</code>
                  </span>
                ))}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {listsLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : lists.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No audience lists found. Groups are managed in the Communication module.
                </p>
              ) : (
                lists.map((list) => (
                  <label key={list.id} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={listIds.includes(list.id)}
                      onCheckedChange={(checked) => toggleList(list.id, checked === true)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{list.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {list.memberCount} member{list.memberCount === 1 ? '' : 's'}
                        {list.type === 'system' ? ' · system list' : ''}
                      </span>
                    </span>
                  </label>
                ))
              )}
              <p className="border-t pt-2 text-xs text-muted-foreground">
                Estimated reach:{' '}
                <span className="font-medium text-foreground">{selectedMemberEstimate}</span>{' '}
                (before de-duplication and opt-out removal)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="nl-track-clicks" className="text-sm font-normal">
                  Track link clicks
                </Label>
                <Switch
                  id="nl-track-clicks"
                  checked={trackClicks}
                  onCheckedChange={setTrackClicks}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                No tracking pixel is used. Opens are recorded when a recipient clicks through, in
                line with the platform's engagement doctrine.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
