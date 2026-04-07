import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CalendarDays, Download, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { LEGAL_DOCUMENTS_BY_SLUG, LEGAL_SECTION_LABELS } from '../../shared/legal-documents-registry';
import { LegalDocumentPdfDialog } from '../shared/LegalDocumentPdf';
import { sanitizeLegalDocumentHtml } from '../../utils/legalHtml';

type LegalBlock = {
  id?: string;
  type: string;
  data?: {
    number?: string;
    title?: string;
    content?: string;
    columns?: number;
    fields?: Array<{ label?: string; key?: string }>;
    signatories?: Array<{ label?: string }>;
    showDate?: boolean;
    rows?: Array<{ id?: string; cells?: Array<{ value?: string }> }>;
    hasColumnHeaders?: boolean;
    hasRowHeaders?: boolean;
    columnHeaders?: string[];
    rowHeaders?: string[];
  };
};

type PublicLegalDocumentResponse = {
  available: boolean;
  slug: string;
  document?: {
    id: string;
    title: string;
    description?: string;
    blocks: LegalBlock[];
    version: string;
    updatedAt: string;
    effectiveDate: string | null;
    section: string | null;
    toc: Array<{ id: string; title: string; level: number }>;
    contentHtml: string | null;
    renderMode: 'legacy_resource' | 'versioned_document';
    pdfConfig: {
      pageSize: 'A4' | 'A3';
      orientation: 'portrait' | 'landscape';
    };
  };
};

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

