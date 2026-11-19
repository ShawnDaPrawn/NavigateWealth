/**
 * The article's masthead — the way back to Resources, the topic, the one H1,
 * the standfirst and the by-line table — and the banner picture under it.
 *
 * Everything shown is the article's own data, resolved as the live page
 * resolves it (ArticleModel.ts). Rows the article has no value for are left
 * out: "Updated" appears only when it differs from the publication date, and
 * the view count only once there is one, as on the live page.
 */
import { Link } from 'react-router';
import type { ArticleDisplay } from '../../components/pages/articleDetail/articleTypes';
import { ArticleIcon } from './ArticleIcons';
import { splitTitleAccent, type ArticleFacts } from './ArticleModel';

interface MastheadProps {
  article: ArticleDisplay;
  facts: ArticleFacts;
}

export function ArticleMasthead({ article, facts }: MastheadProps) {
  const { lead, accent } = splitTitleAccent(article.title);
  // The live page shows the subtitle under the title and the excerpt as a
  // lead-in; the board has one standfirst there, so both read there in turn.
  const standfirst = [article.subtitle, article.excerpt].filter(
    (text, i, all): text is string => Boolean(text) && all.indexOf(text) === i,
  );
  const reading = [`${facts.readingTime} min read`, facts.views].filter(Boolean).join(' · ');

  return (
    <header className="nwar-mast">
      <div className="nw-wrap nwar-mast-wrap">
        <nav aria-label="Breadcrumb" className="nwar-crumbs nwar-noprint">
          <Link className="nwar-back" to="/resources">
            <ArticleIcon name="arrowLeft" size={16} />
            Back to Resources
          </Link>
          {facts.category ? (
            <>
              <span aria-hidden="true" className="nwar-crumb-sep">
                /
              </span>
              <span className="nwar-crumb-here">{facts.category}</span>
            </>
          ) : null}
        </nav>
        <div className="nwar-mast-row">
          <div className="nwar-mast-copy">
            {facts.category || article.is_featured ? (
              <p className="nwar-label nw-eyebrow nwar-eyebrow">
                {facts.category}
                {article.is_featured ? <span className="nwar-chip">Featured</span> : null}
              </p>
            ) : null}
            <h1 className="nw-h nwar-h1">
              {lead}
              {accent ? (
                <>
                  {' '}
                  <span className="nwar-accent-l">{accent}</span>
                </>
              ) : null}
            </h1>
            {standfirst.map((text) => (
              <p key={text} className="nwar-standfirst">
                {text}
              </p>
            ))}
          </div>
          <dl className="nwar-meta">
            <div className="nwar-meta-row">
              <dt>By</dt>
              <dd className="nwar-meta-by">{facts.author}</dd>
            </div>
            {facts.published ? (
              <div className="nwar-meta-row">
                <dt>Published</dt>
                <dd className="nw-mono">{facts.published}</dd>
              </div>
            ) : null}
            {facts.updated ? (
              <div className="nwar-meta-row">
                <dt>Updated</dt>
                <dd className="nw-mono">{facts.updated}</dd>
              </div>
            ) : null}
            <div className="nwar-meta-row">
              <dt>Reading time</dt>
              <dd className="nw-mono">{reading}</dd>
            </div>
          </dl>
        </div>
      </div>
    </header>
  );
}

/** The wide picture between the masthead and the article; none, no band. */
export function ArticleBanner({ image, title }: { image: string; title: string }) {
  if (!image) return null;
  return (
    <div className="nwar-banner nwar-noprint">
      <div className="nw-wrap">
        <figure className="nwar-banner-fig">
          <img src={image} alt={title} decoding="async" />
        </figure>
      </div>
    </div>
  );
}
