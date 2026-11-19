/**
 * InsightCards — the featured articles, then the Ask Vasco prompt.
 *
 * The articles are whatever the publications module marks as featured; with
 * none, the cards and their heading are left out and only the prompt shows,
 * so the page never carries an empty "Featured Insights" heading.
 */
import { Link } from 'react-router';
import { ArrowRight, Compass } from 'lucide-react';
import {
  articleImage,
  articlePath,
  type FeaturedArticle,
} from '../../components/shared/useFeaturedArticles';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/home.css';

/** The design has room for three cards; the lead card is the most read. */
const MAX_CARDS = 3;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1 Oct 2026", as the board writes dates (the en-ZA locale would say "01 Sept"). */
function formatCardDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface InsightCardsProps {
  index?: string;
  articles: readonly FeaturedArticle[];
  allLink: { label: string; to: string };
  vascoLink: string;
}

export function InsightCards({ index, articles, allLink, vascoLink }: InsightCardsProps) {
  const shown = articles.slice(0, MAX_CARDS);
  const hasArticles = shown.length > 0 && index !== undefined;

  return (
    <section
      className="nw-sec nw-sec--white"
      aria-labelledby={hasArticles ? 'nwin-title' : 'nwvp-title'}
    >
      <div className="nw-wrap">
        {hasArticles ? (
          <>
            <div className="nw-sec-row">
              <SectionHead
                index={index}
                kicker="Insights"
                title="Featured Insights"
                titleId="nwin-title"
              />
              <Link className="nw-textlink" to={allLink.to}>
                {allLink.label}
                <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </div>
            <ul className="nwin-grid">
              {shown.map((article, i) => (
                <li key={article.id}>
                  <ArticleCard article={article} lead={i === 0} />
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div className="nwvp">
          <div className="nw-grid-bg" aria-hidden="true" />
          <div className="nwvp-intro">
            <span className="nwvp-icon" aria-hidden="true">
              <Compass size={24} strokeWidth={1.75} />
            </span>
            <div>
              <p className="nwvp-l nw-mono">Ask Vasco</p>
              <h2 id="nwvp-title" className="nwvp-t">
                Get answers from our AI financial guide, any time.
              </h2>
            </div>
          </div>
          <Link className="nwvp-in" to={vascoLink}>
            <span>Ask Vasco a question…</span>
            <span className="nwvp-go" aria-hidden="true">
              <ArrowRight size={17} strokeWidth={1.75} />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function ArticleCard({ article, lead }: { article: FeaturedArticle; lead: boolean }) {
  const image = articleImage(article);
  const date = formatCardDate(article.published_at);
  return (
    <Link
      className={lead ? 'nwin-card nwin-card--lead' : 'nwin-card'}
      to={articlePath(article.slug)}
    >
      {image ? (
        <span className="nwin-img">
          <img src={image} alt="" loading="lazy" decoding="async" />
        </span>
      ) : null}
      {lead ? <span className="nw-grid-bg" aria-hidden="true" /> : null}
      {article.category_name || date ? (
        <span className="nwin-meta nw-mono">
          <span className="nwin-cat">{article.category_name}</span>
          {date ? <span>{date}</span> : null}
        </span>
      ) : null}
      <h3 className="nwin-title">{article.title}</h3>
      {article.excerpt ? <span className="nwin-excerpt nw-clamp3">{article.excerpt}</span> : null}
      <span className="nwin-foot">
        <span className="nwin-read nw-mono">
          {article.reading_time_minutes ? `${article.reading_time_minutes} min read` : ''}
        </span>
        <span className="nwin-go" aria-hidden="true">
          Read article
          <ArrowRight size={15} strokeWidth={1.75} />
        </span>
      </span>
    </Link>
  );
}