function blocksToHtml(blocks: LegalBlock[]): string {
  return blocks.map((block) => {
    switch (block.type) {
      case 'section_header': {
        const title = block.data?.title || '';
        const number = block.data?.number ? `${block.data.number} ` : '';
        const heading = `${number}${title}`.trim();
        const id = heading
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          || `section-${Math.random().toString(36).slice(2, 8)}`;

        return `<section class="legal-section"><h2 id="${escapeHtml(id)}">${escapeHtml(heading)}</h2></section>`;
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
          const cells = (row.cells || []).map((cell) => `<td>${escapeHtml(cell.value || '')}</td>`).join('');
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

function deriveTocFromBlocks(blocks: LegalBlock[]) {
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

export function LegalDocumentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [documentResponse, setDocumentResponse] = useState<PublicLegalDocumentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDocument() {
      if (!slug) {
        setError('Legal document not found');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${BASE_URL}/resources/legal/${slug}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch document (${res.status})`);
        }

        const data = await res.json() as PublicLegalDocumentResponse;
        if (!active) return;

        if (!data.available || !data.document) {
          setError('This legal document is not available yet.');
          setDocumentResponse(data);
        } else {
          setDocumentResponse(data);
        }
      } catch (fetchError) {
        if (!active) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load legal document');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDocument();
    return () => {
      active = false;
    };
  }, [slug]);

  const document = documentResponse?.document || null;
  const registryEntry = slug ? LEGAL_DOCUMENTS_BY_SLUG[slug] : null;
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

  const toc = useMemo(() => {
    if (!document) return [];
    return document.toc?.length ? document.toc : deriveTocFromBlocks(document.blocks || []);
  }, [document]);

  const pdfDocument = useMemo(() => {
    if (!document) return null;

    return {
      title: document.title,
      description: document.description || null,
      version: document.version,
      effectiveDate: document.effectiveDate,
      updatedAt: document.updatedAt,
      sectionLabel,
      html: sanitizedArticleHtml,
      toc,
      pdfConfig: document.pdfConfig,
    };
  }, [document, sanitizedArticleHtml, sectionLabel, toc]);

  const openPdfPreview = useCallback(() => {
    if (!document) return;
    setPdfPreviewOpen(true);
  }, [document]);

  const seoTitle = document ? `${document.title} | Navigate Wealth Legal` : 'Legal Document | Navigate Wealth';
  const seoDescription = document?.description || `Read the ${registryEntry?.name || 'legal document'} from Navigate Wealth.`;

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="mx-auto max-w-screen-2xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center rounded-3xl border border-stone-200 bg-white py-24 shadow-sm">
            <Loader2 className="mr-3 h-6 w-6 animate-spin text-sky-700" />
            <span className="text-sm font-medium text-stone-700">Loading legal document…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!document || error) {
    return (
      <div className="min-h-screen bg-stone-50">
        <SEO title={seoTitle} description={seoDescription} canonicalUrl={`https://navigatewealth.co/legal/${slug || ''}`} />
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
          <Card className="border-stone-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-stone-900">Legal document unavailable</CardTitle>
              <CardDescription>{error || 'This document could not be loaded right now.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to={registryEntry ? `/legal?section=${registryEntry.section}` : '/legal'}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to legal hub
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_18%,#ffffff_100%)]">
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={`https://navigatewealth.co/legal/${slug}`}
        structuredData={createWebPageSchema(seoTitle, seoDescription, `https://navigatewealth.co/legal/${slug}`)}
      />

      <div className="mx-auto max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="border-stone-300 bg-white/90">
            <Link to={`/legal?section=${document.section || registryEntry?.section || 'legal-notices'}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to legal hub
            </Link>
          </Button>
          <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">
            {sectionLabel}
          </Badge>
          <Badge variant="outline" className="border-stone-300 text-stone-700">
            Version {document.version}
          </Badge>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card className="overflow-hidden border-stone-200 bg-white shadow-sm">
              <CardContent className="p-0">
                <div className="border-b border-stone-200 bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#ffffff_42%,#f5f5f4_100%)] px-6 py-8 sm:px-8 lg:px-10">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-4xl">
                      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-sky-800">
                        <ShieldCheck className="h-4 w-4" />
                        Navigate Wealth legal publication
                      </div>
                      <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
                        {document.title}
                      </h1>
                      {document.description && (
                        <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
                          {document.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={openPdfPreview} className="bg-sky-700 hover:bg-sky-800">
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-stone-500">Effective date</div>
                      <div className="mt-1 text-sm font-medium text-stone-900">{formatLongDate(document.effectiveDate)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-stone-500">Last updated</div>
                      <div className="mt-1 text-sm font-medium text-stone-900">{formatLongDate(document.updatedAt)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-stone-500">Reader mode</div>
                      <div className="mt-1 text-sm font-medium text-stone-900">
                        {document.renderMode === 'versioned_document' ? 'Versioned legal document' : 'Legacy legal document'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-8 sm:px-8 lg:px-10">
                  <article
                    className="prose prose-stone max-w-none prose-headings:scroll-mt-28 prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-3xl prose-h2:mt-12 prose-h2:border-t prose-h2:border-stone-200 prose-h2:pt-8 prose-h2:text-2xl prose-h3:mt-8 prose-h3:text-xl prose-p:leading-8 prose-li:leading-8 prose-table:block prose-table:w-full prose-th:bg-stone-100 prose-th:text-stone-900 prose-td:align-top"
                    dangerouslySetInnerHTML={{ __html: sanitizedArticleHtml }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-stone-200 bg-white/95 shadow-sm backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-stone-900">
                  <FileText className="h-4 w-4 text-sky-700" />
                  On this page
                </CardTitle>
                <CardDescription>
                  Jump to the sections most relevant to you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {toc.length > 0 ? (
                  toc.map((entry) => (
                    <a
                      key={entry.id}
                      href={`#${entry.id}`}
                      className={`block rounded-lg px-3 py-2 text-sm transition hover:bg-stone-100 hover:text-stone-950 ${
                        entry.level > 2 ? 'pl-6 text-stone-500' : 'text-stone-700'
                      }`}
                    >
                      {entry.title}
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">This document does not have indexed sections yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-stone-200 bg-white/95 shadow-sm">
              <CardContent className="p-4 text-sm text-stone-600">
                <div className="flex items-center gap-2 font-medium text-stone-900">
                  <CalendarDays className="h-4 w-4 text-sky-700" />
                  Reading details
                </div>
                <Separator className="my-3" />
                <div>Section: <span className="font-medium text-stone-900">{sectionLabel}</span></div>
                <div className="mt-2">Version: <span className="font-medium text-stone-900">{document.version}</span></div>
                <div className="mt-2">Effective: <span className="font-medium text-stone-900">{formatLongDate(document.effectiveDate)}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <LegalDocumentPdfDialog
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        document={pdfDocument}
      />
    </div>
  );
}
