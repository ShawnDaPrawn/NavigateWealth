import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { ScrollArea } from '../../../../ui/scroll-area';
import { Separator } from '../../../../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Skeleton } from '../../../../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Textarea } from '../../../../ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../../ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import {
  AlertTriangle,
  Archive,
  BookOpenText,
  ChevronDown,
  CheckCircle2,
  Copy,
  Eye,
  FileClock,
  FileStack,
  FileText,
  History,
  Printer,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { RichTextEditor } from '../../publications/RichTextEditor';
import { resourcesApi } from '../api';
import { LEGAL_SECTION_LABELS } from '../legal-constants';
import { LegalDocumentPdfDialog } from '../../../../shared/LegalDocumentPdf';
import { LEGAL_MIGRATION_PRIORITY_SLUGS } from '../../../../../shared/legal-documents-registry';
import { normalizeClipboardLegalHtml, sanitizeLegalDocumentHtml } from '../../../../../utils/legalHtml';
import type {
  LegalDocumentDefinitionResponse,
  LegalDocumentDetailResponse,
  LegalDocumentMigrationBatchResponse,
  LegalDocumentAuditEntry,
  LegalDocumentVersionResponse,
} from '../types';
import { resourceKeys } from '../hooks/queryKeys';

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function incrementVersion(versionNumber?: string | null): string {
  if (!versionNumber) return '1.0';
  const match = versionNumber.match(/^(\d+)\.(\d+)$/);
  if (!match) return versionNumber;
  return `${match[1]}.${Number(match[2]) + 1}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLegacyHtml(version: LegalDocumentVersionResponse | null | undefined, fallbackTitle: string): string {
  const blockHtml = (version?.blocks || [])
    .map((block) => {
      if (block.type === 'text') {
        const content = typeof block.data?.content === 'string' ? block.data.content : '';
        return content;
      }

      if (block.type === 'section_header') {
        const title = typeof block.data?.title === 'string' ? block.data.title : fallbackTitle;
        const number = typeof block.data?.number === 'string' && block.data.number.trim()
          ? `${block.data.number.trim()} `
          : '';
        return `<h2>${escapeHtml(`${number}${title}`.trim())}</h2>`;
      }

      return '';
    })
    .filter(Boolean)
    .join('');

  return blockHtml.trim() || `<h1>${escapeHtml(fallbackTitle)}</h1><p></p>`;
}

function buildDraftSeed(detail: LegalDocumentDetailResponse) {
  const currentDraft = detail.currentDraftVersion;
  const currentPublished = detail.currentPublishedVersion;

  return {
    versionNumber: currentDraft?.versionNumber || incrementVersion(currentPublished?.versionNumber || '1.0'),
    effectiveDate: toDateInputValue(currentDraft?.effectiveDate),
    changeSummary: currentDraft?.changeSummary || '',
    sourceHtml:
      currentDraft?.sourceHtml
      || currentPublished?.sourceHtml
      || buildLegacyHtml(currentPublished, detail.definition.title),
    pdfConfig: currentDraft?.pdfConfig || currentPublished?.pdfConfig || {
      pageSize: 'A4' as const,
      orientation: 'portrait' as const,
    },
  };
}

function getHtmlStats(sourceHtml: string) {
  if (typeof window === 'undefined') {
    return { wordCount: 0, headingCount: 0 };
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(sourceHtml || '<p></p>', 'text/html');
  const text = doc.body.textContent?.replace(/\s+/g, ' ').trim() || '';

  return {
    wordCount: text ? text.split(/\s+/).length : 0,
    headingCount: doc.querySelectorAll('h1, h2, h3').length,
  };
}

function getDraftGovernance(sourceHtml: string, effectiveDate: string, changeSummary: string, pageSize: 'A4' | 'A3', orientation: 'portrait' | 'landscape') {
  if (typeof window === 'undefined') {
    return { blockers: [] as string[], warnings: [] as string[], tables: 0, longParagraphs: 0, manualBreaks: 0 };
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(sourceHtml || '<p></p>', 'text/html');
  const headings = doc.querySelectorAll('h1, h2, h3').length;
  const tables = doc.querySelectorAll('table').length;
  const manualBreaks = doc.querySelectorAll('.legal-page-break').length;
  const longParagraphs = Array.from(doc.querySelectorAll('p'))
    .filter((paragraph) => (paragraph.textContent || '').replace(/\s+/g, ' ').trim().length > 900)
    .length;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!effectiveDate) {
    blockers.push('Set an effective date before publishing.');
  }

  if (!changeSummary.trim() || changeSummary.trim().length < 12) {
    blockers.push('Add a meaningful change summary before publishing.');
  }

  if (headings === 0) {
    warnings.push('No headings detected. The document can still publish, but the web TOC and PDF structure will be weaker.');
  }

  if (tables > 0) {
    warnings.push(`${tables} table${tables === 1 ? '' : 's'} detected. Check the PDF preview for clean breaks and repeated headers.`);
  }

  if (longParagraphs > 0) {
    warnings.push(`${longParagraphs} very long paragraph${longParagraphs === 1 ? '' : 's'} detected. Splitting clauses can improve readability and page breaks.`);
  }

  if (manualBreaks === 0 && (doc.body.textContent || '').trim().split(/\s+/).length > 2200) {
    warnings.push('This is a long document with no manual page breaks. Review the PDF preview closely before publishing.');
  }

  if (pageSize === 'A3') {
    warnings.push('A3 is unusual for legal documents. Use it only when the layout genuinely needs the extra width.');
  }

  if (orientation === 'landscape') {
    warnings.push('Landscape layout is harder to read for most legal documents. Confirm it is intentional.');
  }

  return { blockers, warnings, tables, longParagraphs, manualBreaks };
}

function StatusBadge({ value }: { value: string }) {
  const palette = value === 'published'
    ? 'bg-green-50 text-green-700 border-green-200'
    : value === 'draft'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <Badge variant="outline" className={palette}>
      {value}
    </Badge>
  );
}

function RenderModeBadge({ value }: { value: string }) {
  const palette = value === 'legacy_resource'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-violet-50 text-violet-700 border-violet-200';
  return (
    <Badge variant="outline" className={palette}>
      {value === 'legacy_resource' ? 'Legacy-backed' : 'Versioned'}
    </Badge>
  );
}

function getMigrationState(detail: LegalDocumentDetailResponse) {
  if (detail.definition.renderMode === 'versioned_document') {
    return 'migrated';
  }

  if (detail.currentDraftVersion?.contentFormat === 'normalized_rich_text') {
    return 'draft-ready';
  }

  return 'legacy-only';
}

function syncLegalDocumentCache(
  queryClient: ReturnType<typeof useQueryClient>,
  detail: LegalDocumentDetailResponse,
) {
  queryClient.setQueryData(resourceKeys.legalDocument(detail.definition.slug), detail);
  queryClient.setQueryData(resourceKeys.legalDocumentVersions(detail.definition.slug), detail.versions);
  queryClient.setQueryData<LegalDocumentDefinitionResponse[] | undefined>(
    resourceKeys.legalDocuments(),
    (existing) => {
      if (!existing) return [detail.definition];
      const next = existing.map((item) => (
        item.slug === detail.definition.slug ? detail.definition : item
      ));
      return next.some((item) => item.slug === detail.definition.slug)
        ? next
        : [...next, detail.definition];
    },
  );
}

function MigrationBadge({ state }: { state: 'legacy-only' | 'draft-ready' | 'migrated' }) {
  const palette = state === 'migrated'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : state === 'draft-ready'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  const label = state === 'migrated'
    ? 'Migrated'
    : state === 'draft-ready'
      ? 'Draft Ready'
      : 'Legacy Only';

  return (
    <Badge variant="outline" className={palette}>
      {label}
    </Badge>
  );
}

function VersionList({
  definition,
  versions,
  onPublish,
  onArchive,
  onDuplicate,
  actionVersionId,
}: {
  definition: LegalDocumentDefinitionResponse;
  versions: LegalDocumentVersionResponse[];
  onPublish: (versionId: string) => void;
  onArchive: (versionId: string) => void;
  onDuplicate: (versionId: string) => void;
  actionVersionId: string | null;
}) {
  if (versions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-muted-foreground">
        No versions yet. Saving your first legal draft will start the new version history here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((version) => (
        <div key={version.id} className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">v{version.versionNumber}</span>
                <StatusBadge value={version.status} />
                <Badge variant="outline">{version.contentFormat === 'legacy_blocks' ? 'Legacy snapshot' : 'Normalized'}</Badge>
                {definition.currentPublishedVersionId === version.id && (
                  <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Live</Badge>
                )}
                {definition.currentDraftVersionId === version.id && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Active draft</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Created {formatDate(version.createdAt)}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Published: {formatDate(version.publishedAt)}</div>
              <div>Effective: {formatDate(version.effectiveDate)}</div>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <div>Created by: {version.createdBy || 'Unknown'}</div>
            <div>Published by: {version.publishedBy || 'Not published'}</div>
            <div className="md:col-span-2">
              Change summary: {version.changeSummary || 'No summary recorded yet.'}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {definition.currentDraftVersionId === version.id ? (
              <Button
                type="button"
                size="sm"
                onClick={() => onPublish(version.id)}
                disabled={actionVersionId === version.id}
              >
                {actionVersionId === version.id ? 'Publishing…' : 'Publish Draft'}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onDuplicate(version.id)}
                disabled={actionVersionId === version.id}
              >
                <Copy className="mr-2 h-4 w-4" />
                {actionVersionId === version.id ? 'Creating draft…' : 'Create Draft Copy'}
              </Button>
            )}

            {definition.currentPublishedVersionId !== version.id && definition.currentDraftVersionId !== version.id && version.status !== 'archived' && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onArchive(version.id)}
                disabled={actionVersionId === version.id}
              >
                <Archive className="mr-2 h-4 w-4" />
                {actionVersionId === version.id ? 'Archiving…' : 'Archive'}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditList({ entries, isLoading }: { entries: LegalDocumentAuditEntry[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-muted-foreground">
        No legal-document audit entries yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const severityClass = entry.severity === 'critical'
          ? 'border-red-200 bg-red-50 text-red-700'
          : entry.severity === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-slate-200 bg-slate-50 text-slate-700';

        return (
          <div key={entry.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={severityClass}>{entry.severity}</Badge>
                <Badge variant="outline">{entry.action}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{formatDate(entry.timestamp)}</div>
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900">{entry.summary}</p>
            <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              <div>Actor role: <span className="font-medium text-gray-900">{entry.actorRole}</span></div>
              <div>Entity: <span className="font-medium text-gray-900">{entry.entityId || 'n/a'}</span></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DraftEditor({ detail }: { detail: LegalDocumentDetailResponse }) {
  const queryClient = useQueryClient();
  const initialDraft = useMemo(() => buildDraftSeed(detail), [detail]);
  const [versionNumber, setVersionNumber] = useState(initialDraft.versionNumber);
  const [effectiveDate, setEffectiveDate] = useState(initialDraft.effectiveDate);
  const [changeSummary, setChangeSummary] = useState(initialDraft.changeSummary);
  const [sourceHtml, setSourceHtml] = useState(initialDraft.sourceHtml);
  const [pageSize, setPageSize] = useState(initialDraft.pdfConfig.pageSize);
  const [orientation, setOrientation] = useState(initialDraft.pdfConfig.orientation);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [webPreviewOpen, setWebPreviewOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<'editor' | 'source'>('editor');
  const [showSetup, setShowSetup] = useState(false);
  const [draftVersionId, setDraftVersionId] = useState(detail.currentDraftVersion?.id || null);

  useEffect(() => {
    setVersionNumber(initialDraft.versionNumber);
    setEffectiveDate(initialDraft.effectiveDate);
    setChangeSummary(initialDraft.changeSummary);
    setSourceHtml(initialDraft.sourceHtml);
    setPageSize(initialDraft.pdfConfig.pageSize);
    setOrientation(initialDraft.pdfConfig.orientation);
    setDraftVersionId(detail.currentDraftVersion?.id || null);
  }, [detail.currentDraftVersion?.id, initialDraft]);

  const htmlStats = useMemo(() => getHtmlStats(sourceHtml), [sourceHtml]);
  const governance = useMemo(
    () => getDraftGovernance(sourceHtml, effectiveDate, changeSummary, pageSize, orientation),
    [changeSummary, effectiveDate, orientation, pageSize, sourceHtml],
  );
  const sanitizedPreview = useMemo(() => sanitizeLegalDocumentHtml(sourceHtml || '<p></p>'), [sourceHtml]);
  const hasDraft = Boolean(detail.currentDraftVersion);
  const liveVersionLabel = detail.currentPublishedVersion?.versionNumber
    ? `v${detail.currentPublishedVersion.versionNumber}`
    : 'legacy version';
  const isDirty = (
    versionNumber !== initialDraft.versionNumber
    || effectiveDate !== initialDraft.effectiveDate
    || changeSummary !== initialDraft.changeSummary
    || sourceHtml !== initialDraft.sourceHtml
    || pageSize !== initialDraft.pdfConfig.pageSize
    || orientation !== initialDraft.pdfConfig.orientation
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        versionNumber,
        effectiveDate: effectiveDate || null,
        changeSummary: changeSummary || null,
        sourceHtml,
        pdfConfig: {
          pageSize,
          orientation,
        },
      };

      if (draftVersionId) {
        return resourcesApi.updateLegalDocumentDraft(
          detail.definition.slug,
          draftVersionId,
          payload,
        );
      }

      return resourcesApi.createLegalDocumentDraft(detail.definition.slug, payload);
    },
    onSuccess: async (result) => {
      syncLegalDocumentCache(queryClient, result);
      setDraftVersionId(result.currentDraftVersion?.id || null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocuments(), refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocument(detail.definition.slug), refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocumentVersions(detail.definition.slug), refetchType: 'none' }),
      ]);
      toast.success(hasDraft ? 'Legal draft updated' : 'Legal draft created');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to save legal draft';
      toast.error('Could not save legal draft', { description: message });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const targetDraftVersionId = draftVersionId || detail.currentDraftVersion?.id || null;
      if (!targetDraftVersionId) {
        throw new Error('Save the draft before publishing it');
      }

      return resourcesApi.publishLegalDocumentDraft(detail.definition.slug, targetDraftVersionId);
    },
    onSuccess: async (result) => {
      syncLegalDocumentCache(queryClient, result);
      setDraftVersionId(result.currentDraftVersion?.id || null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocuments(), refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocument(detail.definition.slug), refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocumentVersions(detail.definition.slug), refetchType: 'none' }),
      ]);
      toast.success('Legal document published', {
        description: 'The live legal page now uses this versioned document instead of the legacy source.',
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to publish legal document';
      toast.error('Could not publish legal document', { description: message });
    },
  });

  const pdfDocument = useMemo(() => ({
    title: detail.definition.title,
    description: detail.definition.description || '',
    version: versionNumber || detail.currentDraftVersion?.versionNumber || detail.currentPublishedVersion?.versionNumber || '1.0',
    effectiveDate: effectiveDate || null,
    updatedAt: detail.currentDraftVersion?.updatedAt || detail.currentPublishedVersion?.updatedAt || new Date().toISOString(),
    sectionLabel: LEGAL_SECTION_LABELS[detail.definition.section],
    html: sourceHtml || '<p></p>',
    toc: detail.currentDraftVersion?.toc || detail.currentPublishedVersion?.toc || [],
    pdfConfig: {
      pageSize,
      orientation,
    },
  }), [
    detail.currentDraftVersion?.toc,
    detail.currentDraftVersion?.updatedAt,
    detail.currentPublishedVersion?.toc,
    detail.currentPublishedVersion?.updatedAt,
    detail.currentPublishedVersion?.versionNumber,
    detail.definition.description,
    detail.definition.section,
    detail.definition.title,
    effectiveDate,
    orientation,
    pageSize,
    sourceHtml,
    versionNumber,
  ]);

  const handlePasteFromClipboard = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard) {
      toast.error('Clipboard access is not available in this browser.');
      return;
    }

    try {
      let html = '';
      let text = '';

      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/html')) {
            html = await (await item.getType('text/html')).text();
            break;
          }

          if (!text && item.types.includes('text/plain')) {
            text = await (await item.getType('text/plain')).text();
          }
        }
      }

      if (!html) {
        text = text || await navigator.clipboard.readText();
      }

      const fallbackHtml = text
        ? text
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean)
            .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
            .join('')
        : '<p></p>';

      setSourceHtml(normalizeClipboardLegalHtml(html, fallbackHtml));
      setEditorTab('source');
      toast.success('Clipboard content imported', {
        description: 'Review the source first, then open the previews only if you need them.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Clipboard import failed';
      toast.error('Could not import clipboard content', { description: message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-900">
              <BookOpenText className="h-5 w-5 text-emerald-700" />
              <h3 className="font-semibold">Legal document draft</h3>
            </div>
            <p className="mt-2 text-sm text-emerald-900/80">
              Edit the document, save the draft, then publish when you want this version to replace the live legal page.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-emerald-900/80">
              <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">
                Live now: {detail.definition.renderMode === 'legacy_resource' ? 'Legacy document' : `Versioned ${liveVersionLabel}`}
              </Badge>
              <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">
                After publish: this draft becomes the live document
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handlePasteFromClipboard()}
            >
              <Copy className="mr-2 h-4 w-4" />
              Paste document
            </Button>
            <Button type="button" variant="outline" onClick={() => setWebPreviewOpen(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Web preview
            </Button>
            <Button type="button" variant="outline" onClick={() => setPdfPreviewOpen(true)}>
              <Printer className="mr-2 h-4 w-4" />
              PDF preview
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setVersionNumber(initialDraft.versionNumber);
                setEffectiveDate(initialDraft.effectiveDate);
                setChangeSummary(initialDraft.changeSummary);
                setSourceHtml(initialDraft.sourceHtml);
                setPageSize(initialDraft.pdfConfig.pageSize);
                setOrientation(initialDraft.pdfConfig.orientation);
              }}
              disabled={saveMutation.isPending || !isDirty}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              type="button"
              onClick={() => void saveMutation.mutateAsync()}
              disabled={saveMutation.isPending || !sourceHtml.trim() || !versionNumber.trim()}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? 'Saving…' : 'Save draft'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void publishMutation.mutateAsync()}
              disabled={publishMutation.isPending || saveMutation.isPending || isDirty || !draftVersionId || governance.blockers.length > 0}
            >
              <FileText className="mr-2 h-4 w-4" />
              {publishMutation.isPending ? 'Publishing…' : 'Publish live'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base">Document setup</CardTitle>
                  <CardDescription>Keep only the essentials open while you edit.</CardDescription>
                </div>
                <Collapsible open={showSetup} onOpenChange={setShowSetup}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm">
                      {showSetup ? 'Hide PDF settings' : 'Show PDF settings'}
                      <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showSetup ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="legal-version-number">Version number</Label>
                <Input
                  id="legal-version-number"
                  value={versionNumber}
                  onChange={(event) => setVersionNumber(event.target.value)}
                  placeholder="1.1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal-effective-date">Effective date</Label>
                <Input
                  id="legal-effective-date"
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:col-span-2">
                Start with `Paste document` for the cleanest carry-over from Word or Google Docs. If formatting is sensitive, switch to `HTML/source` and publish from there without over-editing in the visual editor.
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="legal-change-summary">Change summary</Label>
                <Textarea
                  id="legal-change-summary"
                  value={changeSummary}
                  onChange={(event) => setChangeSummary(event.target.value)}
                  placeholder="Summarise what changed in this version."
                  rows={3}
                />
              </div>
              <Collapsible open={showSetup} onOpenChange={setShowSetup} className="md:col-span-2">
                <CollapsibleContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>PDF page size</Label>
                    <Select value={pageSize} onValueChange={(value) => setPageSize(value as 'A4' | 'A3')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select page size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A4">A4</SelectItem>
                        <SelectItem value="A3">A3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>PDF orientation</Label>
                    <Select value={orientation} onValueChange={(value) => setOrientation(value as 'portrait' | 'landscape')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select orientation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Portrait</SelectItem>
                        <SelectItem value="landscape">Landscape</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          <Tabs value={editorTab} onValueChange={(value) => setEditorTab(value as 'editor' | 'source')} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="editor" className="gap-2">
                <BookOpenText className="h-4 w-4" />
                Visual editor
              </TabsTrigger>
              <TabsTrigger value="source" className="gap-2">
                <FileText className="h-4 w-4" />
                HTML/source
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Editor</CardTitle>
                  <CardDescription>Use this for cleanup, headings, lists, links, and tables after import.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <RichTextEditor
                    value={sourceHtml}
                    onChange={setSourceHtml}
                    placeholder="Paste your legal document here, then refine the formatting."
                    minHeight="min-h-[520px]"
                    preset="legal"
                    enableAI={false}
                    enableSlashMenu={false}
                    articleTitle={detail.definition.title}
                    articleExcerpt={detail.definition.description}
                    articleCategory="Legal"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="source">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">HTML/source</CardTitle>
                      <CardDescription>
                        Best when pasted legal formatting is sensitive and you want maximum control.
                      </CardDescription>
                    </div>
                    <Button type="button" variant="outline" onClick={() => void handlePasteFromClipboard()}>
                      <Copy className="mr-2 h-4 w-4" />
                      Paste again
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={sourceHtml}
                    onChange={(event) => setSourceHtml(event.target.value)}
                    className="min-h-[520px] font-mono text-xs leading-6"
                    placeholder="<h1>Terms of Use</h1>..."
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                {governance.blockers.length === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <span className="font-medium text-gray-900">
                  {governance.blockers.length === 0 ? 'Ready once the draft is saved' : 'Fix these before publishing'}
                </span>
              </div>
              <div>Draft: <span className="font-medium text-gray-900">{hasDraft ? `v${detail.currentDraftVersion?.versionNumber}` : 'Not saved yet'}</span></div>
              <div>Live: <span className="font-medium text-gray-900">{detail.definition.renderMode === 'legacy_resource' ? 'Legacy document' : liveVersionLabel}</span></div>
              <div>Target: <span className="font-medium text-gray-900">/legal/{detail.definition.slug}</span></div>
              <div>Words: <span className="font-medium text-gray-900">{htmlStats.wordCount}</span></div>
              <div>Section: <span className="font-medium text-gray-900">{LEGAL_SECTION_LABELS[detail.definition.section]}</span></div>
              {governance.blockers.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <div className="mb-2 font-medium">Blockers</div>
                  <div className="space-y-1">
                    {governance.blockers.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                </div>
              )}
              {governance.warnings.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">
                  <div className="mb-2 font-medium text-slate-900">Warnings</div>
                  <div className="space-y-1">
                    {governance.warnings.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={webPreviewOpen} onOpenChange={setWebPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Web preview</DialogTitle>
            <DialogDescription>
              This is how the current draft will read on the legal page once published.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-auto rounded-xl border border-gray-200 bg-white p-8">
            <article
              className="prose prose-gray max-w-none prose-headings:tracking-tight prose-p:leading-7 prose-li:leading-7"
              dangerouslySetInnerHTML={{ __html: sanitizedPreview }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <LegalDocumentPdfDialog
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        document={pdfDocument}
      />
    </div>
  );
}

function DetailShell({ detail }: { detail: LegalDocumentDetailResponse }) {
  const { definition, currentPublishedVersion, versions } = detail;
  const queryClient = useQueryClient();
  const [actionVersionId, setActionVersionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'draft' | 'published' | 'history'>('draft');
  const migrationState = getMigrationState(detail);
  const auditQuery = useQuery({
    queryKey: [...resourceKeys.legalDocument(definition.slug), 'audit'],
    queryFn: () => resourcesApi.getLegalDocumentAudit(definition.slug),
    staleTime: 60 * 1000,
    enabled: activeTab === 'history',
  });

  const invalidateLegalQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocuments() }),
      queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocument(definition.slug) }),
      queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocumentVersions(definition.slug) }),
      queryClient.invalidateQueries({ queryKey: [...resourceKeys.legalDocument(definition.slug), 'audit'] }),
    ]);
  };

  const publishMutation = useMutation({
    mutationFn: async (versionId: string) => {
      setActionVersionId(versionId);
      return resourcesApi.publishLegalDocumentDraft(definition.slug, versionId);
    },
    onSuccess: async (result) => {
      syncLegalDocumentCache(queryClient, result);
      await invalidateLegalQueries();
      toast.success('Legal document published');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to publish legal document';
      toast.error('Could not publish legal document', { description: message });
    },
    onSettled: () => {
      setActionVersionId(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (versionId: string) => {
      setActionVersionId(versionId);
      return resourcesApi.archiveLegalDocumentVersion(definition.slug, versionId);
    },
    onSuccess: async (result) => {
      syncLegalDocumentCache(queryClient, result);
      await invalidateLegalQueries();
      toast.success('Legal document version archived');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to archive legal document version';
      toast.error('Could not archive legal document version', { description: message });
    },
    onSettled: () => {
      setActionVersionId(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (versionId: string) => {
      setActionVersionId(versionId);
      return resourcesApi.duplicateLegalDocumentVersion(definition.slug, versionId);
    },
    onSuccess: async (result) => {
      syncLegalDocumentCache(queryClient, result);
      await invalidateLegalQueries();
      toast.success('Draft created from selected version');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create draft from version';
      toast.error('Could not create draft copy', { description: message });
    },
    onSettled: () => {
      setActionVersionId(null);
    },
  });

  const migrateMutation = useMutation({
    mutationFn: async () => {
      setActionVersionId('migrate');
      return resourcesApi.migrateLegalDocument(definition.slug);
    },
    onSuccess: async (result) => {
      syncLegalDocumentCache(queryClient, result);
      await invalidateLegalQueries();
      toast.success('Migration draft prepared from the legacy legal document');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create migration draft';
      toast.error('Could not prepare migration draft', { description: message });
    },
    onSettled: () => {
      setActionVersionId(null);
    },
  });

  return (
    <Card className="min-h-[640px]">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-2xl">{definition.title}</CardTitle>
            <CardDescription>{definition.description}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={definition.status} />
            <RenderModeBadge value={definition.renderMode} />
            <MigrationBadge state={migrationState} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'draft' | 'published' | 'history')} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draft" className="gap-2">
              <FileClock className="h-4 w-4" />
              Draft
            </TabsTrigger>
            <TabsTrigger value="published" className="gap-2">
              <FileText className="h-4 w-4" />
              Live
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draft">
            <DraftEditor detail={detail} />
          </TabsContent>

          <TabsContent value="published" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Live website source</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div>Live renderer: <span className="font-medium text-gray-900">{definition.renderMode === 'legacy_resource' ? 'Legacy legal resource' : 'Versioned legal document'}</span></div>
                  <div>Live version: <span className="font-medium text-gray-900">{currentPublishedVersion ? `v${currentPublishedVersion.versionNumber}` : 'Legacy resource only'}</span></div>
                  <div>Legacy resource link: <span className="font-medium text-gray-900">{definition.legacyResourceId || 'Not linked'}</span></div>
                  <div>Updated: <span className="font-medium text-gray-900">{formatDate(definition.updatedAt)}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Migration readiness</CardTitle>
                    </div>
                    {definition.renderMode === 'legacy_resource' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void migrateMutation.mutateAsync()}
                        disabled={migrateMutation.isPending || migrationState === 'draft-ready'}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {migrateMutation.isPending ? 'Preparing draft…' : migrationState === 'draft-ready' ? 'Migration draft ready' : 'Create migration draft'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Migration creates a normalized draft from the existing legacy legal document without changing the live public slug.
                  </p>
                  <p>
                    Review the draft, adjust wording or formatting if needed, then publish when you are happy to switch this legal document to the versioned renderer.
                  </p>
                  <div>State: <span className="font-medium text-gray-900">{migrationState === 'migrated' ? 'Already versioned' : migrationState === 'draft-ready' ? 'Migration draft ready for review' : 'Still using legacy resource'}</span></div>
                </CardContent>
              </Card>
            </div>

            {currentPublishedVersion ? (
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">v{currentPublishedVersion.versionNumber}</span>
                      <StatusBadge value={currentPublishedVersion.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Published {formatDate(currentPublishedVersion.publishedAt)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {currentPublishedVersion.contentFormat === 'legacy_blocks' ? 'Legacy snapshot' : 'Normalized content'}
                  </Badge>
                </div>
                <Separator className="my-3" />
                <p className="text-sm text-muted-foreground">
                  {currentPublishedVersion.changeSummary || 'No change summary recorded yet.'}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-muted-foreground">
                No published version is stored in the new legal-document layer yet.
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <VersionList
              definition={definition}
              versions={versions}
              onPublish={(versionId) => void publishMutation.mutateAsync(versionId)}
              onArchive={(versionId) => void archiveMutation.mutateAsync(versionId)}
              onDuplicate={(versionId) => void duplicateMutation.mutateAsync(versionId)}
              actionVersionId={actionVersionId}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Audit trail</CardTitle>
                <CardDescription>
                  Recent create, update, migration, publish, archive, and rollback actions for this legal document.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AuditList entries={auditQuery.data || []} isLoading={auditQuery.isLoading} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function LegalDocumentsManager() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: resourceKeys.legalDocuments(),
    queryFn: () => resourcesApi.getLegalDocuments(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!selectedSlug && listQuery.data && listQuery.data.length > 0) {
      setSelectedSlug(listQuery.data[0].slug);
    }
  }, [selectedSlug, listQuery.data]);

  const detailQuery = useQuery({
    queryKey: selectedSlug ? resourceKeys.legalDocument(selectedSlug) : resourceKeys.legalDocument('unselected'),
    queryFn: () => resourcesApi.getLegalDocument(selectedSlug!),
    enabled: Boolean(selectedSlug),
    staleTime: 5 * 60 * 1000,
  });

  const groupedDocuments = useMemo(() => {
    const docs = listQuery.data || [];
    return docs.reduce<Record<string, LegalDocumentDefinitionResponse[]>>((acc, doc) => {
      const key = doc.section;
      acc[key] = acc[key] || [];
      acc[key].push(doc);
      return acc;
    }, {});
  }, [listQuery.data]);

  const migrationSummary = useMemo(() => {
    const docs = listQuery.data || [];
    const total = docs.length;
    const migrated = docs.filter((doc) => doc.renderMode === 'versioned_document').length;
    const draftReady = docs.filter((doc) => doc.renderMode === 'legacy_resource' && doc.currentDraftVersionId).length;
    const legacyOnly = total - migrated - draftReady;
    const priorityTotal = docs.filter((doc) => LEGAL_MIGRATION_PRIORITY_SLUGS.includes(doc.slug)).length;
    const priorityOutstanding = docs.filter((doc) => LEGAL_MIGRATION_PRIORITY_SLUGS.includes(doc.slug) && doc.renderMode === 'legacy_resource' && !doc.currentDraftVersionId).length;

    return {
      total,
      migrated,
      draftReady,
      legacyOnly,
      priorityTotal,
      priorityOutstanding,
    };
  }, [listQuery.data]);

  const migratePriorityMutation = useMutation({
    mutationFn: async (): Promise<LegalDocumentMigrationBatchResponse> => resourcesApi.migratePriorityLegalDocuments(),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocuments() }),
        selectedSlug
          ? queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocument(selectedSlug) })
          : Promise.resolve(),
      ]);

      if (result.failed.length > 0) {
        toast.error('Priority migration finished with some failures', {
          description: `${result.migrated.length} migrated, ${result.skipped.length} skipped, ${result.failed.length} failed.`,
        });
        return;
      }

      toast.success('Priority migration drafts prepared', {
        description: `${result.migrated.length} migrated, ${result.skipped.length} skipped.`,
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to prepare priority migration drafts';
      toast.error('Could not run priority migration', { description: message });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Legal Documents</CardTitle>
              <CardDescription>
                Migration workspace for moving legacy legal documents into the versioned legal-document system.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void migratePriorityMutation.mutateAsync()}
              disabled={migratePriorityMutation.isPending || migrationSummary.priorityOutstanding === 0}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {migratePriorityMutation.isPending ? 'Preparing…' : 'Priority Drafts'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-muted-foreground">
            <div>Versioned: <span className="font-medium text-gray-900">{migrationSummary.migrated}</span></div>
            <div>Draft ready: <span className="font-medium text-gray-900">{migrationSummary.draftReady}</span></div>
            <div>Legacy only: <span className="font-medium text-gray-900">{migrationSummary.legacyOnly}</span></div>
            <div>Priority remaining: <span className="font-medium text-gray-900">{migrationSummary.priorityOutstanding} / {migrationSummary.priorityTotal}</span></div>
          </div>
          {listQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[760px] pr-3">
              <div className="space-y-6">
                {Object.entries(groupedDocuments).map(([section, docs]) => (
                  <div key={section} className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {LEGAL_SECTION_LABELS[section as keyof typeof LEGAL_SECTION_LABELS]}
                    </div>
                    <div className="space-y-2">
                      {docs.map((doc) => {
                        const isActive = selectedSlug === doc.slug;
                        return (
                          <Button
                            key={doc.slug}
                            type="button"
                            variant={isActive ? 'default' : 'outline'}
                            className="h-auto w-full justify-start px-3 py-3 text-left"
                            onClick={() => setSelectedSlug(doc.slug)}
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">{doc.title}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <StatusBadge value={doc.status} />
                                <RenderModeBadge value={doc.renderMode} />
                                <MigrationBadge
                                  state={doc.renderMode === 'versioned_document'
                                    ? 'migrated'
                                    : doc.currentDraftVersionId
                                      ? 'draft-ready'
                                      : 'legacy-only'}
                                />
                              </div>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {detailQuery.isLoading ? (
        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </CardContent>
        </Card>
      ) : detailQuery.data ? (
        <DetailShell detail={detailQuery.data} />
      ) : (
        <Card className="min-h-[640px]">
          <CardContent className="flex h-full items-center justify-center py-16 text-center text-muted-foreground">
            <div>
              <FileStack className="mx-auto mb-4 h-10 w-10 opacity-50" />
              <p className="text-lg font-medium">Select a legal document</p>
              <p className="mt-2 text-sm">
                The draft workspace will open here with version metadata, rich editing, and live preview.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
