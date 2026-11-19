/**
 * LegalLibrary — the hub's documents: the four sections as tabs beside the
 * open section's list, or, while a search is typed, every document that
 * matches.
 *
 * Each tab is one of the live hub's `?section=` values; the page owns which
 * is open and keeps it in the address, so the footer's deep links (Privacy
 * and Data, Legal Notices, Regulatory, Other) open the right one. The tabs
 * follow the WAI-ARIA tabs pattern: one tab stop, arrow keys, Home and End.
 */
import { useRef, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import type { LegalDocumentSection } from '../../shared/legal-documents-registry';
import type { LegalDocumentRegistryEntry } from '../../shared/legal-documents-registry';
import { pad2 } from './format';
import { LegalIcon } from './LegalIcons';
import {
  LEGAL_CONTACT,
  LEGAL_SECTIONS,
  legalDocumentHref,
  sectionDocuments,
  sectionInfo,
  sectionLabel,
  searchSummary,
} from './legalModel';

interface LegalLibraryProps {
  active: LegalDocumentSection;
  onSelect: (key: LegalDocumentSection) => void;
  query: string;
  results: LegalDocumentRegistryEntry[];
  onClear: () => void;
  tabId: (key: LegalDocumentSection) => string;
  panelId: string;
}

export function LegalLibrary({
  active,
  onSelect,
  query,
  results,
  onClear,
  tabId,
  panelId,
}: LegalLibraryProps) {
  const searching = query.trim().length > 0;
  const summary = searching ? searchSummary(query, results.length) : '';

  return (
    <section className="nwlg-library" aria-label="Legal documents">
      <div className="nw-wrap">
        {/* Says what a search found, for screen readers; always present so a
            change is announced. */}
        <p className="nw-sr-only" role="status">
          {summary}
        </p>
        {searching ? (
          <SearchResults summary={summary} results={results} onClear={onClear} />
        ) : (
          <div className="nwlg-browse">
            <SectionTabs active={active} onSelect={onSelect} tabId={tabId} panelId={panelId} />
            <SectionPanel key={active} active={active} tabId={tabId} panelId={panelId} />
          </div>
        )}
      </div>
    </section>
  );
}

function SectionTabs({
  active,
  onSelect,
  tabId,
  panelId,
}: Pick<LegalLibraryProps, 'active' | 'onSelect' | 'tabId' | 'panelId'>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = LEGAL_SECTIONS.length - 1;
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const back = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    const next = forward
      ? (i + 1) % (last + 1)
      : back
        ? (i + last) % (last + 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : -1;
    if (next < 0) return;
    event.preventDefault();
    onSelect(LEGAL_SECTIONS[next].key);
    buttons.current[next]?.focus();
  };

  return (
    <div className="nwlg-rail">
      <p className="nw-mono nw-kicker nwlg-kicker">01 — Sections</p>
      <div className="nwlg-tabs" role="tablist" aria-label="Legal sections">
        {LEGAL_SECTIONS.map((section, i) => {
          const on = section.key === active;
          return (
            <button
              key={section.key}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(section.key)}
              aria-selected={on}
              aria-controls={on ? panelId : undefined}
              tabIndex={on ? 0 : -1}
              className={on ? 'nwlg-tab nwlg-tab--on' : 'nwlg-tab'}
              onClick={() => onSelect(section.key)}
              onKeyDown={(event) => onKeyDown(event, i)}
            >
              <span className="nwlg-tab-icon">
                <LegalIcon name={section.icon} size={17} />
              </span>
              <span className="nwlg-tab-label">
                <span className="nwlg-long">{section.label}</span>
                <span className="nwlg-short">{section.short}</span>
              </span>
              <span className="nw-mono nwlg-hide-md nwlg-tab-count">
                {sectionDocuments(section.key).length}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionPanel({
  active,
  tabId,
  panelId,
}: Pick<LegalLibraryProps, 'active' | 'tabId' | 'panelId'>) {
  const section = sectionInfo(active) ?? LEGAL_SECTIONS[0];
  const docs = sectionDocuments(section.key);

  return (
    <div
      className="nw-in nwlg-panel"
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId(section.key)}
    >
      <div className="nwlg-panel-head">
        <div className="nwlg-panel-copy">
          <h2 className="nwlg-panel-h2">{section.title}</h2>
          <p className="nwlg-panel-desc">{section.description}</p>
        </div>
        <span className="nw-mono nwlg-count">{docs.length} documents</span>
      </div>
      <ul className="nwlg-list">
        {docs.map((doc, i) => (
          <li key={doc.slug}>
            <Link className="nwlg-row" to={legalDocumentHref(doc.slug)}>
              <span className="nw-mono nwlg-row-no" aria-hidden="true">
                {pad2(i + 1)}
              </span>
              <span className="nwlg-row-text">
                <span className="nwlg-row-name">{doc.name}</span>
                <span className="nwlg-row-desc">{doc.description}</span>
              </span>
              <span className="nw-mono nwlg-hide-md nwlg-row-slug" aria-hidden="true">
                /legal/{doc.slug}
              </span>
              <ReadPill />
            </Link>
          </li>
        ))}
      </ul>
      {section.officer ? (
        <div className="nwlg-officer">
          <div>
            <p className="nw-mono nwlg-officer-kicker">{section.officer.kicker}</p>
            <h3 className="nw-h nwlg-officer-h3">{section.officer.title}</h3>
          </div>
          <div className="nwlg-officer-links">
            <a className="nwlg-contact" href={LEGAL_CONTACT.emailHref}>
              <LegalIcon name="mail" size={16} stroke="#0D1626" />
              {LEGAL_CONTACT.email}
            </a>
            <a className="nwlg-contact" href={LEGAL_CONTACT.phoneHref}>
              <LegalIcon name="phone" size={16} stroke="#0D1626" />
              {LEGAL_CONTACT.phone}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReadPill() {
  return (
    <span className="nwlg-read" aria-hidden="true">
      <LegalIcon name="eye" size={15} />
      <span className="nwlg-hide-md">Read</span>
    </span>
  );
}

function SearchResults({
  summary,
  results,
  onClear,
}: {
  summary: string;
  results: LegalDocumentRegistryEntry[];
  onClear: () => void;
}) {
  return (
    <div>
      <div className="nwlg-results-head">
        <p className="nwlg-results-summary">{summary}</p>
        <button type="button" className="nwlg-clear nwlg-clear--tall" onClick={onClear}>
          Clear search
        </button>
      </div>
      {results.length > 0 ? (
        <ul className="nw-in nwlg-results">
          {results.map((doc) => (
            <li key={doc.slug}>
              <Link className="nwlg-row" to={legalDocumentHref(doc.slug)}>
                <span className="nwlg-row-text">
                  <span className="nw-mono nwlg-row-section">{sectionLabel(doc.section)}</span>
                  <span className="nwlg-row-name nwlg-row-name--sub">{doc.name}</span>
                  <span className="nwlg-row-desc">{doc.description}</span>
                </span>
                <ReadPill />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="nwlg-none">
          <LegalIcon name="search" size={40} stroke="#C5CAD3" className="nwlg-none-icon" />
          <p className="nw-h nwlg-none-title">No matching documents</p>
          <p className="nwlg-none-copy">
            Try a different keyword, or{' '}
            <button type="button" className="nwlg-clear" onClick={onClear}>
              clear your search
            </button>{' '}
            to browse every section.
          </p>
        </div>
      )}
    </div>
  );
}
