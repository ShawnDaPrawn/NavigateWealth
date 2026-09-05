/**
 * Newsletter Studio — reusable campaign templates.
 * Templates seed new campaigns (subject + body with merge fields).
 */
import React, { useState } from 'react';
import {
  Code2,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
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
import { Card, CardContent } from '../../../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Skeleton } from '../../../../ui/skeleton';
import { Textarea } from '../../../../ui/textarea';
import { cn } from '../../../../ui/utils';
import { MERGE_FIELDS, STARTER_TEMPLATES, type StarterTemplate } from '../constants';
import {
  useDeleteTemplate,
  useSaveTemplate,
  useStudioTemplates,
} from '../hooks/useNewsletterStudio';
import type { NewsletterCaps, NewsletterStudioTemplate } from '../types';
import { formatRelative } from '../utils/format';
import { EmailPreview } from './EmailPreview';
import { LazyRichTextEditor } from './LazyRichTextEditor';
import { EmptyState, ErrorState, SectionHeader } from './shared';

interface TemplatesTabProps {
  caps: NewsletterCaps;
  onUseTemplate: (template: NewsletterStudioTemplate) => void;
}

interface TemplateDraft {
  id?: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
}

export function TemplatesTab({ caps, onUseTemplate }: TemplatesTabProps) {
  const {
    data: templates = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useStudioTemplates();
  const saveTemplate = useSaveTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NewsletterStudioTemplate | null>(null);

  const openEditor = (template: NewsletterStudioTemplate | StarterTemplate | null) => {
    setDraft({
      id: template && 'createdAt' in template ? template.id : undefined,
      name: template?.name ?? '',
      description: template?.description ?? '',
      subject: template?.subject ?? '',
      bodyHtml: template?.bodyHtml ?? '',
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    await saveTemplate.mutateAsync({
      id: draft.id,
      input: {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        subject: draft.subject.trim() || undefined,
        bodyHtml: draft.bodyHtml,
      },
    });
    setDraft(null);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Templates"
        description={
          <>
            Reusable starting points for campaigns. Merge fields such as{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{'{{firstName}}'}</code> are
            personalised per recipient at send time.
          </>
        }
        action={
          caps.create ? (
            <Button onClick={() => openEditor(null)}>
              <Plus className="h-4 w-4" aria-hidden /> New template
            </Button>
          ) : null
        }
      />

      {isError && templates.length === 0 ? (
        <ErrorState
          title="Templates could not be loaded"
          description={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-2xl" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className="gap-0">
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="Save a layout once and every future issue starts from it. Pick a starter below or build your own."
            action={
              caps.create ? (
                <Button onClick={() => openEditor(null)}>
                  <Plus className="h-4 w-4" aria-hidden /> Build a template
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              caps={caps}
              onUse={() => onUseTemplate(template)}
              onEdit={() => openEditor(template)}
              onDelete={() => setPendingDelete(template)}
            />
          ))}
        </div>
      )}

      {caps.create ? (
        <div>
          <SectionHeader
            icon={Sparkles}
            title="Starter layouts"
            description="Save one as your own template and adapt it"
            className="mb-3"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {STARTER_TEMPLATES.map((starter) => (
              <button
                key={starter.id}
                type="button"
                onClick={() => openEditor(starter)}
                className="rounded-2xl border border-dashed border-border bg-background p-4 text-left transition-colors hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
              >
                <span className="block text-sm font-medium">{starter.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {starter.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Editor */}
      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit template' : 'New template'}</DialogTitle>
            <DialogDescription>
              Campaigns started from this template can still be edited freely.
            </DialogDescription>
          </DialogHeader>
          {draft ? <TemplateForm draft={draft} onChange={setDraft} /> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saveTemplate.isPending ||
                !draft?.name.trim() ||
                !draft?.bodyHtml.replace(/<[^>]*>/g, '').trim()
              }
            >
              {saveTemplate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Campaigns already created from it are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (pendingDelete) deleteTemplate.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplateCard({
  template,
  caps,
  onUse,
  onEdit,
  onDelete,
}: {
  template: NewsletterStudioTemplate;
  caps: NewsletterCaps;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="group gap-0 overflow-hidden">
      <div className="relative h-44 overflow-hidden border-b border-border/60 bg-[#f4f4f7]">
        <div className="pointer-events-none origin-top-left scale-[0.62] transform-gpu p-3 [width:161%]">
          <EmailPreview bodyOnly bodyHtml={template.bodyHtml} subject={template.subject} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#f4f4f7] to-transparent" />
      </div>
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold">{template.name}</h3>
            {caps.create || caps.delete ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mr-2 -mt-1 h-7 w-7"
                    aria-label={`Actions for ${template.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {caps.create ? (
                    <DropdownMenuItem onSelect={onEdit}>
                      <Pencil className="h-4 w-4" aria-hidden /> Edit
                    </DropdownMenuItem>
                  ) : null}
                  {caps.delete ? (
                    <>
                      {caps.create ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                        <Trash2 className="h-4 w-4" aria-hidden /> Delete
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {template.description ||
              (template.subject ? `Subject: ${template.subject}` : 'No description')}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            Updated {formatRelative(template.updatedAt)}
          </span>
          {caps.create ? (
            <Button size="sm" onClick={onUse}>
              <Plus className="h-4 w-4" aria-hidden /> Use template
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateForm({
  draft,
  onChange,
}: {
  draft: TemplateDraft;
  onChange: (draft: TemplateDraft) => void;
}) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const set = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) =>
    onChange({ ...draft, [key]: value });
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nl-template-name">Name</Label>
            <Input
              id="nl-template-name"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={200}
              placeholder="Monthly market update"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nl-template-subject">Default subject</Label>
            <Input
              id="nl-template-subject"
              value={draft.subject}
              onChange={(e) => set('subject', e.target.value)}
              maxLength={300}
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nl-template-description">Description</Label>
          <Input
            id="nl-template-description"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={500}
            placeholder="When to use this template"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="nl-template-body">Body</Label>
            <div className="inline-flex rounded-md border border-border/60 p-0.5">
              <ModeButton active={mode === 'visual'} onClick={() => setMode('visual')}>
                <Pencil className="h-3 w-3" aria-hidden /> Visual
              </ModeButton>
              <ModeButton active={mode === 'html'} onClick={() => setMode('html')}>
                <Code2 className="h-3 w-3" aria-hidden /> HTML
              </ModeButton>
            </div>
          </div>
          {mode === 'visual' ? (
            <LazyRichTextEditor
              fallbackHeight="h-64"
              value={draft.bodyHtml}
              onChange={(value) => set('bodyHtml', value)}
              placeholder="Write the template body…"
              minHeight="260px"
              enableAI={false}
              enableSlashMenu={false}
            />
          ) : (
            <Textarea
              id="nl-template-body"
              value={draft.bodyHtml}
              onChange={(e) => set('bodyHtml', e.target.value)}
              rows={14}
              className="font-mono text-xs"
              placeholder={'<h2>Hi {{firstName}},</h2>\n<p>…</p>'}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Merge fields: {MERGE_FIELDS.map((f) => f.token).join(' · ')}
          </p>
        </div>
      </div>
      <div className="hidden lg:block">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Live preview
        </p>
        <EmailPreview bodyHtml={draft.bodyHtml} subject={draft.subject} />
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-colors',
        active ? 'bg-purple-600 text-white' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
