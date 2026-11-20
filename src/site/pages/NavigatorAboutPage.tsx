/**
 * NavigatorAboutPage — the redesigned About page.
 *
 * The layout is the "About" board of the Website Redesign canvas. It emits
 * the same SEO tags and JSON-LD as the live page, reads the firm's facts, the
 * founder's note and his photograph from companyFacts (as the live page does),
 * and links only to routes the site already serves.
 *
 * The four topics repeat the live page's copy word for word: the live page
 * keeps them inline in its component, so there is no module to import them
 * from. The page's test checks them against that file, so the two cannot
 * drift apart unnoticed.
 */
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { SEO, createAboutPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { COMPANY, FOUNDER } from '../../config/companyFacts';
import { getOptimizedFallbackUrl } from '../../utils/optimizedImages';
import { AboutFounder } from '../sections/AboutFounder';
import { AboutHero, type RegisterEntry } from '../sections/AboutHero';
import { AboutTopics, type AboutTopic } from '../sections/AboutTopics';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/about.css';

const seoData = getSEOData('about');
const aboutPageStructuredData = createAboutPageSchema();

const REGISTER: RegisterEntry[] = [
  { label: 'Trading name', value: COMPANY.tradingName },
  { label: 'Legal name', value: COMPANY.legalName },
  { label: 'Registration', value: COMPANY.registrationNumber, code: true },
  { label: 'FSP number', value: COMPANY.fspNumber, code: true, highlight: true },
  { label: 'Authorised', value: `${COMPANY.fscaAuthorisedOn} · FSCA` },
  { label: 'Office', value: COMPANY.office },
  { label: 'Languages', value: COMPANY.languages.join(', ') },
];

const ABOUT_TOPICS: AboutTopic[] = [
  {
    key: 'mission',
    label: 'Mission & Culture',
    title: 'Our Mission & Culture',
    description: 'Learn about our values, purpose, and the culture that drives everything we do.',
    items: [
      {
        title: 'Our Mission',
        text: 'To empower our clients to achieve financial independence and peace of mind through personalized wealth management strategies, exceptional service, and unwavering commitment to their success.',
      },
      {
        title: 'Our Approach',
        text: 'As a founder-led practice, we keep advice personal: you deal directly with the person advising you. We stay current with markets and regulation so that the advice stays relevant as your life changes.',
      },
      {
        title: 'Our Promise',
        text: 'Every client relationship is built on trust, transparency, and a deep understanding of your unique financial journey. We promise to be your trusted partner every step of the way.',
      },
    ],
  },
  {
    key: 'partners',
    label: 'Our Partners',
    title: 'Trusted Product Providers',
    description:
      'We work with established South African product providers, so you can compare real options side by side.',
    items: [
      {
        title: 'Investment Partners',
        text: 'Investment managers and platforms including Allan Gray, Sygnia, Stanlib and INN8, used to build diversified investment and retirement portfolios.',
      },
      {
        title: 'Insurance Partners',
        text: 'Life, disability and severe illness cover compared across insurers including Discovery, Old Mutual, Momentum, Sanlam, Liberty, BrightRock and Hollard.',
      },
      {
        title: 'Medical & Estate Partners',
        text: 'Medical aid options from Discovery Health and Momentum Health, and estate planning support from Capital Legacy and EW Serfontein & Associates.',
      },
    ],
  },
  {
    key: 'licensing',
    label: 'Licensing',
    title: 'Regulatory Compliance',
    description:
      'Every detail below can be checked independently, starting with the FSCA’s public register.',
    items: [
      {
        title: 'FSP Licence',
        text: `${COMPANY.tradingName} is the trading name of ${COMPANY.legalName} (registration ${COMPANY.registrationNumber}), an authorised Financial Services Provider (FSP ${COMPANY.fspNumber}) licensed by the ${COMPANY.regulator} on ${COMPANY.fscaAuthorisedOn}.`,
      },
      {
        title: 'Fit and Proper Advice',
        text: 'Everyone who gives advice at Navigate Wealth meets the FSCA’s Fit and Proper requirements for honesty, qualifications, experience and continuous professional development.',
      },
      {
        title: 'Regulatory Oversight',
        text: 'We operate under the FAIS Act and the FSCA’s General Code of Conduct, and our authorisation can be confirmed on the FSCA’s public register of financial services providers.',
      },
    ],
  },
  {
    key: 'transparency',
    label: 'Radical Transparency',
    title: 'Complete Transparency',
    description:
      'We believe in radical transparency - no hidden fees, no complex structures, just honest, straightforward advice.',
    items: [
      {
        title: 'Fee Transparency',
        text: "All fees are clearly disclosed upfront with no hidden charges. We believe you should know exactly what you're paying for and why.",
      },
      {
        title: 'Investment Transparency',
        text: 'You have full visibility into your investments with regular reporting, real-time access to your portfolio, and clear explanations of all investment decisions.',
      },
      {
        title: 'Performance Transparency',
        text: 'We provide honest, comprehensive performance reporting that shows both successes and areas for improvement, along with clear benchmarking.',
      },
    ],
  },
];

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches)
  );
}

export function NavigatorAboutPage() {
  const { hash } = useLocation();

  // /about#founder (the hero's link, and links from the Team page) lands on
  // the founder's note. A frame's delay lets ScrollToTop's route-change reset
  // run first, as on the live page.
  useEffect(() => {
    if (hash !== '#founder') return;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById('founder')
        ?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  return (
    <div className="nw-site nw-base nwab-page">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={aboutPageStructuredData}
      />

      <AboutHero
        badge={`FSCA-authorised · FSP ${COMPANY.fspNumber}`}
        title="Your Trusted"
        accent="Financial Partner"
        lead="Navigate Wealth is an independent, founder-led practice that helps individuals and families build, protect, and transfer wealth through comprehensive financial planning and investment management."
        action={{ label: 'Meet Our Founder', href: '#founder' }}
        register={REGISTER}
      />

      <AboutTopics
        kicker="Learn More About Us"
        title="Discover Navigate Wealth"
        lead="Select a topic to learn more about our company, values, and commitment to excellence."
        tabsLabel={`About ${COMPANY.tradingName}`}
        topics={ABOUT_TOPICS}
      />

      <AboutFounder
        kicker="Founder-led practice"
        title="A Note From Our Founder"
        name={FOUNDER.name}
        role={FOUNDER.title}
        credential={`FSP ${COMPANY.fspNumber}`}
        note={FOUNDER.note}
        photo={{
          src: getOptimizedFallbackUrl(FOUNDER.imageKey),
          imageKey: FOUNDER.imageKey,
          alt: `${FOUNDER.name}, ${FOUNDER.title} of ${COMPANY.tradingName}`,
        }}
      />

      <section className="nwab-work" aria-labelledby="nwab-work-title">
        <div className="nw-wrap nwab-work-inner">
          <h2 id="nwab-work-title" className="nwab-work-title">
            Work With Us or Stay Informed
          </h2>
          <p className="nwab-work-lead">
            Discover exciting career opportunities with Navigate Wealth or stay up to date with our
            latest news, announcements, and industry insights.
          </p>
          <div className="nwab-work-ctas">
            <Link className="nw-btn nw-btn--lg nwab-cta" to="/careers">
              Explore Careers
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <Link className="nw-outline nw-btn--lg nwab-cta" to="/press">
              For the Press
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default NavigatorAboutPage;
