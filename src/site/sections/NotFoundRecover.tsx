/**
 * NotFoundRecover — "Where were you headed?": a search over the site's main
 * pages (the six popular ones as chips until something is typed, then the six
 * best matches), three cards to the legal pages, WhatsApp and the resources,
 * and a last line to the contact page.
 */
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { SectionHead } from './SectionHead';
import { NotFoundIcon, type NotFoundIconName } from './NotFoundIcons';
import '../styles/sections.css';
import '../styles/not-found.css';

export interface NotFoundDestination {
  title: string;
  path: string;
  description: string;
}

export interface NotFoundCard {
  title: string;
  description: string;
  icon: NotFoundIconName;
  /** A route of the site, or an external address (opened in a new tab). */
  href: string;
}

interface NotFoundRecoverProps {
  pages: NotFoundDestination[];
  popular: NotFoundDestination[];
  cards: NotFoundCard[];
}

const MAX_RESULTS = 6;

export function NotFoundRecover({ pages, popular, cards }: NotFoundRecoverProps) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim().toLowerCase();
  const searching = term.length > 0;
  const results = searching
    ? pages
        .filter(
          (p) =>
            p.title.toLowerCase().includes(term) ||
            p.description.toLowerCase().includes(term) ||
            p.path.includes(term),
        )
        .slice(0, MAX_RESULTS)
    : [];
  const resultLabel = results.length
    ? `Best matches for “${query.trim()}”`
    : `No pages match “${query.trim()}”.`;

  return (
    <section className="nwnf-recover">
      <div className="nw-wrap nwnf-recover-wrap">
        <SectionHead
          kicker="Recalculate your route"
          title="Where were you headed?"
          center
          className="nwnf-head"
        />

        <div className="nwnf-search">
          <label htmlFor={inputId} className="nw-sr-only">
            Search pages
          </label>
          <NotFoundIcon name="search" size={18} stroke="#9AA3B2" className="nwnf-search-ic" />
          <input
            ref={inputRef}
            id={inputId}
            className="nwnf-search-input"
            type="search"
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            placeholder="Search pages — e.g. retirement, quote, login…"
          />
        </div>

        <p className="nw-sr-only" role="status">
          {searching ? resultLabel : ''}
        </p>

        {searching ? (
          <div className="nwnf-results">
            <p className="nwnf-results-label">{resultLabel}</p>
            {results.length > 0 ? (
              <ul className="nwnf-dests">
                {results.map((r) => (
                  <li key={r.path}>
                    <Link className="nwnf-dest" to={r.path}>
                      <span className="nwnf-dest-copy">
                        <span className="nwnf-dest-t">{r.title}</span>
                        <span className="nwnf-dest-d">{r.description}</span>
                      </span>
                      <code className="nw-mono nwnf-dest-path">{r.path}</code>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nwnf-none">
                Nothing matches that yet.{' '}
                <button
                  type="button"
                  className="nwnf-clear"
                  onClick={() => {
                    setQuery('');
                    // The button goes with the message; keep focus in the search.
                    inputRef.current?.focus();
                  }}
                >
                  Clear search
                </button>{' '}
                or{' '}
                <Link className="nwnf-text-link nwnf-text-link--underline" to="/sitemap">
                  open the sitemap
                </Link>
                .
              </p>
            )}
          </div>
        ) : (
          <div className="nwnf-popular">
            <span className="nw-mono nwnf-popular-l">Popular:</span>
            {popular.map((p) => (
              <Link key={p.path} className="nwnf-chip" to={p.path}>
                {p.title}
              </Link>
            ))}
          </div>
        )}

        <div className="nwnf-cards">
          {cards.map((card) => {
            const body = (
              <>
                <span className="nwnf-card-id">
                  <span className="nwnf-card-ic">
                    <NotFoundIcon name={card.icon} size={20} />
                  </span>
                  <span className="nwnf-card-copy">
                    <span className="nw-h nwnf-card-t">{card.title}</span>
                    <span className="nwnf-card-d">{card.description}</span>
                  </span>
                </span>
                <NotFoundIcon
                  name="arrowRight"
                  size={20}
                  stroke="#9AA3B2"
                  className="nwnf-card-go"
                />
              </>
            );
            return card.href.startsWith('/') ? (
              <Link key={card.title} className="nwnf-card" to={card.href}>
                {body}
              </Link>
            ) : (
              <a
                key={card.title}
                className="nwnf-card"
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {body}
              </a>
            );
          })}
        </div>

        <p className="nwnf-help">
          Still need help? We are here to assist you.{' '}
          <Link className="nwnf-text-link" to="/contact">
            Contact us
          </Link>
        </p>
      </div>
    </section>
  );
}
