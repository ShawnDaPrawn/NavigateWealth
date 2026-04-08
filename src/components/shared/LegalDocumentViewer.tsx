import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Download,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { LEGAL_DOCUMENTS_BY_SLUG, LEGAL_SECTION_LABELS } from '../../shared/legal-documents-registry';
import { LegalDocumentPdfDialog } from './LegalDocumentPdf';
import {
  LEGAL_DOCUMENT_CONTENT_CLASS,
  LEGAL_DOCUMENT_CONTENT_STYLE,
  normalizeLegalDocumentAnchors,
  sanitizeLegalDocumentHtml,
} from '../../utils/legalHtml';

interface FormBlock {
  type: string;
  id?: string;
  data?: {
    number?: string;
    title?: string;
    content?: string;
    columns?: number;
    fields?: Array<{ label?: string; key?: string }>;
    signatories?: Array<{ label?: string; key?: string }>;
    hasColumnHeaders?: boolean;
    columnHeaders?: string[];
    hasRowHeaders?: boolean;
    rowHeaders?: string[];
    rows?: Array<{ id?: string; cells?: Array<{ value?: string }> }>;
    showDate?: boolean;
  };
}

interface LegalDocumentResponse {
  available: boolean;
  slug: string;
  document?: {
    slug?: string;
    id: string;
    title: string;
    description?: string;
    blocks: FormBlock[];
    version: string;
    updatedAt: string;
    effectiveDate?: string | null;
    section?: string | null;
    toc?: Array<{ id: string; title: string; level: number }>;
    contentHtml?: string | null;
    renderMode?: 'legacy_resource' | 'versioned_document';
    pdfConfig?: {
      pageSize: 'A4' | 'A3';
      orientation: 'portrait' | 'landscape';
    };
  };
}

type LegalDocument = LegalDocumentResponse['document'];

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

function formatLongDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function blocksToHtml(blocks: FormBlock[]): string {
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'section_header': {
        const title = block.data?.title || `Section ${index + 1}`;
        const heading = `${block.data?.number ? `${block.data.number} ` : ''}${title}`.trim();
        const id = heading
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          || `section-${index + 1}`;

        return `<h2 id="${escapeHtml(id)}">${escapeHtml(heading)}</h2>`;
      }

      case 'text':
        return block.data?.content || '';

      case 'table': {
        const hasRowHeaders = Boolean(block.data?.hasRowHeaders);
        const headerCells = (block.data?.columnHeaders || [])
          .map((header) => `<th>${escapeHtml(header)}</th>`)
          .join('');
        const headerRow = block.data?.hasColumnHeaders
          ? `<thead><tr>${hasRowHeaders ? '<th></th>' : ''}${headerCells}</tr></thead>`
          : '';

        const bodyRows = (block.data?.rows || []).map((row, rowIndex) => {
          const rowHeader = hasRowHeaders
            ? `<th>${escapeHtml((block.data?.rowHeaders || [])[rowIndex] || '')}</th>`
            : '';
          const cells = (row.cells || [])
            .map((cell) => `<td>${escapeHtml(cell.value || '')}</td>`)
            .join('');
          return `<tr>${rowHeader}${cells}</tr>`;
        }).join('');

        return `<div class="legal-table-wrap"><table>${headerRow}<tbody>${bodyRows}</tbody></table></div>`;
      }

      case 'signature': {
        const signatories = (block.data?.signatories || []).map((signatory) => (
          `<div class="legal-signature-line"><div class="line"></div><span>${escapeHtml(signatory.label || 'Signature')}</span></div>`
        )).join('');
        return `<div class="legal-signatures">${signatories}</div>`;
      }

      case 'page_break':
        return '<div class="legal-page-break"></div>';

      default:
        return '';
    }
  }).join('');
}

function deriveTocFromBlocks(blocks: FormBlock[]) {
  return blocks
    .filter((block) => block.type === 'section_header')
    .map((block, index) => {
      const title = `${block.data?.number ? `${block.data.number} ` : ''}${block.data?.title || `Section ${index + 1}`}`.trim();
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        || `section-${index + 1}`;

      return { id, title, level: 2 };
    });
}

