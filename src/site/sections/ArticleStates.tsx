/**
 * The two states the board does not draw but the live page has
 * (articleDetail/ArticleStates.tsx), in the board's language: the article
 * loading, and an article that cannot be shown.
 *
 * The not-found state keeps the live page's wording and actions — "Article
 * Not Found", the message the request failed with, Back to Resources and
 * Retry — and, like the live page, marks the page noindex, nofollow so an
 * unknown slug is never indexed.
 */
import { useEffect } from 'react';
import { Link } from 'react-router';
import { ArticleIcon } from './ArticleIcons';

export function ArticleLoading() {
  return (
    <div className="nwar-loading" aria-busy="true">
      <p className="nw-sr-only" role="status">
        Loading article…
      </p>
      <div className="nwar-mast" aria-hidden="true">
        <div className="nw-wrap nwar-mast-wrap">
          <span className="nwar-skel nwar-skel-line" style={{ width: 150, marginTop: 17 }} />
          <div className="nwar-mast-row">
            <div className="nwar-mast-copy">
              <span className="nwar-skel nwar-skel-line" style={{ width: 180 }} />
              <span className="nwar-skel nwar-skel-h1" style={{ width: '85%' }} />
              <span className="nwar-skel nwar-skel-h1" style={{ width: '55%' }} />
              <span className="nwar-skel nwar-skel-title" style={{ width: '70%', marginTop: 26 }} />
            </div>
            <div className="nwar-meta nwar-meta--skel">
              {[0, 1, 2].map((i) => (
                <span key={i} className="nwar-skel nwar-skel-line" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="nwar-banner" aria-hidden="true">
        <div className="nw-wrap">
          <div className="nwar-banner-fig nwar-skel" />
        </div>
      </div>
      <div className="nwar-body" aria-hidden="true">
        <div className="nw-wrap nwar-body-wrap">
          <div className="nwar-skel-prose">
            {['100%', '94%', '97%', '60%'].map((w, i) => (
              <span key={i} className="nwar-skel nwar-skel-line" style={{ width: w }} />
            ))}
            <span className="nwar-skel nwar-skel-title" style={{ width: '40%', marginTop: 36 }} />
            {['100%', '92%', '80%'].map((w, i) => (
              <span key={i} className="nwar-skel nwar-skel-line" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArticleNotFound({ message, onRetry }: { message: string; onRetry?: () => void }) {
  useEffect(() => {
    let el = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      document.head.appendChild(el);
    }
    el.setAttribute('content', 'noindex, nofollow');
  }, []);

  return (
    <div className="nwar-missing">
      <div className="nw-wrap">
        <div className="nwar-missing-body">
          <p className="nwar-label nw-eyebrow nwar-eyebrow">Resources</p>
          <h1 className="nw-h nwar-missing-h">
            Article <span className="nwar-accent-l">Not Found</span>
          </h1>
          <p className="nwar-standfirst nwar-missing-p">{message}</p>
          <div className="nwar-missing-actions">
            <Link className="nw-btn nwar-missing-btn" to="/resources">
              <ArticleIcon name="arrowLeft" size={16} />
              Back to Resources
            </Link>
            {onRetry ? (
              <button type="button" className="nw-outline nwar-missing-btn" onClick={onRetry}>
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
