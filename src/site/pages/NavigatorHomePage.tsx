/**
 * NavigatorHomePage — the redesigned home page (route `/`).
 *
 * Same SEO tags and JSON-LD as the live page (homePageData.tsx), the same
 * copy, links and calls to action, in the Navigator design. The H1 leads with
 * what people search for; the live page's rotating headlines follow it as
 * supporting copy. Sections, top to bottom: hero, audience paths, services,
 * why us, how we work, partners, reviews (once any are published), featured
 * insights, FAQ and the "Get Started" enquiry form.
 *
 * Only the hero's flag loads eagerly; every photograph below it is lazy.
 */
import { SEO } from '../../components/seo/SEO';
import { commonFAQs } from '../../components/seo/seo-config';
import { homePageStructuredData, seoData } from '../../components/pages/homePageData';
import { PUBLISHED_REVIEWS } from '../../config/publishedReviews';
import { FaqRail } from '../sections/FaqRail';
import { pad2 } from '../sections/format';
import { GetStartedSection } from '../home/GetStartedSection';
import { HomeHero } from '../home/HomeHero';
import { HomeInsights } from '../home/HomeInsights';
import {
  PartnersSection,
  PathsSection,
  ReviewsSection,
  ServicesGrid,
  WhyUsSection,
} from '../home/HomeSections';
import { ProcessSteps } from '../home/ProcessSteps';
import { QUOTE_PATH } from '../home/homeContent';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/service.css';
import '../styles/home.css';

export function NavigatorHomePage() {
  const numbered = ['services', 'why', 'process', 'partners'];
  if (PUBLISHED_REVIEWS.length > 0) numbered.push('reviews');
  numbered.push('insights', 'faq');
  const indexOf = (id: string) => pad2(numbered.indexOf(id) + 1);

  return (
    <div className="nw-site nwx-home">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={homePageStructuredData}
      />

      <HomeHero />
      <PathsSection />
      <ServicesGrid index={indexOf('services')} />
      <WhyUsSection index={indexOf('why')} />
      <ProcessSteps index={indexOf('process')} variant="home" />
      <PartnersSection index={indexOf('partners')} />
      <ReviewsSection index={indexOf('reviews')} />
      <HomeInsights index={indexOf('insights')} />
      <FaqRail
        index={indexOf('faq')}
        faqs={commonFAQs}
        lead="Answers to the questions South Africans ask us most about independent financial advice."
        quoteLink={QUOTE_PATH}
      />
      <GetStartedSection />
    </div>
  );
}
