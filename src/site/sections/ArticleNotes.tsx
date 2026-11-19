/**
 * What follows every article on the live page, in the board's form: its
 * topics (only when the article has tags; the board's sample has none), the
 * compliance disclaimer and the "Written by" note, both worded as the live
 * page words them.
 */
import { DEFAULT_BIO } from '../../components/pages/article-detail/AuthorCard';
import { ArticleIcon } from './ArticleIcons';
import { DISCLAIMER } from './ArticleModel';

export function ArticleTopics({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="nwar-topics">
      <p className="nwar-label nwar-topics-label">Topics</p>
      <ul className="nwar-topics-list">
        {tags.map((tag, i) => (
          <li key={`${tag}-${i}`} className="nwar-topic">
            {tag}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ArticleDisclaimer() {
  return (
    <div className="nwar-disclaimer">
      <strong>Disclaimer:</strong> {DISCLAIMER}
    </div>
  );
}

export function ArticleAuthor({ name }: { name: string }) {
  return (
    <section className="nwar-author" aria-label="About the author">
      <span className="nwar-author-mark" aria-hidden="true">
        <ArticleIcon name="compass" size={22} />
      </span>
      <div className="nwar-author-copy">
        <span className="nwar-label nwar-author-label">Written by</span>
        <p className="nw-h nwar-author-name">{name}</p>
        <p className="nwar-author-bio">{DEFAULT_BIO}</p>
      </div>
    </section>
  );
}
