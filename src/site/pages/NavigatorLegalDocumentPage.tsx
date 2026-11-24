/**
 * NavigatorLegalDocumentPage — a published legal document (/legal/:slug) in
 * the redesign.
 *
 * It is the live page (LegalDocumentPage.tsx) underneath: the same request to
 * GET /resources/legal/:slug, the same loading, unavailable and failed
 * states, the document's text exactly as the live page renders it (its own
 * HTML, or its blocks, sanitised and given the same anchors), the same
 * contents list and jump, the same dates and version, the same PDF (layout,
 * download and print), the same way back to the hub's section, and the same
 * SEO tags and JSON-LD.
 *
 * The layout is the "LegalDocument" board of the Website Redesign canvas. It
 * adds the board's reading-progress bar, the other documents in the same
 * section, and a back-to-top button at every width.
 */
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useParams } from 'react-router';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import {
  blocksToHtml,
  deriveTocFromBlocks,
  formatLongDate,
} from '../../components/pages/legalDocumentContent';
import {
  LEGAL_DOCUMENTS_BY_SLUG,
  LEGAL_SECTION_LABELS,
} from '../../shared/legal-documents-registry';
import { normalizeLegalDocumentAnchors, sanitizeLegalDocumentHtml } from '../../utils/legalHtml';
import { siteAbsoluteUrl } from '@/utils/siteOrigin';
import { LegalDocAside, LegalDocMobileToc, type LegalTocEntry } from '../sections/LegalDocContents';
import { LegalDocFacts, LegalDocHeader } from '../sections/LegalDocHeader';
import { LegalDocPdfDialog } from '../sections/LegalDocPdfDialog';
import { LegalDocRelated } from '../sections/LegalDocRelated';
import { LegalIcon } from '../sections/LegalIcons';
import {
  BACK_TO_TOP_AFTER,
  HEADING_OFFSET,
  demoteDocumentHeadings,
  prefersReducedMotion,
  readingProgress,
  tocIndents,
  useLegalDocument,
} from '../sections/legalDocumentModel';
import {
  LEGAL_COMPANY_LINE,
  isLegalSection,
  relatedDocuments,
  sectionIcon,
} from '../sections/legalModel';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/legal.css';