export function useLegalDocumentViewer() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerDocument, setViewerDocument] = useState<LegalDocument | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const handleViewDocument = useCallback(async (slug: string) => {
    setLoadingSlug(slug);
    setViewerLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/resources/legal/${slug}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch document (${res.status})`);
      }

      const data: LegalDocumentResponse = await res.json();

      if (!data.available || !data.document) {
        toast.info('This document is not yet available. Please check back later.', {
          description: 'The compliance team is working on making this document available.',
        });
        return;
      }

      setViewerDocument({
        ...data.document,
        slug: data.slug,
      });
      setViewerOpen(true);
    } catch (error) {
      console.error('Error fetching legal document:', error);
      toast.error('Unable to load document. Please try again later.');
    } finally {
      setViewerLoading(false);
      setLoadingSlug(null);
    }
  }, []);

  const handlePrint = useCallback(() => {
    setViewerOpen(true);
  }, []);

  return {
    openDocument: handleViewDocument,
    loadingSlug,
    viewerOpen,
    setViewerOpen,
    viewerDocument,
    viewerLoading,
    handlePrint,
  };
}

interface LegalDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: LegalDocument | null;
  onPrint?: () => void;
}

export function LegalDocumentDialog({
  open,
  onOpenChange,
  document,
}: LegalDocumentDialogProps) {
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const registryEntry = document?.slug ? LEGAL_DOCUMENTS_BY_SLUG[document.slug] : null;
  const sectionLabel = document?.section && document.section in LEGAL_SECTION_LABELS
    ? LEGAL_SECTION_LABELS[document.section as keyof typeof LEGAL_SECTION_LABELS]
    : registryEntry?.section
      ? LEGAL_SECTION_LABELS[registryEntry.section]
      : 'Legal Document';

  const articleHtml = useMemo(() => {
    if (!document) return '<p></p>';
    return document.contentHtml || blocksToHtml(document.blocks || []);
  }, [document]);

  const sanitizedArticleHtml = useMemo(
    () => sanitizeLegalDocumentHtml(articleHtml),
    [articleHtml],
  );

  const normalizedDocumentContent = useMemo(() => {
    if (!document) {
      return {
        html: '<p></p>',
        toc: [] as Array<{ id: string; title: string; level: number }>,
      };
    }

    const preferredToc = document.toc?.length
      ? document.toc
      : deriveTocFromBlocks(document.blocks || []);

    return normalizeLegalDocumentAnchors(sanitizedArticleHtml, preferredToc);
  }, [document, sanitizedArticleHtml]);

  const toc = normalizedDocumentContent.toc;

  const pdfDocument = useMemo(() => {
    if (!document) return null;

    return {
      title: document.title,
      description: document.description || null,
      version: document.version,
      effectiveDate: document.effectiveDate || null,
      updatedAt: document.updatedAt,
      sectionLabel,
      html: normalizedDocumentContent.html,
      toc,
      pdfConfig: document.pdfConfig,
    };
  }, [document, normalizedDocumentContent.html, sectionLabel, toc]);

  const handleTocNavigate = useCallback((event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    if (!contentRef.current) return;

    const target = window.document.getElementById(id);
    if (!target || !contentRef.current.contains(target)) return;

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="h-[92vh] max-w-6xl overflow-hidden border-stone-200 bg-transparent p-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{document?.title || 'Legal document'}</DialogTitle>
            <DialogDescription>
              Review Navigate Wealth legal documentation without leaving the signup flow.
            </DialogDescription>
          </DialogHeader>

          <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_18%,#ffffff_100%)] shadow-2xl">
            <style dangerouslySetInnerHTML={{ __html: LEGAL_DOCUMENT_CONTENT_STYLE }} />

            <div className="border-b border-stone-200 bg-white/90 px-5 py-4 backdrop-blur sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                    Navigate Wealth legal library
                  </div>
                  <div className="mt-1 text-lg font-semibold text-stone-950 sm:text-xl">
                    {document?.title || 'Legal document'}
                  </div>
                </div>
                {document && (
                  <Button onClick={() => setPdfPreviewOpen(true)} className="bg-sky-700 hover:bg-sky-800">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                )}
              </div>
            </div>

            <div ref={contentRef} className="flex-1 overflow-y-auto">
              {document ? (
                <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <Card className="overflow-hidden border-stone-200 bg-white shadow-sm">
                      <CardContent className="p-0">
                        <div className="border-b border-stone-200 bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#ffffff_42%,#f5f5f4_100%)] px-6 py-7 sm:px-8">
                          <div className="mb-4 flex flex-wrap items-center gap-3">
                            <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">
                              {sectionLabel}
                            </Badge>
                            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                              Version {document.version}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="max-w-3xl">
                              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-sky-800">
                                <ShieldCheck className="h-4 w-4" />
                                Navigate Wealth legal publication
                              </div>
                              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">
                                {document.title}
                              </h2>
                              {document.description && (
                                <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
                                  {document.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-6 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                              <div className="text-xs uppercase tracking-wide text-stone-500">Effective date</div>
                              <div className="mt-1 text-sm font-medium text-stone-900">
                                {formatLongDate(document.effectiveDate)}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                              <div className="text-xs uppercase tracking-wide text-stone-500">Last updated</div>
                              <div className="mt-1 text-sm font-medium text-stone-900">
                                {formatLongDate(document.updatedAt)}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                              <div className="text-xs uppercase tracking-wide text-stone-500">Reader mode</div>
                              <div className="mt-1 text-sm font-medium text-stone-900">
                                {document.renderMode === 'versioned_document' ? 'Versioned legal document' : 'Legal document'}
                              </div>
                              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-500">
                                Version {document.version}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="px-6 py-8 sm:px-8">
                          <article
                            className={`${LEGAL_DOCUMENT_CONTENT_CLASS} prose-headings:scroll-mt-24`}
                            dangerouslySetInnerHTML={{ __html: normalizedDocumentContent.html }}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="hidden space-y-4 lg:block">
                      <Card className="border-stone-200 bg-white/95 shadow-sm backdrop-blur">
                        <CardContent className="p-5">
                          <div className="flex items-center gap-2 text-base font-semibold text-stone-900">
                            <FileText className="h-4 w-4 text-sky-700" />
                            On this page
                          </div>
                          <p className="mt-2 text-sm text-stone-500">
                            Jump to the sections most relevant to you.
                          </p>
                          <div className="mt-4 space-y-2">
                            {toc.length > 0 ? (
                              toc.map((entry) => (
                                <a
                                  key={entry.id}
                                  href={`#${entry.id}`}
                                  onClick={(event) => handleTocNavigate(event, entry.id)}
                                  className={`block rounded-lg px-3 py-2 text-sm transition hover:bg-stone-100 hover:text-stone-950 ${
                                    entry.level > 2 ? 'pl-6 text-stone-500' : 'text-stone-700'
                                  }`}
                                >
                                  {entry.title}
                                </a>
                              ))
                            ) : (
                              <p className="text-sm text-stone-500">
                                This document does not have indexed sections yet.
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-stone-200 bg-white/95 shadow-sm">
                        <CardContent className="p-4 text-sm text-stone-600">
                          <div className="flex items-center gap-2 font-medium text-stone-900">
                            <CalendarDays className="h-4 w-4 text-sky-700" />
                            Reading details
                          </div>
                          <Separator className="my-3" />
                          <div>
                            Section: <span className="font-medium text-stone-900">{sectionLabel}</span>
                          </div>
                          <div className="mt-2">
                            Version: <span className="font-medium text-stone-900">{document.version}</span>
                          </div>
                          <div className="mt-2">
                            Effective: <span className="font-medium text-stone-900">{formatLongDate(document.effectiveDate)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center px-6 py-16">
                  <div className="max-w-md text-center text-stone-500">
                    <FileText className="mx-auto mb-4 h-12 w-12 opacity-40" />
                    <p className="font-medium text-stone-700">Document content not yet available</p>
                    <p className="mt-2 text-sm">
                      The compliance team is preparing this document for client viewing.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {document && (
              <div className="border-t border-stone-200 bg-white/90 px-5 py-3 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
                  <div>
                    Please review these terms carefully before continuing with your signup.
                  </div>
                  <div className="inline-flex items-center gap-1 font-medium text-sky-800">
                    Read in full screen on the legal hub
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <LegalDocumentPdfDialog
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        document={pdfDocument}
      />
    </>
  );
}
