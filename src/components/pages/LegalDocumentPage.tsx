import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  List,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import {
  LEGAL_DOCUMENTS_BY_SLUG,
  LEGAL_SECTION_LABELS,
} from '../../shared/legal-documents-registry';
import { LegalDocumentPdfDialog } from '../shared/LegalDocumentPdfDialog';
import {
  LEGAL_DOCUMENT_CONTENT_CLASS,
  normalizeLegalDocumentAnchors,
  sanitizeLegalDocumentHtml,
} from '../../utils/legalHtml';
import { siteAbsoluteUrl } from '@/utils/siteOrigin';

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
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'section_header': {
          const title = block.data?.title || '';
          const number = block.data?.number ? `${block.data.number} ` : '';
          const heading = `${number}${title}`.trim();
          const id =
            heading
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .trim()
              .replace(/\s+/g, '-') || `section-${Math.random().toString(36).slice(2, 8)}`;

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

          const bodyRows = (block.data?.rows || [])
            .map((row, rowIndex) => {
              const rowHeader = hasRowHeaders
                ? `<th>${escapeHtml((block.data?.rowHeaders || [])[rowIndex] || '')}</th>`
                : '';
              const cells = (row.cells || [])
                .map((cell) => `<td>${escapeHtml(cell.value || '')}</td>`)
                .join('');
              return `<tr>${rowHeader}${cells}</tr>`;
            })
            .join('');

          return `<div class="legal-table-wrap"><table>${headerRow}<tbody>${bodyRows}</tbody></table></div>`;
        }
        case 'signature': {
          const signatories = (block.data?.signatories || [])
            .map(
              (signatory) =>
                `<div class="legal-signature-line"><div class="line"></div><span>${escapeHtml(signatory.label || 'Signature')}</span></div>`,
            )
            .join('');

          return `<div class="legal-signatures">${signatories}</div>`;
        }
        case 'page_break':
          return '<div class="legal-page-break"></div>';
        default:
          return '';
      }
    })
    .join('');
}

function deriveTocFromBlocks(blocks: LegalBlock[]) {
  return blocks
    .filter((block) => block.type === 'section_header')
    .map((block, index) => {
      const title =
        `${block.data?.number ? `${block.data.number} ` : ''}${block.data?.title || `Section ${index + 1}`}`.trim();
      const id =
        title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-') || `section-${index + 1}`;

      return { id, title, level: 2 };
    });
}

