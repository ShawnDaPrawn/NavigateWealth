/**
 * NavigatorArticlePage — the redesigned article page (/resources/article/:slug).
 *
 * It does what the live page (ArticleDetailPage.tsx) does, through the live
 * page's own code: useArticleBySlug loads the published article and counts
 * the view; the body goes through the same DOMPurify sanitising and the same
 * enhancement; the newsletter's email-engagement tracking, the share targets
 * and the print view are the live ones; an unknown slug shows "Article Not
 * Found" and is marked noindex; and it emits the same SEO tags, canonical URL
 * and Article/BreadcrumbList JSON-LD.
 *
 * The layout is the "Article" board of the Website Redesign canvas: a paper
 * masthead with the by-line table, the banner picture, a rail with the table
 * of contents, sharing and a consultation card beside the article, then the
 * call to action, disclaimer, author note, newsletter sign-up and "Continue
 * Reading".
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useParams } from 'react-router';
import { SEO } from '../../components/seo/SEO';
import { useArticleBySlug } from '../../components/pages/articleDetail/useArticleBySlug';
import { printArticle } from '../../components/pages/articleDetail/articlePrint';
import type { ArticleDisplay } from '../../components/pages/articleDetail/articleTypes';
import { escapeHtmlText } from '../../utils/pdfPrintTitle';
import { ArticleConversion, ArticleRailCta } from '../sections/ArticleCta';
import { ArticleBanner, ArticleMasthead } from '../sections/ArticleMasthead';
import {
  articleFacts,
  articleSeo,
  articleTopic,
  prepareArticleBody,
  printMetaParts,
  type TocEntry,
} from '../sections/ArticleModel';
import { ArticleAuthor, ArticleDisclaimer, ArticleTopics } from '../sections/ArticleNotes';
import { ArticleBackToTop, ArticleProgress } from '../sections/ArticleProgress';
import { ArticleRelated } from '../sections/ArticleRelated';
import { ArticleShareBar, ArticleShareMenu } from '../sections/ArticleShare';
import { useArticleSharing } from '../sections/ArticleSharing';
import { ArticleSignup } from '../sections/ArticleSignup';
import { ArticleLoading, ArticleNotFound } from '../sections/ArticleStates';
import { ArticleTocFold, ArticleTocRail } from '../sections/ArticleToc';
import { useArticleEmailTracking } from '../sections/ArticleTracking';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/article.css';

/** The live table of contents appears only for two headings or more. */
const MIN_TOC = 2;

export function NavigatorArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { article, isLoading, error, refetch } = useArticleBySlug(slug);
  const contentRef = useRef<HTMLDivElement>(null);

  // A new article starts at the top, as on the live page.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, [slug]);

  useArticleEmailTracking(slug, article?.id, contentRef);

  if (isLoading) {
    return (
      <div className="nw-site nwar">
        <ArticleLoading />
      </div>
    );
  }
  if (!article && (error || !slug)) {
    return (
      <div className="nw-site nwar">
        <ArticleNotFound
          message={error || "The article you're looking for doesn't exist."}
          onRetry={refetch}
        />
      </div>
    );
  }
  if (!article) return null;

  return <ArticleView key={article.id} article={article} contentRef={contentRef} />;
}

function ArticleView({
  article,
  contentRef,
}: {
  article: ArticleDisplay;
  contentRef: RefObject<HTMLDivElement>;
}) {
  const facts = useMemo(() => articleFacts(article), [article]);
  const body = useMemo(() => prepareArticleBody(facts.body), [facts.body]);
  const seo = articleSeo(article, facts);
  const topic = articleTopic(facts.category);
  const toc = useMemo<TocEntry[]>(() => (body.toc.length >= MIN_TOC ? body.toc : []), [body]);

  const [activeId, setActiveId] = useState(toc[0]?.id ?? '');
  const [foldOpen, setFoldOpen] = useState(false);

  // The current section is the last heading to have reached the top 30% of
  // the window (the band the live page watches), and the first one until any
  // has, as the board starts. Worked out from the headings' positions on each
  // scroll, so it is right after a jump as well as after a slow scroll.
  useEffect(() => {
    if (toc.length === 0) return;
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const line = window.innerHeight * 0.3;
      let current = toc[0].id;
      for (const { id } of toc) {
        const heading = document.getElementById(id);
        if (heading && heading.getBoundingClientRect().top <= line) current = id;
      }
      setActiveId(current);
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [toc]);

  const print = useCallback(() => {
    printArticle(article.title, {
      articleContentHtml: contentRef.current?.innerHTML || '',
      excerptText: article.excerpt ? escapeHtmlText(article.excerpt) : null,
      metaParts: printMetaParts(article, facts).map(escapeHtmlText),
    });
  }, [article, facts, contentRef]);
  const sharing = useArticleSharing(article.title, article.excerpt, print);

  const pickInFold = (id: string) => {
    setActiveId(id);
    setFoldOpen(false);
  };

  return (
    <div className="nw-site nwar">
      <SEO {...seo} />
      <ArticleProgress contentRef={contentRef} />

      <ArticleMasthead article={article} facts={facts} />
      <ArticleBanner image={facts.image} title={article.title} />

      <div className="nwar-body">
        <div className="nw-wrap nwar-body-wrap">
          <div className="nwar-body-row">
            <aside className="nwar-rail nwar-noprint">
              {toc.length > 0 ? (
                <ArticleTocRail entries={toc} activeId={activeId} onPick={setActiveId} />
              ) : null}
              <ArticleShareMenu sharing={sharing} />
              <ArticleRailCta />
            </aside>

            <article className="nwar-article">
              <div className="nwar-tocm nwar-noprint">
                {toc.length > 0 ? (
                  <ArticleTocFold
                    entries={toc}
                    activeId={activeId}
                    onPick={pickInFold}
                    open={foldOpen}
                    onToggle={() => setFoldOpen((v) => !v)}
                  />
                ) : null}
                <ArticleShareBar sharing={sharing} />
              </div>

              <div
                ref={contentRef}
                className="nwar-prose"
                dangerouslySetInnerHTML={{ __html: body.html }}
              />

              <ArticleTopics tags={article.tags} />
              <ArticleConversion topic={topic} />
              <ArticleDisclaimer />
              <ArticleAuthor name={facts.author} />
              <ArticleSignup />
            </article>
          </div>
        </div>
      </div>

      <ArticleRelated articleId={article.id} categoryId={article.category_id} />
      <ArticleBackToTop />
    </div>
  );
}

export default NavigatorArticlePage;
