/**
 * ResourcesHero — the Resources page's heading and its search.
 *
 * The search is the live page's: articles by title, excerpt and topic, plus
 * whatever market news has been fetched, typed into a box that waits 300 ms
 * before searching and keeps the query in `?q=` (the page owns that state).
 * Results open below the box; picking one clears the search, as on the live
 * page. A polite live region says how many matched.
 */
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Link } from 'react-router';
import type { SearchResult } from './resourcesModel';
import { ResourcesIcon } from './ResourcesIcons';

/** Suggestions offered when a search finds nothing (the board's four). */
const TRY_TERMS = ['Retirement', 'SARS', 'Offshore', 'Medical scheme'];

interface ResourcesHeroProps {
  query: string;
  /** True while the box waits out its debounce. */
  pending: boolean;
  results: SearchResult[];
  articleCount: number;
  onQueryChange: (value: string) => void;
  onPickTerm: (value: string) => void;
  onClear: () => void;
}

export function ResourcesHero({
  query,
  pending,
  results,
  articleCount,
  onQueryChange,
  onPickTerm,
  onClear,
}: ResourcesHeroProps) {
  const hasQuery = query.trim().length > 0;
  const showResults = hasQuery && results.length > 0;
  const showNone = hasQuery && !pending && results.length === 0;
  const label = results.length
    ? `Top ${results.length} match${results.length === 1 ? '' : 'es'}`
    : pending
      ? 'Searching…'
      : 'Search';
  const announcement = !hasQuery
    ? ''
    : pending
      ? ''
      : results.length
        ? `${results.length} match${results.length === 1 ? '' : 'es'}`
        : 'No results found';

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && query) {
      event.preventDefault();
      onClear();
    }
  };

  return (
    <section className="nwrs-hero" aria-label="Hero">
      <div className="nwrs-hero-bg" aria-hidden="true">
        <div className="nw-grid-bg" />
      </div>
      <div className="nw-wrap nwrs-rhero">
        <div className="nwrs-hero-copy">
          <p className="nw-eyebrow nwrs-hero-eyebrow">Resource Center</p>
          <h1 className="nwrs-h1">
            <span className="nwrs-only-lg">Financial Insights &amp; </span>
            <span className="nwrs-only-sm">Insights &amp; </span>
            <span className="nw-accent">
              <span className="nwrs-only-lg">Market Intelligence</span>
              <span className="nwrs-only-sm">Education</span>
            </span>
          </h1>
          <p className="nwrs-hero-lead">
            <span className="nwrs-only-lg">
              Stay ahead with real-time market data, expert analysis, and comprehensive educational
              resources for your financial journey.
            </span>
            <span className="nwrs-only-sm">
              Expert articles and educational resources to help you make informed financial
              decisions.
            </span>
          </p>
        </div>

        <div className="nwrs-searchwrap">
          <div className="nwrs-search">
            <ResourcesIcon name="search" size={19} stroke="#C5CAD3" className="nwrs-search-icon" />
            <input
              type="search"
              className="nwrs-search-input"
              aria-label="Search articles"
              placeholder={
                articleCount > 0 ? `Search ${articleCount} articles…` : 'Search articles…'
              }
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
              onKeyDown={onKeyDown}
            />
            {hasQuery ? (
              <button
                type="button"
                className="nwrs-iconbtn"
                aria-label="Clear search"
                onClick={onClear}
              >
                <ResourcesIcon name="close" size={17} />
              </button>
            ) : null}
          </div>
          <p className="nw-sr-only" role="status">
            {announcement}
          </p>
          {hasQuery ? (
            <div className="nwrs-results nw-in">
              <div className="nwrs-results-head">
                <span className="nwrs-label nwrs-results-label">{label}</span>
              </div>
              {showResults ? (
                <div className="nwrs-results-list">
                  {results.map((r) =>
                    r.external ? (
                      <a
                        key={r.key}
                        className="nwrs-result"
                        href={r.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onClear}
                      >
                        <ResultBody result={r} />
                        <span className="nw-sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <Link key={r.key} className="nwrs-result" to={r.href} onClick={onClear}>
                        <ResultBody result={r} />
                      </Link>
                    ),
                  )}
                </div>
              ) : null}
              {showNone ? (
                <div className="nwrs-noresults">
                  <p className="nw-h nwrs-noresults-t">No results found</p>
                  <p className="nwrs-noresults-p">Try a broader term, or one of these:</p>
                  <div className="nwrs-tryterms">
                    {TRY_TERMS.map((term) => (
                      <button
                        key={term}
                        type="button"
                        className="nwrs-pill nwrs-pill--sm"
                        onClick={() => onPickTerm(term)}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ResultBody({ result }: { result: SearchResult }) {
  return (
    <>
      <span className="nwrs-rthumb">
        {result.image ? <img src={result.image} alt="" loading="lazy" decoding="async" /> : null}
      </span>
      <span className="nwrs-rtext">
        <span className="nwrs-label nwrs-rcat">{result.category}</span>
        <span className="nw-h nwrs-rt nwrs-clamp2">{result.title}</span>
      </span>
    </>
  );
}
