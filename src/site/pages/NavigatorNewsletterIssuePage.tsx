/**
 * NavigatorNewsletterIssuePage — the redesigned newsletter issue page
 * (/resources/newsletter/<slug>), what "Read online" opens.
 *
 * It reads what the live page reads (NewsletterDetailPage.tsx), through the
 * live page's own hook: the published issue from the public newsletter route,
 * a slug with no issue reading as "not found" rather than an error. It emits
 * the same SEO tags and JSON-LD, noindex included for a missing issue, keeps
 * the live embed of the PDF and the live download and open links, and scrolls
 * to the top when the slug changes.
 *
 * The layout is the "NewsletterIssue" board of the Website Redesign canvas.
 * Beyond the live page it links to the previous issue, found in the archive
 * the Resources page reads, and offers the newsletter sign-up the footer and
 * the Resources page use.
 */
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import {
  usePublishedNewsletter,
  usePublishedNewsletters,
} from '../../components/pages/resources/useNewsletters';
import { siteAbsoluteUrl } from '@/utils/siteOrigin';
import { NewsletterIssueAdvice } from '../sections/NewsletterIssueAdvice';
import { NewsletterIssueMasthead } from '../sections/NewsletterIssueMasthead';
import { previousIssue } from '../sections/NewsletterIssueModel';
import { NewsletterIssuePrevious } from '../sections/NewsletterIssuePrevious';
import { NewsletterIssueReader } from '../sections/NewsletterIssueReader';
import { NewsletterIssueLoading, NewsletterIssueMissing } from '../sections/NewsletterIssueStates';
import { NewsletterIssueSubscribe } from '../sections/NewsletterIssueSubscribe';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/newsletter-issue.css';

export function NavigatorNewsletterIssuePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: newsletter, isLoading, error } = usePublishedNewsletter(slug);
  // The archive, for the previous issue; asked for once the issue is known.
  const { data: archive } = usePublishedNewsletters(Boolean(newsletter));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [slug]);

  if (isLoading) {
    return (
      <div className="nw-site nwni">
        <div className="nw-wrap nwni-wrap">
          <NewsletterIssueLoading />
        </div>
      </div>
    );
  }

  if (!newsletter) {
    return (
      <div className="nw-site nwni">
        <SEO
          title="Newsletter not found | Navigate Wealth"
          description="This newsletter is no longer available."
          robotsContent="noindex, follow"
        />
        <div className="nw-wrap nwni-wrap">
          <NewsletterIssueMissing failed={Boolean(error)} />
        </div>
      </div>
    );
  }

  const canonical = siteAbsoluteUrl(`/resources/newsletter/${newsletter.slug}`);
  const seoTitle = `${newsletter.title} | Navigate Wealth Newsletter`;
  const previous = previousIssue(archive, newsletter);

  return (
    <div className="nw-site nwni">
      <SEO
        title={seoTitle}
        description={newsletter.description}
        canonicalUrl={canonical}
        structuredData={createWebPageSchema(seoTitle, newsletter.description, canonical)}
      />
      <div className="nw-wrap nwni-wrap">
        <NewsletterIssueMasthead newsletter={newsletter} />
        <NewsletterIssueReader newsletter={newsletter} />
        <div className="nwni-more">
          {previous ? <NewsletterIssuePrevious newsletter={previous} /> : null}
          <NewsletterIssueSubscribe />
        </div>
        <NewsletterIssueAdvice />
      </div>
    </div>
  );
}

export default NavigatorNewsletterIssuePage;
