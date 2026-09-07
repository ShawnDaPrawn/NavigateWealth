/**
 * Newsletter Studio — campaign composer.
 *
 * Content editing only; lifecycle actions (test/schedule/send/pause) live on
 * the campaign detail view. Drafts and scheduled campaigns are editable —
 * anything later is locked server-side.
 *
 * UX contract: the author always sees what the inbox will show (envelope
 * strip + full preview), always knows whether the draft is saved, and cannot
 * lose work by navigating away.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCopy,
  Eye,
  FileText,
  Loader2,
  Save,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader } from '../../../../ui/card';
import { Checkbox } from '../../../../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
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
import { cn } from '../../../../ui/utils';
import {
  UnsavedChangesDialog,
  useOptionalUnsavedChangesRegistry,
  useUnsavedChangesGuard,
} from '../../../../shared/unsaved-changes';
import {
  DEFAULT_FROM_NAME,
  MERGE_FIELDS,
  STARTER_TEMPLATES,
  SUBSCRIBER_LIST_ID,
  type StarterTemplate,
} from '../constants';
import {
  useCreateCampaign,
  useStudioLists,
  useStudioTemplates,
  useUpdateCampaign,
} from '../hooks/useNewsletterStudio';
import type {
  CreateCampaignInput,
  NewsletterCampaign,
  NewsletterListView,
  NewsletterStudioTemplate,
} from '../types';
import { formatNumber, initials, pluralize, subjectLengthHint } from '../utils/format';
import { hasVisibleText } from '../utils/preview';
import type { EditorSeed } from './CampaignsTab';
import { EmailPreview } from './EmailPreview';
import { LazyRichTextEditor } from './LazyRichTextEditor';
import { CampaignStatusBadge } from './StatusBadge';
import { SectionHeader } from './shared';

interface CampaignForm {
  name: string;
  subject: string;
  preheader: string;
  fromName: string;
  listIds: string[];
  trackClicks: boolean;
  bodyHtml: string;
}

function initialForm(campaign: NewsletterCampaign | null, seed?: EditorSeed): CampaignForm {
  return {
    name: campaign?.name ?? '',
    subject: campaign?.subject ?? seed?.template?.subject ?? '',
    preheader: campaign?.preheader ?? '',
    fromName: campaign?.fromName ?? DEFAULT_FROM_NAME,
    listIds: campaign?.listIds ?? seed?.listIds ?? [SUBSCRIBER_LIST_ID],
    trackClicks: campaign?.trackClicks ?? true,
    bodyHtml: campaign?.bodyHtml ?? seed?.template?.bodyHtml ?? '',
  };
}

interface CampaignEditorProps {
  campaign: NewsletterCampaign | null;
  seed?: EditorSeed;
  onBack: () => void;
  onSaved: (campaign: NewsletterCampaign) => void;
}

export function CampaignEditor({ campaign, seed, onBack, onSaved }: CampaignEditorProps) {
  const { data: lists = [], isLoading: listsLoading } = useStudioLists();
  const { data: templates = [] } = useStudioTemplates();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();

  const [baseline, setBaseline] = useState<CampaignForm>(() => initialForm(campaign, seed));
  const [form, setForm] = useState<CampaignForm>(baseline);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<
    NewsletterStudioTemplate | StarterTemplate | null
  >(null);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );
  const saving = createCampaign.isPending || updateCampaign.isPending;

  const setField = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // ── Validation ──────────────────────────────────────────────────────────
  const checks = [
    { id: 'name', label: 'Internal name', ok: form.name.trim().length > 0 },
    { id: 'subject', label: 'Subject line', ok: form.subject.trim().length > 0 },
    { id: 'audience', label: 'At least one audience', ok: form.listIds.length > 0 },
    { id: 'body', label: 'Email content', ok: hasVisibleText(form.bodyHtml) },
  ];
  const canSave = checks.every((check) => check.ok);
  const missing = checks.filter((check) => !check.ok).map((check) => check.label.toLowerCase());

  // ── Persist ─────────────────────────────────────────────────────────────
  const persist = useCallback(async (): Promise<NewsletterCampaign | null> => {
    if (!canSave) {
      toast.error(`Still needed: ${missing.join(', ')}`);
      return null;
    }
    const input: CreateCampaignInput = {
      name: form.name.trim(),
      subject: form.subject.trim(),
      preheader: form.preheader.trim() || undefined,
      fromName: form.fromName.trim() || undefined,
      listIds: form.listIds,
      bodyHtml: form.bodyHtml,
      trackClicks: form.trackClicks,
    };
    try {
      const saved = campaign
        ? await updateCampaign.mutateAsync({ id: campaign.id, patch: input })
        : await createCampaign.mutateAsync(input);
      // Commit the clean baseline synchronously so navigation triggered right
      // after this returns is not blocked by a stale "dirty" flag.
      flushSync(() => setBaseline(form));
      return saved;
    } catch {
      // The mutation hooks already toast the error.
      return null;
    }
  }, [campaign, canSave, createCampaign, form, missing, updateCampaign]);

  const handleSave = async () => {
    const saved = await persist();
    if (saved) onSaved(saved);
  };

  // ── Leave protection ────────────────────────────────────────────────────
  const guard = useUnsavedChangesGuard({
    isDirty,
    onSave: async () => Boolean(await persist()),
    onDiscard: () => {
      flushSync(() => setForm(baseline));
    },
    message: 'This campaign has unsaved changes. Save them before leaving?',
  });
  const registry = useOptionalUnsavedChangesRegistry();
  const { tryAction } = guard;
  useEffect(() => {
    if (!registry) return;
    registry.register({ id: 'newsletter-campaign-editor', isDirty, tryAction });
    return () => registry.unregister('newsletter-campaign-editor');
  }, [registry, isDirty, tryAction]);

  // ── Templates ───────────────────────────────────────────────────────────
  const applyTemplate = (template: NewsletterStudioTemplate | StarterTemplate) => {
    setForm((current) => ({
      ...current,
      subject: current.subject.trim() ? current.subject : template.subject,
      bodyHtml: template.bodyHtml,
    }));
    toast.success(`Applied “${template.name}”`);
  };
  const requestTemplate = (template: NewsletterStudioTemplate | StarterTemplate) => {
    if (hasVisibleText(form.bodyHtml)) setPendingTemplate(template);
    else applyTemplate(template);
  };

  // ── Audience ────────────────────────────────────────────────────────────
  const [listFilter, setListFilter] = useState('');
  const visibleLists = useMemo(() => {
    const needle = listFilter.trim().toLowerCase();
    if (!needle) return lists;
    return lists.filter((list) => list.name.toLowerCase().includes(needle));
  }, [lists, listFilter]);
  const estimatedReach = useMemo(
    () =>
      lists
        .filter((list) => form.listIds.includes(list.id))
        .reduce((sum, list) => sum + list.memberCount, 0),
    [lists, form.listIds],
  );
  const toggleList = (id: string, checked: boolean) =>
    setField(
      'listIds',
      checked ? [...new Set([...form.listIds, id])] : form.listIds.filter((x) => x !== id),
    );

  const subjectHint = subjectLengthHint(form.subject);
  const title = campaign ? campaign.name : 'New campaign';

  return (
    <div className="space-y-5">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/95 px-3 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => tryAction(onBack)}
            aria-label={campaign ? 'Back to campaign' : 'Back to campaigns'}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold">{title}</h2>
              {campaign ? <CampaignStatusBadge status={campaign.status} /> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {isDirty ? (
                <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden /> Unsaved
                  changes
                </span>
              ) : campaign ? (
                'All changes saved'
              ) : (
                'Not saved yet'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" aria-hidden /> Preview
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || (!isDirty && Boolean(campaign))}
            title={!canSave ? `Still needed: ${missing.join(', ')}` : undefined}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {campaign ? 'Save changes' : 'Save draft'}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: the email */}
        <div className="space-y-5">
          <Card className="gap-0">
            <CardHeader className="pb-4">
              <SectionHeader
                title="Envelope"
                description="What recipients see before they open the email"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="nl-campaign-subject">Subject</Label>
                    <span
                      className={cn(
                        'text-[11px] tabular-nums',
                        subjectHint.tone === 'warn'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      {form.subject.trim().length}/300 · {subjectHint.hint}
                    </span>
                  </div>
                  <Input
                    id="nl-campaign-subject"
                    value={form.subject}
                    onChange={(e) => setField('subject', e.target.value)}
                    placeholder="Your September update from Navigate Wealth"
                    maxLength={300}
                    aria-invalid={subjectHint.tone === 'empty' ? true : undefined}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nl-campaign-from">From name</Label>
                  <Input
                    id="nl-campaign-from"
                    value={form.fromName}
                    onChange={(e) => setField('fromName', e.target.value)}
                    placeholder={DEFAULT_FROM_NAME}
                    maxLength={120}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="nl-campaign-preheader">Preview text</Label>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {form.preheader.trim().length}/300 · shown after the subject in most inboxes
                  </span>
                </div>
                <Input
                  id="nl-campaign-preheader"
                  value={form.preheader}
                  onChange={(e) => setField('preheader', e.target.value)}
                  placeholder="The one-minute version of this month's insights"
                  maxLength={300}
                />
              </div>

              <InboxRow
                fromName={form.fromName || DEFAULT_FROM_NAME}
                subject={form.subject}
                preheader={form.preheader}
              />
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardHeader className="pb-4">
              <SectionHeader
                title="Content"
                description="Merge fields are personalised per recipient at send time"
                action={
                  <TemplatePicker
                    templates={templates}
                    onPick={requestTemplate}
                    onStarter={requestTemplate}
                  />
                }
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasVisibleText(form.bodyHtml) ? <StarterStrip onPick={requestTemplate} /> : null}
              <LazyRichTextEditor
                value={form.bodyHtml}
                onChange={(value) => setField('bodyHtml', value)}
                placeholder="Write your newsletter…"
                minHeight="360px"
                enableAI={false}
                enableSlashMenu={false}
              />
              <MergeFieldChips />
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-5">
          <Card className="gap-0">
            <CardHeader className="pb-3">
              <SectionHeader
                icon={Users}
                title="Audience"
                description="Who receives this campaign"
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {listsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : lists.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No audience lists found yet. Subscribers appear here automatically; other groups
                  are managed in the Communication module.
                </p>
              ) : (
                <>
                  {lists.length > 6 ? (
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        value={listFilter}
                        onChange={(e) => setListFilter(e.target.value)}
                        placeholder="Filter lists…"
                        aria-label="Filter audience lists"
                        className="h-8 pl-8 text-sm"
                      />
                    </div>
                  ) : null}
                  <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    {visibleLists.map((list) => (
                      <AudienceOption
                        key={list.id}
                        list={list}
                        checked={form.listIds.includes(list.id)}
                        onChange={(checked) => toggleList(list.id, checked)}
                      />
                    ))}
                    {visibleLists.length === 0 ? (
                      <li className="px-1 py-2 text-xs text-muted-foreground">
                        No lists match “{listFilter}”.
                      </li>
                    ) : null}
                  </ul>
                </>
              )}
              <div className="rounded-xl bg-purple-50 px-4 py-3 dark:bg-purple-950/30">
                <p className="text-xs font-medium uppercase tracking-wide text-purple-700 dark:text-purple-300">
                  Estimated reach
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-purple-900 dark:text-purple-100">
                  {formatNumber(estimatedReach)}
                </p>
                <p className="text-xs text-purple-800/80 dark:text-purple-200/80">
                  {pluralize(form.listIds.length, 'list')} selected · duplicates and opt-outs are
                  removed at send time
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardHeader className="pb-3">
              <SectionHeader title="Settings" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nl-campaign-name">Internal name</Label>
                <Input
                  id="nl-campaign-name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="September market wrap"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">Only your team sees this.</p>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                <div>
                  <Label htmlFor="nl-track-clicks" className="text-sm font-medium">
                    Track link clicks
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    No tracking pixel — a click counts as an open.
                  </p>
                </div>
                <Switch
                  id="nl-track-clicks"
                  checked={form.trackClicks}
                  onCheckedChange={(checked) => setField('trackClicks', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardHeader className="pb-3">
              <SectionHeader
                title={canSave ? 'Ready to save' : 'Before you can save'}
                description={
                  canSave
                    ? 'Send a test from the campaign page once saved.'
                    : 'Complete the items below.'
                }
              />
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {checks.map((check) => (
                  <li key={check.id} className="flex items-center gap-2 text-sm">
                    {check.ok ? (
                      <CheckCircle2
                        className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/50" aria-hidden />
                    )}
                    <span className={cn(!check.ok && 'text-muted-foreground')}>{check.label}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                onClick={handleSave}
                disabled={saving || (!isDirty && Boolean(campaign))}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" aria-hidden />
                )}
                {campaign ? 'Save changes' : 'Save draft'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>
              Merge fields are shown with sample values. Branding and the unsubscribe footer are
              added when the email is sent.
            </DialogDescription>
          </DialogHeader>
          <EmailPreview
            allowDeviceToggle
            bodyHtml={form.bodyHtml}
            subject={form.subject}
            preheader={form.preheader}
            fromName={form.fromName}
          />
        </DialogContent>
      </Dialog>

      {/* Replace-content confirmation */}
      <AlertDialog
        open={Boolean(pendingTemplate)}
        onOpenChange={(open) => !open && setPendingTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the current content?</AlertDialogTitle>
            <AlertDialogDescription>
              Applying “{pendingTemplate?.name}” replaces what you have written in the body. The
              subject is kept if you have already set one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my content</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTemplate) applyTemplate(pendingTemplate);
                setPendingTemplate(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesDialog {...guard.dialogProps} />
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

/** A Gmail-style inbox row so the author sees the envelope as recipients will. */
function InboxRow({
  fromName,
  subject,
  preheader,
}: {
  fromName: string;
  subject: string;
  preheader: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Inbox preview
      </p>
      <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-semibold text-white">
          {initials(fromName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-semibold">{fromName}</p>
            <p className="shrink-0 text-[11px] text-muted-foreground">09:41</p>
          </div>
          <p className="truncate text-sm">
            <span className={cn('font-medium', !subject.trim() && 'text-muted-foreground')}>
              {subject.trim() || 'Subject line'}
            </span>
            <span className="text-muted-foreground">
              {' — '}
              {preheader.trim() || 'Preview text appears here'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function TemplatePicker({
  templates,
  onPick,
  onStarter,
}: {
  templates: NewsletterStudioTemplate[];
  onPick: (template: NewsletterStudioTemplate) => void;
  onStarter: (template: StarterTemplate) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const saved = templates.find((t) => t.id === next);
        if (saved) onPick(saved);
        const starter = STARTER_TEMPLATES.find((t) => t.id === next);
        if (starter) onStarter(starter);
        // Reset so the same template can be chosen again later.
        setValue('');
      }}
    >
      <SelectTrigger className="h-8 w-52 text-xs" aria-label="Insert a template">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <SelectValue placeholder="Insert template…" />
      </SelectTrigger>
      <SelectContent>
        {templates.length > 0 ? (
          <>
            <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Your templates
            </p>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </>
        ) : null}
        <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Starter layouts
        </p>
        {STARTER_TEMPLATES.map((template) => (
          <SelectItem key={template.id} value={template.id}>
            {template.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StarterStrip({ onPick }: { onPick: (template: StarterTemplate) => void }) {
  return (
    <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800/50 dark:bg-purple-950/20">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-purple-800 dark:text-purple-200">
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> Start from a layout, or write from scratch
        below
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onPick(template)}
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-left transition-colors hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
          >
            <span className="block text-sm font-medium">{template.name}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {template.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MergeFieldChips() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(token);
      toast.success(`Copied ${token} — paste it into your content`);
      setTimeout(() => setCopied((current) => (current === token ? null : current)), 1500);
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="mr-1 text-muted-foreground">Merge fields:</span>
      {MERGE_FIELDS.map((field) => (
        <button
          key={field.token}
          type="button"
          onClick={() => copy(field.token)}
          title={`${field.description} — click to copy`}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 font-mono text-[11px] transition-colors hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
        >
          {copied === field.token ? (
            <Check className="h-3 w-3 text-emerald-600" aria-hidden />
          ) : (
            <ClipboardCopy className="h-3 w-3 text-muted-foreground" aria-hidden />
          )}
          {field.token}
        </button>
      ))}
    </div>
  );
}

function AudienceOption({
  list,
  checked,
  onChange,
}: {
  list: NewsletterListView;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const isSubscribers = list.id === SUBSCRIBER_LIST_ID;
  const inputId = `nl-list-${list.id}`;
  return (
    <li>
      <label
        htmlFor={inputId}
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors',
          checked
            ? 'border-purple-300 bg-purple-50/60 dark:border-purple-700 dark:bg-purple-950/30'
            : 'border-transparent hover:bg-muted/60',
        )}
      >
        <Checkbox
          id={inputId}
          checked={checked}
          onCheckedChange={(value) => onChange(value === true)}
          className="mt-0.5"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{list.name}</span>
            {isSubscribers ? (
              <span className="rounded-full bg-purple-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Subscribers
              </span>
            ) : list.type === 'system' ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Auto
              </span>
            ) : null}
          </span>
          <span className="block text-xs text-muted-foreground">
            {pluralize(list.memberCount, 'member')}
            {list.clientCount > 0 && list.externalContactCount > 0
              ? ` · ${list.clientCount} clients, ${list.externalContactCount} contacts`
              : ''}
          </span>
        </span>
      </label>
    </li>
  );
}
