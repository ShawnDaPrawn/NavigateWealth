/**
 * LegalHubHero — the Legal hub's heading, its search box and the four most
 * requested documents. The heading and introduction are the live hub's; the
 * counts are counted from the document registry.
 */
import { useId, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { LegalIcon } from './LegalIcons';
import {
  LEGAL_DOCUMENT_COUNT,
  LEGAL_REGULATOR_LINE,
  LEGAL_SECTIONS,
  MOST_REQUESTED,
  legalDocumentHref,
  sectionLabel,
} from './legalModel';

interface LegalHubHeroProps {
  query: string;
  onQueryChange: (value: string) => void;
}

export function LegalHubHero({ query, onQueryChange }: LegalHubHeroProps) {
  const searchId = useId();

  return (
    <section className="nwlg-hero">
      <div className="nw-grid-bg nwlg-fade" aria-hidden="true" />
      <div className="nwlg-hero-glow" aria-hidden="true" />
      <div className="nw-wrap nwlg-hero-grid">
        <div>
          <nav aria-label="Breadcrumb" className="nw-mono nwlg-crumbs">
            <Link to="/" className="nwlg-crumb">
              Home
            </Link>
            <LegalIcon name="chevronRight" size={12} />
            <span className="nwlg-crumb-here" aria-current="page">
              Legal
            </span>
          </nav>
          <div className="nwlg-badge">
            <LegalIcon name="scale" size={14} stroke="#C5CAD3" />
            <span>Legal Information</span>
          </div>
          <h1 className="nwlg-h1">
            Legal &amp; <span className="nw-accent">Compliance</span>
          </h1>
          <p className="nwlg-lead">
            We are committed to transparency and regulatory compliance. Review our legal documents,
            privacy policies, and regulatory disclosures to understand how we protect your interests
            and comply with financial services regulations.
          </p>

          <div className="nwlg-searchbox">
            <label htmlFor={searchId} className="nw-sr-only">
              Search legal documents
            </label>
            <LegalIcon name="search" size={18} stroke="#9AA3B2" className="nwlg-search-icon" />
            <input
              id={searchId}
              className="nwlg-search"
              type="search"
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
              placeholder={`Search ${LEGAL_DOCUMENT_COUNT} documents — e.g. privacy, complaints, FAIS…`}
            />
          </div>

          <div className="nw-mono nwlg-stats">
            <span className="nwlg-stat">
              <span className="nwlg-dot" />
              {LEGAL_DOCUMENT_COUNT} documents
            </span>
            <span className="nwlg-stat">
              <span className="nwlg-dot" />
              {LEGAL_SECTIONS.length} sections
            </span>
            <span className="nwlg-stat">
              <span className="nwlg-dot nwlg-dot--ok" />
              {LEGAL_REGULATOR_LINE}
            </span>
          </div>
        </div>

        <div className="nwlg-quick-card">
          <div className="nwlg-quick-head">
            <span className="nw-mono nwlg-quick-label">Most requested</span>
            <LegalIcon name="compass" size={16} stroke="#C5CAD3" />
          </div>
          <div className="nwlg-quick-list">
            {MOST_REQUESTED.map((doc) => (
              <Link key={doc.slug} className="nwlg-quick" to={legalDocumentHref(doc.slug)}>
                <span className="nwlg-quick-icon">
                  <LegalIcon name="fileText" size={17} />
                </span>
                <span className="nwlg-quick-text">
                  <span className="nwlg-quick-name">{doc.name}</span>
                  <span className="nw-mono nwlg-quick-section">{sectionLabel(doc.section)}</span>
                </span>
                <LegalIcon name="arrowRight" size={16} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
