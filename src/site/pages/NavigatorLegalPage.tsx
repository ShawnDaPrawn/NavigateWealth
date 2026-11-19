/**
 * NavigatorLegalPage — the redesigned Legal & Compliance hub (/legal).
 *
 * It keeps the live hub's address handling (LegalPage.tsx): `?section=` opens
 * one of the four sections (the footer links to each), an unknown value is
 * rewritten to Legal Notices, choosing a section rewrites the address in
 * place, and arriving on a new address scrolls to the top. It lists the same
 * documents, from the shared registry, each linking to /legal/<slug>, and
 * emits the same SEO tags and JSON-LD.
 *
 * The layout is the "Legal" board of the Website Redesign canvas. Beyond the
 * live hub it adds the board's search over the documents' names and
 * descriptions, and its four "Most requested" shortcuts.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import type { LegalDocumentSection } from '../../shared/legal-documents-registry';
import { LegalAssist } from '../sections/LegalAssist';
import { LegalHubHero } from '../sections/LegalHubHero';
import { LegalLibrary } from '../sections/LegalLibrary';
import {
  DEFAULT_LEGAL_SECTION,
  isLegalSection,
  searchLegalDocuments,
} from '../sections/legalModel';
import { prefersReducedMotion } from '../sections/legalDocumentModel';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/legal.css';

export function NavigatorLegalPage() {
  const seoData = getSEOData('legal');
  const base = useId();
  const tabId = useCallback((key: LegalDocumentSection) => `${base}-tab-${key}`, [base]);
  const panelId = `${base}-panel`;

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const sectionParam = searchParams.get('section');
  const [active, setActive] = useState<LegalDocumentSection>(() =>
    isLegalSection(sectionParam) ? sectionParam : DEFAULT_LEGAL_SECTION,
  );
  const [query, setQuery] = useState('');

  // The live hub's handling of ?section=: a known section opens, an unknown
  // one is rewritten to Legal Notices, none means Legal Notices. Arriving on a
  // section (a footer link, say) also leaves any search.
  useEffect(() => {
    if (isLegalSection(sectionParam)) {
      setActive(sectionParam);
    } else if (sectionParam) {
      setSearchParams({ section: DEFAULT_LEGAL_SECTION });
      setActive(DEFAULT_LEGAL_SECTION);
    } else {
      setActive(DEFAULT_LEGAL_SECTION);
    }
    setQuery('');
  }, [sectionParam, setSearchParams]);

  // The live hub scrolls to the top whenever the address changes. Choosing a
  // tab here is the exception: the tabs sit below the hero, and scrolling away
  // from the list just opened would hide it.
  const pickedHere = useRef(false);
  useEffect(() => {
    if (pickedHere.current) {
      pickedHere.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [location.search]);

  const selectSection = (key: LegalDocumentSection) => {
    if (key === active) return;
    pickedHere.current = true;
    setActive(key);
    setSearchParams({ section: key }, { replace: true });
  };

  const results = useMemo(() => searchLegalDocuments(query), [query]);

  return (
    <div className="nw-site nwlg">
      <SEO
        {...seoData}
        structuredData={createWebPageSchema(
          seoData.title,
          seoData.description,
          seoData.canonicalUrl,
        )}
      />
      <LegalHubHero query={query} onQueryChange={setQuery} />
      <LegalLibrary
        active={active}
        onSelect={selectSection}
        query={query}
        results={results}
        onClear={() => setQuery('')}
        tabId={tabId}
        panelId={panelId}
      />
      <LegalAssist />
    </div>
  );
}

export default NavigatorLegalPage;