export function LegalDocumentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [documentResponse, setDocumentResponse] = useState<PublicLegalDocumentResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Below the laptop layout there is no sticky sidebar, so a long document
  // gets a way back to the top once the reader is well into it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setShowBackToTop(window.scrollY > 1200);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

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

        const data = (await res.json()) as PublicLegalDocumentResponse;
        if (!active) return;

        if (!data.available || !data.document) {
          setError('This legal document is not available yet.');
          setDocumentResponse(data);
        } else {
          setDocumentResponse(data);
        }
      } catch (fetchError) {
        if (!active) return;
        setError(
          fetchError instanceof Error ? fetchError.message : 'Unable to load legal document',
        );
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

  const legalDocument = documentResponse?.document || null;
  const registryEntry = slug ? LEGAL_DOCUMENTS_BY_SLUG[slug] : null;
  const sectionLabel =
    legalDocument?.section && legalDocument.section in LEGAL_SECTION_LABELS
      ? LEGAL_SECTION_LABELS[legalDocument.section as keyof typeof LEGAL_SECTION_LABELS]
      : registryEntry?.section
        ? LEGAL_SECTION_LABELS[registryEntry.section]
        : 'Legal Document';

  const articleHtml = useMemo(() => {
    if (!legalDocument) return '<p></p>';
    return legalDocument.contentHtml || blocksToHtml(legalDocument.blocks || []);
  }, [legalDocument]);

  const sanitizedArticleHtml = useMemo(() => sanitizeLegalDocumentHtml(articleHtml), [articleHtml]);

  const normalizedDocumentContent = useMemo(() => {
    if (!legalDocument) {
      return {
        html: '<p></p>',
        toc: [] as Array<{ id: string; title: string; level: number }>,
      };
    }

    const preferredToc = legalDocument.toc?.length
      ? legalDocument.toc
      : deriveTocFromBlocks(legalDocument.blocks || []);

    return normalizeLegalDocumentAnchors(sanitizedArticleHtml, preferredToc);
  }, [legalDocument, sanitizedArticleHtml]);

  const toc = normalizedDocumentContent.toc;

  const pdfDocument = useMemo(() => {
    if (!legalDocument) return null;

    return {
      title: legalDocument.title,
      description: legalDocument.description || null,
      version: legalDocument.version,
      effectiveDate: legalDocument.effectiveDate,
      updatedAt: legalDocument.updatedAt,
      sectionLabel,
      html: normalizedDocumentContent.html,
      toc,
      pdfConfig: legalDocument.pdfConfig,
    };
  }, [legalDocument, normalizedDocumentContent.html, sectionLabel, toc]);

  const openPdfPreview = useCallback(() => {
    if (!legalDocument) return;
    setPdfPreviewOpen(true);
  }, [legalDocument]);

  const handleTocNavigate = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      event.preventDefault();

      if (typeof window === 'undefined') return;

      // Folding the phone contents panel shifts the page up, so measure the
      // target on the next frame, once it has closed.
      setMobileTocOpen(false);
      window.requestAnimationFrame(() => {
        const target = window.document.getElementById(id);
        if (!target) return;

        // Clear the sticky site header: the desktop one is far taller than the
        // 57px bar a phone keeps pinned.
        const offset = window.matchMedia?.('(min-width: 1024px)').matches ? 180 : 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.history.replaceState(null, '', `#${id}`);
        window.scrollTo({
          top: Math.max(top, 0),
          behavior: 'smooth',
        });
      });
    },
    [],
  );

  const seoTitle = legalDocument
    ? `${legalDocument.title} | Navigate Wealth Legal`
    : 'Legal Document | Navigate Wealth';
  const seoDescription =
    legalDocument?.description ||
    `Read the ${registryEntry?.name || 'legal document'} from Navigate Wealth.`;

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center rounded-3xl border border-neutral-200 bg-white py-24 shadow-sm">
            <Loader2 className="mr-3 h-6 w-6 animate-spin text-neutral-900" />
            <span className="text-sm font-medium text-neutral-700">Loading legal document…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!legalDocument || error) {
    return (
      <div className="min-h-screen bg-white">
        <SEO
          title={seoTitle}
          description={seoDescription}
          canonicalUrl={siteAbsoluteUrl(`/legal/${slug || ''}`)}
        />
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-neutral-900">
                Legal document unavailable
              </CardTitle>
              <CardDescription>
                {error || 'This document could not be loaded right now.'}
              </CardDescription>
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
    <div className="min-h-screen bg-white">
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={siteAbsoluteUrl(`/legal/${slug}`)}
        structuredData={createWebPageSchema(
          seoTitle,
          seoDescription,
          siteAbsoluteUrl(`/legal/${slug}`),
        )}
      />

      <div className="mx-auto max-w-screen-2xl px-4 pt-5 pb-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-3 sm:mb-8">
          <Button asChild variant="outline" className="border-neutral-300 bg-white">
            <Link
              to={`/legal?section=${legalDocument.section || registryEntry?.section || 'legal-notices'}`}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to legal hub
            </Link>
          </Button>
          <Badge className="border-neutral-300 bg-white text-neutral-900 hover:bg-white">
            {sectionLabel}
          </Badge>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card className="overflow-hidden border-neutral-200 bg-white shadow-sm">
              <CardContent className="p-0">
                <div className="border-b border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-4xl">
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-900 sm:mb-4">
                        <ShieldCheck className="h-4 w-4" />
                        Navigate Wealth legal publication
                      </div>
                      <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                        {legalDocument.title}
                      </h1>
                      {legalDocument.description && (
                        <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600 sm:mt-4">
                          {legalDocument.description}
                        </p>
                      )}
                    </div>
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                      <Button
                        onClick={openPdfPreview}
                        className="h-11 w-full bg-neutral-950 text-white hover:bg-neutral-800 sm:h-10 sm:w-auto"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                    </div>
                  </div>

                  {/* Phones: one compact list. From sm up: the three tiles. */}
                  <dl className="mt-5 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 sm:mt-6 sm:grid sm:grid-cols-3 sm:gap-3 sm:divide-y-0 sm:rounded-none sm:border-0">
                    <div className="flex items-baseline justify-between gap-4 px-4 py-3 sm:block sm:rounded-2xl sm:border sm:border-neutral-200 sm:bg-white">
                      <dt className="text-xs uppercase tracking-wide text-neutral-500">
                        Effective date
                      </dt>
                      <dd className="text-sm font-medium text-neutral-900 sm:mt-1">
                        {formatLongDate(legalDocument.effectiveDate)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 px-4 py-3 sm:block sm:rounded-2xl sm:border sm:border-neutral-200 sm:bg-white">
                      <dt className="text-xs uppercase tracking-wide text-neutral-500">
                        Last updated
                      </dt>
                      <dd className="text-sm font-medium text-neutral-900 sm:mt-1">
                        {formatLongDate(legalDocument.updatedAt)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 px-4 py-3 sm:block sm:rounded-2xl sm:border sm:border-neutral-200 sm:bg-white">
                      <dt className="text-xs uppercase tracking-wide text-neutral-500">
                        <span className="sm:hidden">Version</span>
                        <span className="hidden sm:inline">Reader mode</span>
                      </dt>
                      <dd className="text-sm font-medium text-neutral-900 sm:mt-1">
                        <span className="sm:hidden">{legalDocument.version}</span>
                        <span className="hidden sm:inline">
                          {legalDocument.renderMode === 'versioned_document'
                            ? 'Versioned legal document'
                            : 'Legacy legal document'}
                        </span>
                      </dd>
                      <dd className="mt-1 hidden text-xs font-medium uppercase tracking-wide text-neutral-500 sm:block">
                        Version {legalDocument.version}
                      </dd>
                    </div>
                  </dl>
                </div>

                {toc.length > 0 && (
                  // Below the laptop layout the sidebar is gone, so the
                  // contents sit here, folded, rather than after the document.
                  <details
                    className="group border-b border-neutral-200 lg:hidden"
                    open={mobileTocOpen}
                    onToggle={(event) => setMobileTocOpen(event.currentTarget.open)}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-neutral-900 sm:px-8 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <List className="h-4 w-4" />
                        On this page
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                        {toc.length} {toc.length === 1 ? 'section' : 'sections'}
                        <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
                      </span>
                    </summary>
                    <nav
                      aria-label="On this page"
                      className="max-h-[60vh] overflow-y-auto overscroll-contain px-3 pb-3 sm:px-6"
                    >
                      {toc.map((entry) => (
                        <a
                          key={entry.id}
                          href={`#${entry.id}`}
                          onClick={(event) => handleTocNavigate(event, entry.id)}
                          className={`block rounded-lg px-2 py-2.5 text-sm leading-snug transition hover:bg-neutral-100 hover:text-neutral-950 ${
                            entry.level > 2 ? 'pl-6 text-neutral-500' : 'text-neutral-700'
                          }`}
                        >
                          {entry.title}
                        </a>
                      ))}
                    </nav>
                  </details>
                )}

                <div className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
                  <article
                    className={`${LEGAL_DOCUMENT_CONTENT_CLASS} prose-headings:scroll-mt-28`}
                    dangerouslySetInnerHTML={{ __html: normalizedDocumentContent.html }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:self-start">
            <Card className="border-neutral-200 bg-white/95 shadow-sm backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-neutral-900">
                  <FileText className="h-4 w-4 text-neutral-900" />
                  On this page
                </CardTitle>
                <CardDescription>Jump to the sections most relevant to you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {toc.length > 0 ? (
                  toc.map((entry) => (
                    <a
                      key={entry.id}
                      href={`#${entry.id}`}
                      onClick={(event) => handleTocNavigate(event, entry.id)}
                      className={`block rounded-lg px-3 py-2 text-sm transition hover:bg-neutral-100 hover:text-neutral-950 ${
                        entry.level > 2 ? 'pl-6 text-neutral-500' : 'text-neutral-700'
                      }`}
                    >
                      {entry.title}
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500">
                    This document does not have indexed sections yet.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-neutral-200 bg-white/95 shadow-sm">
              <CardContent className="p-4 text-sm text-neutral-600">
                <div className="flex items-center gap-2 font-medium text-neutral-900">
                  <CalendarDays className="h-4 w-4 text-neutral-900" />
                  Reading details
                </div>
                <Separator className="my-3" />
                <div>
                  Section: <span className="font-medium text-neutral-900">{sectionLabel}</span>
                </div>
                <div className="mt-2">
                  Version:{' '}
                  <span className="font-medium text-neutral-900">{legalDocument.version}</span>
                </div>
                <div className="mt-2">
                  Effective:{' '}
                  <span className="font-medium text-neutral-900">
                    {formatLongDate(legalDocument.effectiveDate)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
        className={`fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900 shadow-lg transition duration-200 lg:hidden ${
          showBackToTop ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
        }`}
      >
        <ArrowUp className="h-5 w-5" />
      </button>

      <LegalDocumentPdfDialog
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        document={pdfDocument}
      />
    </div>
  );
}

export default LegalDocumentPage;
