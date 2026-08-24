/**
 * Editing, previewing and saving a legal-document draft.
 *
 * Split out of `LegalDocumentsManager.tsx` (1,556 lines), which held the whole
 * workspace — helpers, badges, lists, the draft editor and the shell — in one
 * file. Each piece was already a self-contained function with its own props;
 * this only changes which file it lives in.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Textarea } from '../../../../ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../../ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  AlertTriangle,
  BookOpenText,
  ChevronDown,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Printer,
  RotateCcw,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { RichTextEditor } from '../../publications';
import { resourcesApi } from '../api';
import { LEGAL_SECTION_LABELS } from '../legal-constants';
import { LegalDocumentPdfDialog } from '../../../../shared/LegalDocumentPdf';
import {
  LEGAL_DOCUMENT_CONTENT_CLASS,
  LEGAL_DOCUMENT_CONTENT_STYLE,
  normalizeClipboardLegalHtml,
  sanitizeLegalDocumentHtml,
} from '../../../../../utils/legalHtml';
import type { LegalDocumentDetailResponse } from '../types';
import { resourceKeys } from '../hooks/queryKeys';
import { syncLegalDocumentCache } from './legalDocumentCache';
import {
  buildDraftSeed,
  escapeHtml,
  getDraftGovernance,
  getHtmlStats,
} from './legalDocumentHelpers';

export function DraftEditor({ detail }: { detail: LegalDocumentDetailResponse }) {
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
  const sanitizedPreview = useMemo(
    () => sanitizeLegalDocumentHtml(sourceHtml || '<p></p>'),
    [sourceHtml],
  );
  const hasDraft = Boolean(detail.currentDraftVersion);
  const liveVersionLabel = detail.currentPublishedVersion?.versionNumber
    ? `v${detail.currentPublishedVersion.versionNumber}`
    : 'legacy version';
  const isDirty =
    versionNumber !== initialDraft.versionNumber ||
    effectiveDate !== initialDraft.effectiveDate ||
    changeSummary !== initialDraft.changeSummary ||
    sourceHtml !== initialDraft.sourceHtml ||
    pageSize !== initialDraft.pdfConfig.pageSize ||
    orientation !== initialDraft.pdfConfig.orientation;

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
        queryClient.invalidateQueries({
          queryKey: resourceKeys.legalDocuments(),
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: resourceKeys.legalDocument(detail.definition.slug),
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: resourceKeys.legalDocumentVersions(detail.definition.slug),
          refetchType: 'none',
        }),
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
        queryClient.invalidateQueries({
          queryKey: resourceKeys.legalDocuments(),
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: resourceKeys.legalDocument(detail.definition.slug),
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: resourceKeys.legalDocumentVersions(detail.definition.slug),
          refetchType: 'none',
        }),
      ]);
      toast.success('Legal document published', {
        description:
          'The live legal page now uses this versioned document instead of the legacy source.',
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to publish legal document';
      toast.error('Could not publish legal document', { description: message });
    },
  });

  const pdfDocument = useMemo(
    () => ({
      title: detail.definition.title,
      description: detail.definition.description || '',
      version:
        versionNumber ||
        detail.currentDraftVersion?.versionNumber ||
        detail.currentPublishedVersion?.versionNumber ||
        '1.0',
      effectiveDate: effectiveDate || null,
      updatedAt:
        detail.currentDraftVersion?.updatedAt ||
        detail.currentPublishedVersion?.updatedAt ||
        new Date().toISOString(),
      sectionLabel: LEGAL_SECTION_LABELS[detail.definition.section],
      html: sourceHtml || '<p></p>',
      toc: detail.currentDraftVersion?.toc || detail.currentPublishedVersion?.toc || [],
      pdfConfig: {
        pageSize,
        orientation,
      },
    }),
    [
      detail.currentDraftVersion?.toc,
      detail.currentDraftVersion?.updatedAt,
      detail.currentDraftVersion?.versionNumber,
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
    ],
  );

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
        text = text || (await navigator.clipboard.readText());
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
      <style dangerouslySetInnerHTML={{ __html: LEGAL_DOCUMENT_CONTENT_STYLE }} />
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-900">
              <BookOpenText className="h-5 w-5 text-emerald-700" />
              <h3 className="font-semibold">Legal document draft</h3>
            </div>
            <p className="mt-2 text-sm text-emerald-900/80">
              Edit the document, save the draft, then publish when you want this version to replace
              the live legal page.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-emerald-900/80">
              <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">
                Live now:{' '}
                {detail.definition.renderMode === 'legacy_resource'
                  ? 'Legacy document'
                  : `Versioned ${liveVersionLabel}`}
              </Badge>
              <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">
                After publish: this draft becomes the live document
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void handlePasteFromClipboard()}>
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
              disabled={
                publishMutation.isPending ||
                saveMutation.isPending ||
                isDirty ||
                !draftVersionId ||
                governance.blockers.length > 0
              }
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
                      <ChevronDown
                        className={`ml-2 h-4 w-4 transition-transform ${showSetup ? 'rotate-180' : ''}`}
                      />
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
                Start with `Paste document` for the cleanest carry-over from Word or Google Docs. If
                formatting is sensitive, switch to `HTML/source` and publish from there without
                over-editing in the visual editor.
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
                    <Select
                      value={pageSize}
                      onValueChange={(value) => setPageSize(value as 'A4' | 'A3')}
                    >
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
                    <Select
                      value={orientation}
                      onValueChange={(value) => setOrientation(value as 'portrait' | 'landscape')}
                    >
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

          <Tabs
            value={editorTab}
            onValueChange={(value) => setEditorTab(value as 'editor' | 'source')}
            className="space-y-4"
          >
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
                  <CardDescription>
                    Use this for cleanup, headings, lists, links, and tables after import.
                  </CardDescription>
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handlePasteFromClipboard()}
                    >
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
                  {governance.blockers.length === 0
                    ? 'Ready once the draft is saved'
                    : 'Fix these before publishing'}
                </span>
              </div>
              <div>
                Draft:{' '}
                <span className="font-medium text-gray-900">
                  {hasDraft ? `v${detail.currentDraftVersion?.versionNumber}` : 'Not saved yet'}
                </span>
              </div>
              <div>
                Live:{' '}
                <span className="font-medium text-gray-900">
                  {detail.definition.renderMode === 'legacy_resource'
                    ? 'Legacy document'
                    : liveVersionLabel}
                </span>
              </div>
              <div>
                Target:{' '}
                <span className="font-medium text-gray-900">/legal/{detail.definition.slug}</span>
              </div>
              <div>
                Words: <span className="font-medium text-gray-900">{htmlStats.wordCount}</span>
              </div>
              <div>
                Section:{' '}
                <span className="font-medium text-gray-900">
                  {LEGAL_SECTION_LABELS[detail.definition.section]}
                </span>
              </div>
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
              className={LEGAL_DOCUMENT_CONTENT_CLASS}
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