function scrollBehaviour(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

export function NavigatorLegalDocumentPage() {
  const { slug } = useParams<{ slug: string }>();
  const { documentResponse, loading, error } = useLegalDocument(slug);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const legalDocument = documentResponse?.document || null;
  const registryEntry = slug ? LEGAL_DOCUMENTS_BY_SLUG[slug] : null;
  const sectionLabel =
    legalDocument?.section && legalDocument.section in LEGAL_SECTION_LABELS
      ? LEGAL_SECTION_LABELS[legalDocument.section as keyof typeof LEGAL_SECTION_LABELS]
      : registryEntry?.section
        ? LEGAL_SECTION_LABELS[registryEntry.section]
        : 'Legal Document';
  const sectionKey = legalDocument?.section || registryEntry?.section || null;

  // ── The document, exactly as the live page prepares it ──
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
  const displayHtml = useMemo(
    () => demoteDocumentHeadings(normalizedDocumentContent.html),
    [normalizedDocumentContent.html],
  );
  const tocEntries = useMemo<LegalTocEntry[]>(() => {
    const indents = tocIndents(toc);
    return toc.map((entry, i) => ({ id: entry.id, title: entry.title, sub: indents[i] }));
  }, [toc]);

  const pdfDocument = useMemo(() => {
    if (!legalDocument) return null;

    return {
      title: legalDocument.title,
      description: legalDocument.description || null,
      version: legalDocument.version,
      effectiveDate: legalDocument.effectiveDate,
      updatedAt: legalDocument.updatedAt,
      sectionLabel,
      slug: slug ?? null,
      html: normalizedDocumentContent.html,
      toc,
      pdfConfig: legalDocument.pdfConfig,
    };
  }, [legalDocument, normalizedDocumentContent.html, sectionLabel, slug, toc]);

  // ── Reading progress, back to top, and the contents entry in view ──
  useEffect(() => {
    let frame: number | null = null;
    const measure = () => {
      frame = null;
      const doc = window.document.documentElement;
      setProgress(readingProgress(window.scrollY, doc.scrollHeight, window.innerHeight));
      setShowBackToTop(window.scrollY > BACK_TO_TOP_AFTER);
      if (toc.length === 0) return;
      let current = toc[0].id;
      for (const entry of toc) {
        const heading = window.document.getElementById(entry.id);
        if (!heading) continue;
        if (heading.getBoundingClientRect().top <= HEADING_OFFSET + 1) current = entry.id;
        else break;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (frame === null) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [toc]);

  const handleTocNavigate = useCallback((event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();

    if (typeof window === 'undefined') return;

    setActiveId(id);
    // Folding the phone contents shifts the page up, so measure the target on
    // the next frame, once it has closed (as live).
    setMobileTocOpen(false);
    window.requestAnimationFrame(() => {
      const target = window.document.getElementById(id);
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - HEADING_OFFSET;
      window.history.replaceState(null, '', `#${id}`);
      window.scrollTo({ top: Math.max(top, 0), behavior: scrollBehaviour() });
    });
  }, []);

  const seoTitle = legalDocument
    ? `${legalDocument.title} | Navigate Wealth Legal`
    : 'Legal Document | Navigate Wealth';
  const seoDescription =
    legalDocument?.description ||
    `Read the ${registryEntry?.name || 'legal document'} from Navigate Wealth.`;

  const chip = isLegalSection(sectionKey)
    ? { label: sectionLabel, icon: sectionIcon(sectionKey) }
    : registryEntry
      ? { label: sectionLabel, icon: sectionIcon(registryEntry.section) }
      : undefined;
  const related = isLegalSection(sectionKey) ? relatedDocuments(sectionKey, slug) : [];

  if (loading) {
    return (
      <div className="nw-site nwld">
        <div className="nwld-progress" aria-hidden="true">
          <div className="nwld-progress-bar" style={{ width: '0%' }} />
        </div>
        <LegalDocHeader
          backHref={registryEntry ? `/legal?section=${registryEntry.section}` : '/legal'}
          section={chip}
          title={registryEntry?.name || 'Legal document'}
          description={registryEntry?.description}
        >
          <p className="nwld-status" role="status">
            <LegalIcon name="spinner" size={18} className="nwld-spin" />
            Loading legal document…
          </p>
        </LegalDocHeader>
      </div>
    );
  }

  if (!legalDocument || error) {
    return (
      <div className="nw-site nwld">
        <SEO
          title={seoTitle}
          description={seoDescription}
          canonicalUrl={siteAbsoluteUrl(`/legal/${slug || ''}`)}
        />
        <div className="nwld-progress" aria-hidden="true">
          <div className="nwld-progress-bar" style={{ width: '0%' }} />
        </div>
        <LegalDocHeader
          backHref={registryEntry ? `/legal?section=${registryEntry.section}` : '/legal'}
          section={chip}
          title="Legal document unavailable"
          description={error || 'This document could not be loaded right now.'}
        />
      </div>
    );
  }

  const effective = formatLongDate(legalDocument.effectiveDate);

  return (
    <div className="nw-site nwld">
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

      <div className="nwld-progress" aria-hidden="true">
        <div className="nwld-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <LegalDocHeader
        backHref={`/legal?section=${legalDocument.section || registryEntry?.section || 'legal-notices'}`}
        section={chip}
        title={legalDocument.title}
        description={legalDocument.description}
        action={
          <button
            type="button"
            className="nw-btn nwld-download"
            onClick={() => setPdfPreviewOpen(true)}
          >
            <LegalIcon name="download" size={17} />
            Download PDF
          </button>
        }
      >
        <LegalDocFacts
          effective={effective}
          updated={formatLongDate(legalDocument.updatedAt)}
          version={legalDocument.version}
        />
      </LegalDocHeader>

      <div className="nw-wrap nwld-body">
        <LegalDocAside
          entries={tocEntries}
          activeId={activeId}
          onNavigate={handleTocNavigate}
          sectionLabel={sectionLabel}
          version={legalDocument.version}
          effective={effective}
        />
        <div className="nwld-main">
          <LegalDocMobileToc
            entries={tocEntries}
            activeId={activeId}
            onNavigate={handleTocNavigate}
            open={mobileTocOpen}
            onToggle={() => setMobileTocOpen((open) => !open)}
          />
          <article
            className="nwld-prose"
            aria-label={legalDocument.title}
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
          <p className="nw-mono nwld-company">{LEGAL_COMPANY_LINE}</p>
        </div>
      </div>

      <LegalDocRelated
        sectionLabel={isLegalSection(sectionKey) ? sectionLabel : null}
        documents={related}
      />

      {showBackToTop ? (
        <button
          type="button"
          className="nwld-top nwld-pop"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: scrollBehaviour() })}
        >
          <LegalIcon name="arrowUp" size={20} />
        </button>
      ) : null}

      <LegalDocPdfDialog
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        document={pdfDocument}
      />
    </div>
  );
}

export default NavigatorLegalDocumentPage;
