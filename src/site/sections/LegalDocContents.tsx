/**
 * LegalDocContents — a legal document's "On this page" list: in a sticky
 * sidebar on laptops, with the reading details under it, and folded above
 * the text below that. The entries are the live page's (the document's own
 * contents, or its headings), and following one is the live page's jump.
 */
import { useId, type MouseEvent } from 'react';
import { LegalIcon } from './LegalIcons';

export interface LegalTocEntry {
  id: string;
  title: string;
  /** Shown as a subsection (indented). */
  sub: boolean;
}

interface TocListProps {
  entries: LegalTocEntry[];
  activeId: string | null;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, id: string) => void;
}

function TocLinks({ entries, activeId, onNavigate }: TocListProps) {
  return (
    <>
      {entries.map((entry) => {
        const on = entry.id === activeId;
        const className = [
          'nwld-toc-link',
          on ? 'nwld-toc-on' : '',
          entry.sub ? 'nwld-toc-sub' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <a
            key={entry.id}
            href={`#${entry.id}`}
            className={className}
            aria-current={on ? 'location' : undefined}
            onClick={(event) => onNavigate(event, entry.id)}
          >
            {entry.title}
          </a>
        );
      })}
    </>
  );
}

interface LegalDocAsideProps extends TocListProps {
  sectionLabel: string;
  version: string;
  effective: string;
}

export function LegalDocAside({
  entries,
  activeId,
  onNavigate,
  sectionLabel,
  version,
  effective,
}: LegalDocAsideProps) {
  return (
    <aside className="nwld-aside">
      {entries.length > 0 ? (
        <nav aria-label="On this page" className="nwld-toc-card">
          <div className="nwld-toc-head">
            <div className="nwld-toc-title">
              <LegalIcon name="list" size={16} stroke="#0D1626" />
              On this page
            </div>
            <p className="nwld-toc-sub-copy">Jump to the sections most relevant to you.</p>
          </div>
          <div className="nwld-toc nwld-toc--aside">
            <TocLinks entries={entries} activeId={activeId} onNavigate={onNavigate} />
          </div>
        </nav>
      ) : null}
      <div className="nwld-details">
        <p className="nw-mono nwld-details-label">Reading details</p>
        <ul className="nwld-details-list">
          <li>
            Section: <span className="nwld-details-v">{sectionLabel}</span>
          </li>
          <li>
            Version: <span className="nwld-details-v">{version}</span>
          </li>
          <li>
            Effective: <span className="nwld-details-v">{effective}</span>
          </li>
        </ul>
      </div>
    </aside>
  );
}

interface LegalDocMobileTocProps extends TocListProps {
  open: boolean;
  onToggle: () => void;
}

export function LegalDocMobileToc({
  entries,
  activeId,
  onNavigate,
  open,
  onToggle,
}: LegalDocMobileTocProps) {
  const listId = useId();
  if (entries.length === 0) return null;
  return (
    <div className="nwld-mobile-toc">
      <button
        type="button"
        className="nwld-tocbtn"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={onToggle}
      >
        <span className="nwld-tocbtn-label">
          <LegalIcon name="list" size={16} stroke="#0D1626" />
          On this page
        </span>
        <span className="nwld-tocbtn-meta">
          <span className="nw-mono nwld-tocbtn-count">
            {entries.length} {entries.length === 1 ? 'section' : 'sections'}
          </span>
          <LegalIcon
            name="chevronDown"
            size={16}
            stroke="#5E6676"
            className={open ? 'nwld-chev nwld-chev--open' : 'nwld-chev'}
          />
        </span>
      </button>
      {open ? (
        <nav id={listId} aria-label="On this page" className="nwld-toc nwld-toc--folded nwld-pop">
          <TocLinks entries={entries} activeId={activeId} onNavigate={onNavigate} />
        </nav>
      ) : null}
    </div>
  );
}
