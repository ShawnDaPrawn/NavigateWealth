/**
 * ArticleDetailPage — World-Class Published Article View
 *
 * Phase 1 enhancements:
 *  - Reading progress bar (scroll-driven)
 *  - Sticky table of contents (auto-generated from headings, intersection-observed)
 *  - Magazine-quality typography (drop cap, pull quotes, callout boxes, refined prose)
 *  - Related articles section (fetched from same category)
 *  - Author card with gradient design
 *  - Back-to-top floating button
 *  - Social sharing (LinkedIn, Facebook, copy link)
 *  - Print-friendly considerations
 *
 * Self-contained: avoids importing from the publications module barrel to
 * prevent transitive dependency issues with competing type files.
 *
 * @module pages/ArticleDetailPage
 */

import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ArrowLeft, Calendar, Clock, User, BookOpen, Eye } from 'lucide-react';
import DOMPurify from 'dompurify';
import { cn } from '../ui/utils';
import { SITE_ORIGIN } from '@/utils/siteOrigin';
import {
  SEO,
  createBreadcrumbSchema,
  createOrganizationSchema,
  createWebSiteSchema,
} from '../seo/SEO';
import { buildArticleTitle } from '../seo/seo-config';
import { knownArticleCanonicalUrl } from '../seo/articleCanonical';
import { ReadingProgressBar } from './article-detail/ReadingProgressBar';
import { TableOfContents } from './article-detail/TableOfContents';
import { RelatedArticles } from './article-detail/RelatedArticles';
import { AuthorCard } from './article-detail/AuthorCard';
import { BackToTop } from './article-detail/BackToTop';
import { ArticleErrorState, ArticleLoadingState } from './articleDetail/ArticleStates';
import { ShareActions } from './articleDetail/ShareActions';
import {
  enhanceArticleHtml,
  estimateReadingTime,
  formatDate,
  getEmailTrackingTokenFromUrl,
  getSessionFlag,
  setSessionFlag,
  stripEmailTrackingTokenFromUrl,
  postArticleEmailEngagementEvent,
} from './articleDetail/articleHelpers';
import { type ArticleDisplay } from './articleDetail/articleTypes';
import { DEMO_ARTICLES } from './articleDetail/demoArticles';
import { useArticleBySlug } from './articleDetail/useArticleBySlug';

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [emailTrackingToken, setEmailTrackingToken] = useState<string | null>(null);

  // Refs for reading progress and table of contents
  const articleContentRef = useRef<HTMLDivElement>(null);

  // Fetch article
  const { article: apiArticle, isLoading, error, refetch } = useArticleBySlug(slug);

  // Fallback to demo
  const article: ArticleDisplay | null =
    apiArticle || (slug ? (DEMO_ARTICLES[slug] ?? null) : null);

  // Scroll to top on slug change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  useEffect(() => {
    const token = getEmailTrackingTokenFromUrl();
    setEmailTrackingToken(token);
    if (token) {
      stripEmailTrackingTokenFromUrl();
    }
  }, [slug]);

  // SEO meta tags are rendered via the shared <SEO /> component in the JSX
  // below; every public page renders its own <SEO />, so tags are overwritten
  // (not restored) on client-side navigation.

  useEffect(() => {
    if (!article?.id || !emailTrackingToken) return;

    const sessionKey = `nw:article-email-open:${emailTrackingToken}`;
    if (getSessionFlag(sessionKey)) return;

    let cancelled = false;
    let hasInteracted = false;
    let focusedVisibleMs = 0;
    let lastTick = Date.now();
    let intervalId: number | null = null;

    const maybeTrackOpen = async () => {
      if (cancelled || getSessionFlag(sessionKey)) return;
      if (!hasInteracted && focusedVisibleMs < 4000) return;

      setSessionFlag(sessionKey);
      try {
        await postArticleEmailEngagementEvent('open', emailTrackingToken);
      } catch {
        // Best effort only. We do not block article reading on analytics delivery.
      }

      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const tick = () => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      if (document.visibilityState === 'visible' && document.hasFocus()) {
        focusedVisibleMs += delta;
      }

      void maybeTrackOpen();
    };

    const markInteraction = () => {
      hasInteracted = true;
      void maybeTrackOpen();
    };

    intervalId = window.setInterval(tick, 1000);
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, markInteraction, { passive: true });
    });
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      events.forEach((eventName) => {
        window.removeEventListener(eventName, markInteraction);
      });
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [article?.id, emailTrackingToken]);

  useEffect(() => {
    if (!article?.id || !emailTrackingToken) return;

    const sessionKey = `nw:article-email-read:${emailTrackingToken}`;
    if (getSessionFlag(sessionKey)) return;

    let cancelled = false;
    let focusedVisibleMs = 0;
    let maxScrollProgress = 0;
    let lastTick = Date.now();
    let intervalId: number | null = null;

    const getScrollProgress = () => {
      const element = articleContentRef.current;
      if (!element) return 0;

      const rect = element.getBoundingClientRect();
      const seenHeight = window.innerHeight - rect.top;
      const totalTrackableHeight = rect.height + window.innerHeight;
      if (totalTrackableHeight <= 0) return 0;

      return Math.max(0, Math.min(1, seenHeight / totalTrackableHeight));
    };

    const maybeTrackRead = async () => {
      if (cancelled || getSessionFlag(sessionKey)) return;
      if (focusedVisibleMs < 45000 || maxScrollProgress < 0.65) return;

      setSessionFlag(sessionKey);
      try {
        await postArticleEmailEngagementEvent('read', emailTrackingToken);
      } catch {
        // Best effort only.
      }

      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const refreshProgress = () => {
      maxScrollProgress = Math.max(maxScrollProgress, getScrollProgress());
      void maybeTrackRead();
    };

    const tick = () => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      if (document.visibilityState === 'visible' && document.hasFocus()) {
        focusedVisibleMs += delta;
      }

      refreshProgress();
    };

    intervalId = window.setInterval(tick, 1000);
    window.addEventListener('scroll', refreshProgress, { passive: true });
    window.addEventListener('resize', refreshProgress);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('scroll', refreshProgress);
      window.removeEventListener('resize', refreshProgress);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [article?.id, emailTrackingToken]);

  // Loading
  if (isLoading) return <ArticleLoadingState />;

  // Error
  if (!article && (error || !slug)) {
    return (
      <ArticleErrorState
        message={error || "The article you're looking for doesn't exist."}
        onRetry={refetch}
      />
    );
  }

  if (!article) return null;

  // Resolve field name variants
  const articleBody = (article.body || article.content || '') as string;
  const articleCategoryName = article.category_name || article.category?.name || '';
  const articleTypeName = article.type_name || article.type?.name || '';
  const articleImage =
    article.hero_image_url ||
    article.featured_image_url ||
    article.feature_image_url ||
    article.featured_image ||
    article.thumbnail_image_url ||
    '';
  const publishedDate = article.published_at ? formatDate(article.published_at) : '';
  const updatedDate = article.updated_at ? formatDate(article.updated_at) : '';
  const readingTime = article.reading_time_minutes || estimateReadingTime(articleBody);
  const authorName = article.author_name || 'Navigate Wealth Editorial Team';

  // Sanitise and enhance HTML
  const sanitisedHtml = DOMPurify.sanitize(articleBody);
  const enhancedHtml = enhanceArticleHtml(sanitisedHtml);

  // SEO — canonical always uses the production origin (never
  // window.location.origin, which would emit preview-deployment canonicals).
  const selfUrl = `${SITE_ORIGIN}/resources/article/${article.slug}`;
  const canonicalUrl =
    article.seo_canonical_url || knownArticleCanonicalUrl(article.slug) || selfUrl;
  const isCanonicalDuplicate = canonicalUrl.replace(/\/+$/, '') !== selfUrl.replace(/\/+$/, '');
  const seoDescription = article.excerpt || article.subtitle || '';
  const articleStructuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@graph': [
      createOrganizationSchema(),
      createWebSiteSchema(),
      createBreadcrumbSchema([
        { name: 'Home', url: SITE_ORIGIN },
        { name: 'Resources', url: `${SITE_ORIGIN}/resources` },
        { name: article.title },
      ]),
      {
        '@type': 'Article',
        '@id': `${canonicalUrl}#article`,
        headline: article.title,
        description: seoDescription,
        ...(articleImage && { image: articleImage }),
        inLanguage: 'en-ZA',
        author: {
          '@type': 'Person',
          name: authorName,
        },
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        ...(article.published_at && { datePublished: article.published_at }),
        ...(article.updated_at && { dateModified: article.updated_at }),
        mainEntityOfPage: canonicalUrl,
        url: canonicalUrl,
      },
    ],
  };

  return (
    <>
      <SEO
        title={buildArticleTitle(article.title)}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        ogType="article"
        ogImage={articleImage || undefined}
        robotsContent={isCanonicalDuplicate ? 'noindex, follow' : undefined}
        structuredData={articleStructuredData}
        articleMeta={{
          author: authorName,
          publishedTime: article.published_at ?? undefined,
          modifiedTime: article.updated_at ?? undefined,
        }}
      />
      <ReadingProgressBar contentRef={articleContentRef} />
      <BackToTop />

      <article className="min-h-screen bg-gray-50/50 print:bg-white">
        {/* ━━━ Header ━━━ */}
        <header className="bg-[rgb(49,54,83)] pt-16 pb-14 print:bg-white print:text-black print:pb-6 print:pt-4">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Back link */}
            <Link to="/resources" className="print:hidden">
              <Button
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10 mb-8 -ml-2 text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Resources
              </Button>
            </Link>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2.5 mb-5">
              {articleCategoryName && (
                <Badge className="bg-purple-500/90 text-white hover:bg-purple-600 border-0 px-3 py-1 text-xs font-medium print:bg-gray-200 print:text-gray-800">
                  {articleCategoryName}
                </Badge>
              )}
              {articleTypeName && (
                <Badge
                  variant="outline"
                  className="text-white/80 border-white/25 text-xs print:text-gray-600 print:border-gray-300"
                >
                  {articleTypeName}
                </Badge>
              )}
              {article.is_featured && (
                <Badge className="bg-amber-500 text-white border-0 text-xs">Featured</Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-extrabold text-white leading-tight mb-4 tracking-tight print:text-gray-900">
              {article.title}
            </h1>

            {/* Subtitle */}
            {article.subtitle && (
              <p className="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl leading-relaxed print:text-gray-600">
                {article.subtitle}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70 print:text-gray-500">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{authorName}</span>
              </div>
              {publishedDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{publishedDate}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{readingTime} min read</span>
              </div>
              {article.view_count !== undefined && article.view_count > 0 && (
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>
                    {article.view_count.toLocaleString()} view
                    {article.view_count !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ━━━ Featured Image ━━━ */}
        {articleImage && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 print:hidden">
            <div className="aspect-[21/9] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5">
              <img src={articleImage} alt={article.title} className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        {/* ━━━ Content Area ━━━ */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 print:py-4 print:px-0">
          <div className="flex gap-12">
            {/* Table of Contents — sticky sidebar on xl screens */}
            <TableOfContents contentRef={articleContentRef} />

            {/* Main column */}
            <div className="flex-1 min-w-0 max-w-4xl">
              {/* Actions bar */}
              <div className="flex items-center justify-between pb-6 mb-8 border-b border-gray-200 print:hidden">
                <ShareActions title={article.title} excerpt={article.excerpt} />

                {/* Updated timestamp */}
                {updatedDate && updatedDate !== publishedDate && (
                  <span className="text-xs text-gray-400">Updated {updatedDate}</span>
                )}
              </div>

              {/* Excerpt / Lead-in */}
              {article.excerpt && (
                <div className="mb-10 pl-6 border-l-[3px] border-purple-500 print:border-gray-300">
                  <p className="text-lg sm:text-xl text-gray-600 leading-relaxed italic">
                    {article.excerpt}
                  </p>
                </div>
              )}

              {/* ━━━ Article Body ━━━ */}
              <div
                ref={articleContentRef}
                className={cn(
                  // Base prose styling — magazine quality
                  'article-body',
                  'prose prose-lg max-w-none',
                  // Headings
                  'prose-headings:font-bold prose-headings:text-gray-900 prose-headings:tracking-tight',
                  'prose-h2:text-2xl sm:prose-h2:text-3xl prose-h2:mt-14 prose-h2:mb-5 prose-h2:pb-3 prose-h2:border-b prose-h2:border-gray-100',
                  'prose-h3:text-xl sm:prose-h3:text-2xl prose-h3:mt-10 prose-h3:mb-4',
                  // Paragraphs
                  'prose-p:text-gray-700 prose-p:leading-[1.85] prose-p:mb-5 prose-p:text-[16.5px]',
                  // Links
                  'prose-a:text-purple-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-a:transition-colors',
                  // Strong
                  'prose-strong:text-gray-900 prose-strong:font-semibold',
                  // Lists
                  'prose-ul:my-6 prose-ol:my-6',
                  'prose-li:text-gray-700 prose-li:my-2 prose-li:leading-relaxed',
                  // Images
                  'prose-img:rounded-xl prose-img:shadow-lg prose-img:my-8',
                  // Code
                  'prose-code:text-purple-600 prose-code:bg-purple-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-medium',
                  'prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:shadow-inner',
                  // Tables
                  'prose-table:border-collapse prose-table:rounded-lg prose-table:overflow-hidden',
                  'prose-th:bg-gray-50 prose-th:font-semibold prose-th:text-left prose-th:px-4 prose-th:py-3',
                  'prose-td:px-4 prose-td:py-3 prose-td:border-t prose-td:border-gray-100',
                )}
                dangerouslySetInnerHTML={{ __html: enhancedHtml }}
              />

              {/* Tags */}
              {article.tags && article.tags.length > 0 && (
                <div className="mt-12 pt-8 border-t border-gray-200 print:hidden">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                    Topics
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {article.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="text-sm px-3 py-1 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Compliance Disclaimer */}
              <div className="mt-10 p-5 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500 leading-relaxed print:mt-6">
                <p>
                  <strong className="text-gray-600">Disclaimer:</strong> This article is for
                  informational purposes only and does not constitute financial, tax, or legal
                  advice. Please consult a qualified financial adviser before making any investment
                  decisions. Navigate Wealth is an authorised Financial Services Provider.
                </p>
              </div>

              {/* Author Card */}
              <AuthorCard name={authorName} />

              {/* Related Articles */}
              <RelatedArticles currentArticleId={article.id} categoryId={article.category_id} />

              {/* Bottom CTA */}
              <div className="mt-16 text-center print:hidden">
                <Link to="/resources">
                  <Button
                    size="lg"
                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20 px-8"
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Explore More Insights
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* ━━━ Custom CSS for magazine enhancements ━━━ */}
      <style>{`
        /* Drop cap */
        .article-drop-cap::first-letter {
          float: left;
          font-size: 3.75rem;
          font-weight: 700;
          line-height: 0.8;
          margin-right: 0.15em;
          margin-top: 0.1em;
          color: rgb(109, 40, 217); /* purple-700 */
          font-family: Georgia, 'Times New Roman', serif;
        }

        /* Pull quotes (enhanced blockquotes) */
        .article-body .article-pull-quote,
        .article-body blockquote {
          position: relative;
          margin: 2.5rem 0;
          padding: 2rem 2rem 2rem 2.5rem;
          border-left: 4px solid rgb(139, 92, 246);
          background: linear-gradient(135deg, rgb(245, 243, 255) 0%, rgb(238, 242, 255) 100%);
          border-radius: 0 1rem 1rem 0;
          font-style: italic;
          font-size: 1.125rem;
          line-height: 1.75;
          color: rgb(55, 48, 163);
        }

        .article-body .article-pull-quote::before,
        .article-body blockquote::before {
          content: '"';
          position: absolute;
          top: -0.25rem;
          left: 0.75rem;
          font-size: 4rem;
          font-weight: 700;
          color: rgb(196, 181, 253);
          font-family: Georgia, 'Times New Roman', serif;
          line-height: 1;
        }

        /* Callout boxes */
        .article-callout {
          margin: 2rem 0;
          padding: 1.25rem 1.5rem;
          border-radius: 0.75rem;
          font-style: normal;
          font-size: 0.9375rem;
          line-height: 1.7;
        }

        .article-callout-takeaway {
          background-color: rgb(240, 253, 244);
          border: 1px solid rgb(187, 247, 208);
          color: rgb(22, 101, 52);
        }
        .article-callout-takeaway::before {
          content: '💡 Key Takeaway';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .article-callout-important,
        .article-callout-warning {
          background-color: rgb(255, 251, 235);
          border: 1px solid rgb(253, 224, 71);
          color: rgb(113, 63, 18);
        }
        .article-callout-important::before {
          content: '⚠️ Important';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .article-callout-warning::before {
          content: '⚠️ Risk Warning';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .article-callout-note {
          background-color: rgb(239, 246, 255);
          border: 1px solid rgb(191, 219, 254);
          color: rgb(30, 64, 175);
        }
        .article-callout-note::before {
          content: '📝 Note';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .article-callout-tip {
          background-color: rgb(245, 243, 255);
          border: 1px solid rgb(221, 214, 254);
          color: rgb(76, 29, 149);
        }
        .article-callout-tip::before {
          content: '✨ Tip';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Print styles */
        @media print {
          .article-body {
            font-size: 11pt !important;
            line-height: 1.6 !important;
          }
          .article-body h2 {
            page-break-after: avoid;
            margin-top: 1.5rem !important;
          }
          .article-body blockquote,
          .article-callout {
            break-inside: avoid;
          }
          .article-drop-cap::first-letter {
            color: #000 !important;
          }
        }
      `}</style>
    </>
  );
}

export default ArticleDetailPage;
