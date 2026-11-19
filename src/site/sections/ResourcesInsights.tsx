/**
 * ResourcesInsights — the "Insights & Education" section: the editors'
 * featured articles, the article library with its topic filter, and the
 * newsletter band.
 *
 * Everything shown is the publications module's data, read through the live
 * page's hooks: the featured set is the articles marked `is_featured`, the
 * topics are the active categories, every count is counted. The library loads
 * nine cards at a time, newest first, and a topic change starts again from
 * the top, as the board's "Load more" does.
 */
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import type { Article } from '../../components/admin/modules/publications';
import {
  ALL_CATEGORY_ID,
  LIBRARY_PAGE_SIZE,
  articleCategoryName,
  articleHref,
  cardImage,
  formatCardDate,
  heroImage,
  type TopicFilter,
} from './resourcesModel';
import { ResourcesIcon } from './ResourcesIcons';
import { ResourcesSignup, type NewsletterSignup } from './ResourcesSignup';

interface ResourcesInsightsProps {
  loading: boolean;
  featured: Article[];
  topics: TopicFilter[];
  byTopic: Record<string, Article[]>;
  /** Every published article, for the "All" heading's count. */
  total: number;
  signup: NewsletterSignup;
  onReadPastIssues: () => void;
}

export function ResourcesInsights({
  loading,
  featured,
  topics,
  byTopic,
  total,
  signup,
  onReadPastIssues,
}: ResourcesInsightsProps) {
  return (
    <div className="nw-in">
      {loading || featured.length > 0 ? (
        <FeaturedInsights loading={loading} articles={featured} />
      ) : null}
      <ArticleLibrary loading={loading} topics={topics} byTopic={byTopic} total={total} />
      <section className="nwrs-nlsec" aria-label="Newsletter">
        <div className="nw-wrap">
          <div className="nwrs-nlband">
            <div className="nwrs-nlcopy">
              <p className="nw-eyebrow nwrs-eyebrow">Monthly briefing</p>
              <h2 className="nwrs-h2s">
                The Wealth <span className="nwrs-accent-l">Compass</span>
              </h2>
              <p className="nwrs-nltext">
                Get the latest market insights and financial tips delivered to your inbox.{' '}
                <button type="button" className="nwrs-textbtn" onClick={onReadPastIssues}>
                  Read past issues
                </button>
              </p>
            </div>
            <div className="nwrs-nlside">
              <ResourcesSignup variant="band" signup={signup} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeaturedInsights({ loading, articles }: { loading: boolean; articles: Article[] }) {
  const [lead, ...side] = articles;
  return (
    <section className="nwrs-featured" aria-labelledby="nwrs-featured" aria-busy={loading}>
      <div className="nw-wrap">
        <p className="nw-eyebrow nwrs-eyebrow">Editor&apos;s selection</p>
        <h2 id="nwrs-featured" className="nwrs-h2">
          Featured insights
        </h2>
        <div className="nwrs-feat">
          {loading || !lead ? (
            <>
              <div className="nwrs-flead" aria-hidden="true">
                <span className="nwrs-media nwrs-flead-img nwrs-skel" />
                <span
                  className="nwrs-skel nwrs-skel-line"
                  style={{ marginTop: 22, width: '30%' }}
                />
                <span className="nwrs-skel nwrs-skel-title" style={{ width: '80%' }} />
                <span
                  className="nwrs-skel nwrs-skel-line"
                  style={{ marginTop: 16, width: '92%' }}
                />
              </div>
              <div className="nwrs-fside" aria-hidden="true">
                {[0, 1].map((i) => (
                  <div key={i} className="nwrs-si">
                    <span className="nwrs-media nwrs-si-img nwrs-skel" />
                    <span className="nwrs-si-body">
                      <span className="nwrs-skel nwrs-skel-line" style={{ width: '45%' }} />
                      <span className="nwrs-skel nwrs-skel-line" style={{ width: '85%' }} />
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <Link className="nwrs-story nwrs-flead" to={articleHref(lead)}>
                <span className="nwrs-media nwrs-flead-img">
                  <Picture src={heroImage(lead)} eager />
                </span>
                <Meta article={lead} withDate className="nwrs-flead-meta" />
                <h3 className="nw-h nwrs-st nwrs-flead-t">{lead.title}</h3>
                {lead.excerpt ? (
                  <span className="nwrs-clamp3 nwrs-flead-ex">{lead.excerpt}</span>
                ) : null}
                <span className="nwrs-flead-go">
                  Read article <ResourcesIcon name="arrowRight" className="nwrs-arrow" />
                  {lead.reading_time_minutes ? (
                    <span className="nw-mono nwrs-flead-mins">
                      {lead.reading_time_minutes} min read
                    </span>
                  ) : null}
                </span>
              </Link>
              {side.length > 0 ? (
                <div className="nwrs-fside">
                  {side.map((article) => (
                    <Link
                      key={article.id || article.slug}
                      className="nwrs-story nwrs-si"
                      to={articleHref(article)}
                    >
                      <span className="nwrs-media nwrs-si-img">
                        <Picture src={cardImage(article)} />
                      </span>
                      <div className="nwrs-si-body">
                        <Meta article={article} withDate />
                        <h3 className="nw-h nwrs-st nwrs-clamp3 nwrs-si-t">{article.title}</h3>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Picture({ src, eager }: { src: string; eager?: boolean }) {
  if (!src) {
    return (
      <span className="nwrs-noimg" aria-hidden="true">
        <ResourcesIcon name="compass" size={44} />
      </span>
    );
  }
  return <img src={src} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}

function Meta({
  article,
  withDate,
  className,
}: {
  article: Article;
  withDate?: boolean;
  className?: string;
}) {
  const category = articleCategoryName(article);
  const date = withDate ? formatCardDate(article.published_at || article.created_at) : '';
  return (
    <span className={className ? `nwrs-meta ${className}` : 'nwrs-meta'}>
      {category}
      {category && date ? <i aria-hidden="true" /> : null}
      {date}
    </span>
  );
}

function ArticleLibrary({
  loading,
  topics,
  byTopic,
  total,
}: {
  loading: boolean;
  topics: TopicFilter[];
  byTopic: Record<string, Article[]>;
  total: number;
}) {
  const [topicId, setTopicId] = useState(ALL_CATEGORY_ID);
  const [shownCount, setShownCount] = useState(LIBRARY_PAGE_SIZE);
  const grid = useRef<HTMLDivElement>(null);
  const focusFrom = useRef<number | null>(null);

  // A topic that disappears from the data falls back to "All".
  const topic = topics.find((t) => t.id === topicId) ?? topics[0];
  const activeId = topic?.id ?? ALL_CATEGORY_ID;
  const list = byTopic[activeId] ?? [];
  const shown = list.slice(0, shownCount);
  const isAll = activeId === ALL_CATEGORY_ID;
  const topicCount = topics.length > 0 ? topics.length - 1 : 0;

  const heading = isAll ? 'All articles' : topic.name;
  const sub = loading
    ? 'Loading articles…'
    : isAll
      ? `${total} ${total === 1 ? 'article' : 'articles'} across ${topicCount} ${topicCount === 1 ? 'topic' : 'topics'}, newest first`
      : `${list.length} ${list.length === 1 ? 'article' : 'articles'} · newest first`;

  const pick = (id: string) => {
    setTopicId(id);
    setShownCount(LIBRARY_PAGE_SIZE);
  };

  const loadMore = () => {
    focusFrom.current = shown.length;
    setShownCount((n) => n + LIBRARY_PAGE_SIZE);
  };

  // After "Load more", keyboard focus moves to the first new article.
  useEffect(() => {
    if (focusFrom.current === null) return;
    const cards = grid.current?.querySelectorAll<HTMLAnchorElement>('a');
    cards?.[focusFrom.current]?.focus();
    focusFrom.current = null;
  }, [shownCount]);

  return (
    <section
      id="articles"
      className="nwrs-library"
      aria-labelledby="nwrs-latest"
      aria-busy={loading}
    >
      <div className="nw-wrap">
        <div className="nwrs-libhead">
          <div>
            <p className="nw-eyebrow nwrs-eyebrow">The library</p>
            <h2 id="nwrs-latest" className="nwrs-h2">
              {heading}
            </h2>
            <p className="nwrs-libsub" role="status">
              {sub}
            </p>
          </div>
          {topics.length > 0 ? (
            <label className="nwrs-catsel">
              <span className="nwrs-label nwrs-catsel-l">Topic</span>
              <select
                aria-label="Filter articles by topic"
                value={activeId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => pick(e.target.value)}
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id === ALL_CATEGORY_ID ? 'All topics' : t.name}
                  </option>
                ))}
              </select>
              <ResourcesIcon name="chevronDown" size={16} />
            </label>
          ) : null}
        </div>

        {topics.length > 0 ? (
          <div className="nwrs-catrow" role="group" aria-label="Filter articles by topic">
            {topics.map((t) => (
              <button
                key={t.id}
                type="button"
                className="nwrs-pill"
                aria-pressed={t.id === activeId}
                onClick={() => pick(t.id)}
              >
                {t.id === ALL_CATEGORY_ID ? 'All topics' : t.name}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="nwrs-agrid" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="nwrs-acard">
                <span className="nwrs-acard-img nwrs-skel" />
                <span className="nwrs-acard-body">
                  <span className="nwrs-skel nwrs-skel-line" style={{ width: '35%' }} />
                  <span className="nwrs-skel nwrs-skel-title" style={{ width: '90%' }} />
                  <span className="nwrs-skel nwrs-skel-line" style={{ width: '60%' }} />
                </span>
              </div>
            ))}
          </div>
        ) : list.length > 0 ? (
          <>
            <div className="nwrs-agrid" ref={grid}>
              {shown.map((article) => (
                <ArticleCard key={article.id || article.slug} article={article} />
              ))}
            </div>
            <div className="nwrs-more">
              <span className="nw-mono nwrs-showing">
                Showing {shown.length} of {list.length}
              </span>
              {shown.length < list.length ? (
                <button type="button" className="nw-outline nwrs-more-btn" onClick={loadMore}>
                  Load more articles
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="nwrs-empty">
            <p className="nw-h nwrs-empty-t">No Articles Yet</p>
            <p className="nwrs-empty-p">
              We&apos;re currently curating expert content for this category. Check back soon for
              detailed guides and analysis.
            </p>
            {!isAll && topics.length > 0 ? (
              <button
                type="button"
                className="nw-outline nwrs-more-btn nwrs-empty-btn"
                onClick={() => pick(ALL_CATEGORY_ID)}
              >
                Browse All Articles
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const image = cardImage(article);
  const category = articleCategoryName(article);
  const date = formatCardDate(article.published_at || article.created_at);
  const minutes = article.reading_time_minutes ? `${article.reading_time_minutes} min read` : '';
  return (
    <Link className="nwrs-story nwrs-acard nw-in" to={articleHref(article)}>
      <span className="nwrs-acard-img">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="nwrs-noimg" aria-hidden="true">
            <ResourcesIcon name="compass" size={44} />
            {category ? <span className="nwrs-label nwrs-noimg-l">{category}</span> : null}
          </span>
        )}
      </span>
      <div className="nwrs-acard-body">
        {category ? <span className="nwrs-meta">{category}</span> : null}
        <h3 className="nw-h nwrs-st nwrs-clamp3 nwrs-acard-t">{article.title}</h3>
        {article.excerpt || article.subtitle ? (
          <span className="nwrs-clamp2 nwrs-acard-ex">{article.excerpt || article.subtitle}</span>
        ) : null}
        <span className="nw-mono nwrs-acard-meta">
          {[date, minutes].filter(Boolean).join(' · ')}
        </span>
      </div>
    </Link>
  );
}
