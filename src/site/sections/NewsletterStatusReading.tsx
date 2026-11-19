/**
 * "Start reading" — the confirm board's short list of articles under a
 * confirmed subscription. It shows the editors' featured articles, read
 * through the hook the home page's Featured Insights uses (most-read first),
 * and leaves itself out while they load or when there are none.
 */
import { useId } from 'react';
import { Link } from 'react-router';
import { articlePath, useFeaturedArticles } from '../../components/shared/useFeaturedArticles';

/** The board lists three. */
const READING_COUNT = 3;

export function NewsletterStatusReading() {
  const id = useId();
  const { articles, loading } = useFeaturedArticles();
  const reading = articles
    .filter((article) => article.slug && article.title)
    .slice(0, READING_COUNT);

  if (loading || reading.length === 0) return null;

  return (
    <div className="nwnl-reading">
      <div id={`${id}-label`} className="nwnl-reading-label nwnl-mono">
        Start reading
      </div>
      <ul className="nwnl-reading-list" aria-labelledby={`${id}-label`}>
        {reading.map((article) => (
          <li key={article.id}>
            <Link className="nwnl-read" to={articlePath(article.slug)}>
              {article.category_name ? (
                <span className="nwnl-read-cat nwnl-mono">{article.category_name}</span>
              ) : null}
              <span className="nwnl-read-t">{article.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
