/**
 * The article's two invitations to talk to an adviser: the dark card at the
 * foot of the rail and the dark band after the article.
 *
 * The board words both for its sample article, a piece on wills ("Review your
 * will with your whole estate plan", a second button to Estate Planning).
 * Real articles cover every topic, so the wording here is general, and the
 * article's category picks what the band offers to review and which service
 * page its second button opens (ArticleModel's articleTopic). Its fact line is
 * read from companyFacts.ts.
 */
import { Link } from 'react-router';
import { ArticleRose } from './ArticleIcons';
import { ADVICE_LINE, type ArticleTopic } from './ArticleModel';

export function ArticleRailCta() {
  return (
    <div className="nwar-railcta">
      <p className="nwar-label nwar-railcta-label">Free consultation</p>
      <p className="nw-h nwar-railcta-t">
        See how this applies to <span className="nw-accent">your own plan</span>
      </p>
      <Link className="nw-btn nwar-railcta-btn" to="/schedule-consultation">
        Book a Free Consultation
      </Link>
    </div>
  );
}

export function ArticleConversion({ topic }: { topic: ArticleTopic }) {
  return (
    <div className="nwar-convert nwar-noprint">
      <ArticleRose className="nwar-convert-rose" />
      <div className="nwar-convert-row">
        <div className="nwar-convert-copy">
          <p className="nwar-label nw-eyebrow nwar-convert-eyebrow">Free initial consultation</p>
          <p className="nw-h nwar-convert-t">
            {topic.subject ? (
              <>
                Have your {topic.subject} reviewed alongside the rest of your{' '}
                <span className="nw-accent">financial plan</span>.
              </>
            ) : (
              <>
                Have your financial plan reviewed by an{' '}
                <span className="nw-accent">independent adviser</span>.
              </>
            )}
          </p>
          <p className="nwar-convert-line">{ADVICE_LINE}</p>
        </div>
        <div className="nwar-convert-actions">
          <Link className="nw-btn nwar-convert-btn" to="/schedule-consultation">
            Book a Free Consultation
          </Link>
          <Link className="nw-ghost-dark nwar-convert-btn" to={topic.path}>
            {topic.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
