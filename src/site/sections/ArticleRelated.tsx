/**
 * "Continue Reading" — up to three more published articles from the same
 * category, newest first, then the way back to everything.
 *
 * The request is the live page's (RelatedArticles.tsx): published articles in
 * the article's category, one more than are shown so the current one can be
 * dropped, no retry. It goes through the shared API client, which sends no
 * Authorization header to this public route when nobody is signed in, rather
 * than the anon key the live component sends. With no category, or nothing
 * else in it, or a failed request, the heading and cards are left out and
 * only "Explore More Insights" remains, as on the live page.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../../utils/api/client';
import { formatCardDate } from './format';
import { ArticleIcon } from './ArticleIcons';

const RELATED_LIMIT = 3;

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  thumbnail_image_url?: string;
  hero_image_url?: string;
  featured_image_url?: string;
  feature_image_url?: string;
  reading_time_minutes?: number;
  published_at?: string;
  category_name?: string;
  category?: { name?: string };
}

function useRelatedArticles(articleId: string, categoryId: string | undefined) {
  return useQuery({
    queryKey: ['navigator-article', 'related', categoryId, articleId],
    enabled: Boolean(categoryId),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const response = await api.get<{ data?: RelatedArticle[] }>(
        `/publications/articles?status=published&category_id=${categoryId}&limit=${RELATED_LIMIT + 1}`,
        { retryTransientFailures: false },
      );
      return (response?.data || [])
        .filter((article) => article.id !== articleId)
        .slice(0, RELATED_LIMIT);
    },
  });
}

export function ArticleRelated({
  articleId,
  categoryId,
}: {
  articleId: string;
  categoryId?: string;
}) {
  const { data = [], isLoading } = useRelatedArticles(articleId, categoryId);
  const shown = isLoading || data.length > 0;

  return (
    <section
      className="nwar-related nwar-noprint"
      aria-labelledby={shown ? 'nwar-related-title' : undefined}
      aria-busy={isLoading || undefined}
    >
      <div className="nw-wrap">
        {shown ? (
          <>
            <div className="nwar-related-head">
              <h2 id="nwar-related-title" className="nw-h nwar-related-h">
                Continue <span className="nwar-accent-l">Reading</span>
              </h2>
              <Link className="nwar-textlink" to="/resources">
                View all articles
                <ArticleIcon name="arrowRight" size={15} />
              </Link>
            </div>
            <ul className="nwar-related-grid">
              {isLoading
                ? [0, 1, 2].map((i) => (
                    <li key={i} className="nwar-story nwar-story--skel" aria-hidden="true">
                      <span className="nwar-relimg nwar-skel" />
                      <span className="nwar-skel nwar-skel-line" style={{ width: '40%' }} />
                      <span className="nwar-skel nwar-skel-title" style={{ width: '90%' }} />
                      <span className="nwar-skel nwar-skel-line" style={{ width: '70%' }} />
                    </li>
                  ))
                : data.map((article) => (
                    <li key={article.id}>
                      <RelatedCard article={article} />
                    </li>
                  ))}
            </ul>
          </>
        ) : null}
        <div className={shown ? 'nwar-more' : 'nwar-more nwar-more--alone'}>
          <Link className="nw-outline nwar-more-btn" to="/resources">
            <ArticleIcon name="bookOpen" size={16} />
            Explore More Insights
          </Link>
        </div>
      </div>
    </section>
  );
}

function RelatedCard({ article }: { article: RelatedArticle }) {
  const image =
    article.thumbnail_image_url ||
    article.hero_image_url ||
    article.featured_image_url ||
    article.feature_image_url ||
    '';
  const category = article.category_name || article.category?.name || '';
  const meta = [
    formatCardDate(article.published_at),
    article.reading_time_minutes ? `${article.reading_time_minutes} min read` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link className="nwar-story" to={`/resources/article/${article.slug}`}>
      <span className="nwar-relimg">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="nwar-noimg" aria-hidden="true">
            <ArticleIcon name="compass" size={36} />
          </span>
        )}
      </span>
      {category ? <span className="nwar-label nwar-story-cat">{category}</span> : null}
      <h3 className="nw-h nwar-st">{article.title}</h3>
      {article.excerpt ? (
        <span className="nwar-clamp3 nwar-story-ex">{article.excerpt}</span>
      ) : null}
      {meta ? <span className="nw-mono nwar-story-meta">{meta}</span> : null}
    </Link>
  );
}
