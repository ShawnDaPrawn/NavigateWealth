/**
 * One press release in the newsroom grid. Links to the article page the live
 * Press page links to (/resources/article/<slug>). Stays in the document with
 * `hidden` when the search or category filter excludes it.
 */
import { Link } from 'react-router';
import { ArrowRight, Calendar, Clock } from 'lucide-react';
import { NwImage } from '../components/NwImage';
import { PRESS_CATEGORY_LABEL_MAP, formatPressDate, type PressArticle } from './pressContent';
import '../styles/company.css';

interface PressArticleCardProps {
  article: PressArticle;
  hidden: boolean;
}

export function PressArticleCard({ article, hidden }: PressArticleCardProps) {
  const image = article.hero_image_url || article.thumbnail_image_url;
  return (
    <li className="nwco-article" hidden={hidden}>
      <Link to={`/resources/article/${article.slug}`} className="nwco-article-link">
        {image ? (
          <div className="nwco-article-img">
            <NwImage
              src={image}
              alt=""
              sizes="(min-width: 1100px) 400px, (min-width: 700px) 50vw, 100vw"
            />
          </div>
        ) : null}
        <div className="nwco-article-body">
          <p className="nwco-article-cat">
            {PRESS_CATEGORY_LABEL_MAP[article.press_category] || article.press_category}
          </p>
          <h3 className="nwco-article-title">{article.title}</h3>
          <p className="nwco-article-excerpt">{article.excerpt}</p>
          <p className="nwco-article-meta nw-mono">
            {article.published_at ? (
              <span>
                <Calendar size={13} strokeWidth={1.75} aria-hidden="true" />
                {formatPressDate(article.published_at)}
              </span>
            ) : null}
            {article.reading_time_minutes ? (
              <span>
                <Clock size={13} strokeWidth={1.75} aria-hidden="true" />
                {article.reading_time_minutes} min
              </span>
            ) : null}
            <ArrowRight
              className="nwco-article-go"
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </p>
        </div>
      </Link>
    </li>
  );
}
