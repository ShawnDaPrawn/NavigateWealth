/**
 * "Featured Insights" — published articles marked as featured, most-read
 * first, fetched through the same client as the live page
 * (fetchFeaturedArticles). While they load, quiet placeholders hold the
 * space; if there are none, the cards are simply left out and the section
 * keeps its link to all insights and the Ask Vasco prompt.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Compass } from 'lucide-react';
import {
  articlePath,
  fetchFeaturedArticles,
  formatArticleDate,
  resolveArticleImage,
  type FeaturedArticle,
} from '../../components/shared/featuredArticles';
import { NwImage } from '../components/NwImage';
import { SectionHead } from '../sections/SectionHead';
import { CardLink } from './HomeParts';
import { INSIGHTS_PATH } from './homeContent';

type Status = 'loading' | 'ready' | 'none';

function InsightCard({ article, lead }: { article: FeaturedArticle; lead: boolean }) {
  const image = resolveArticleImage(article);
  const date = formatArticleDate(article.published_at);
  return (
    <li className={lead ? 'nwhm-ins nwhm-ins--lead' : 'nwhm-ins'}>
      {image ? (
        <span className="nwhm-ins-img">
          <NwImage
            src={image}
            alt=""
            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 420px"
          />
        </span>
      ) : null}
      {lead ? <span className="nw-grid-bg" aria-hidden="true" /> : null}
      <span className="nwhm-ins-meta nw-mono">
        <span>{article.category_name ?? 'Insight'}</span>
        {date ? <time dateTime={article.published_at}>{date}</time> : null}
      </span>
      <h3 className="nwhm-ins-t">
        <CardLink to={articlePath(article.slug)}>{article.title}</CardLink>
      </h3>
      {article.excerpt ? <p className="nwhm-ins-d">{article.excerpt}</p> : null}
      <span className="nwhm-ins-foot">
        <span className="nw-mono">
          {article.reading_time_minutes ? `${article.reading_time_minutes} min read` : ''}
        </span>
        <span className="nwhm-ins-go" aria-hidden="true">
          Read article
          <ArrowRight size={15} strokeWidth={1.75} />
        </span>
      </span>
    </li>
  );
}

export function HomeInsights({ index }: { index: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [articles, setArticles] = useState<FeaturedArticle[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchFeaturedArticles()
      .then((list) => {
        if (cancelled) return;
        setArticles(list);
        setStatus(list.length > 0 ? 'ready' : 'none');
      })
      .catch(() => {
        if (!cancelled) setStatus('none');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      id="insights"
      className="nw-sec nw-sec--white"
      aria-labelledby="nwhm-ins-title"
      aria-busy={status === 'loading'}
    >
      <div className="nw-wrap">
        <div className="nwhm-head-row">
          <SectionHead
            index={index}
            kicker="Insights"
            title="Featured Insights"
            titleId="nwhm-ins-title"
            lead="Perspectives on wealth management, tax planning, and financial strategy from Navigate Wealth."
          />
          <Link className="nwhm-textlink" to={INSIGHTS_PATH}>
            View all insights
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>

        {status === 'loading' ? (
          <ul className="nwhm-ins-grid" aria-hidden="true">
            {[0, 1, 2].map((n) => (
              <li key={n} className="nwhm-ins nwhm-ins--ghost">
                <span className="nwhm-ghost nwhm-ghost--img" />
                <span className="nwhm-ghost nwhm-ghost--line" />
                <span className="nwhm-ghost nwhm-ghost--title" />
                <span className="nwhm-ghost nwhm-ghost--line" />
              </li>
            ))}
          </ul>
        ) : null}
        {status === 'ready' ? (
          <ul className="nwhm-ins-grid" data-count={articles.length}>
            {articles.map((article, i) => (
              <InsightCard key={article.id} article={article} lead={i === 0} />
            ))}
          </ul>
        ) : null}

        <div className="nwhm-vasco">
          <div className="nw-grid-bg" aria-hidden="true" />
          <div className="nwhm-vasco-copy">
            <span className="nwhm-vasco-i" aria-hidden="true">
              <Compass size={24} strokeWidth={1.75} />
            </span>
            <div>
              <p className="nwhm-vasco-k nw-mono">Ask Vasco</p>
              <p className="nwhm-vasco-t">Get answers from our AI financial navigator, any time.</p>
            </div>
          </div>
          <Link className="nwhm-vasco-in" to="/ask-vasco">
            <span>Ask Vasco a question…</span>
            <span className="nwhm-vasco-go" aria-hidden="true">
              <ArrowRight size={17} strokeWidth={1.75} />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
