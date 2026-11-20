/**
 * NavigatorWhyUsPage — the redesigned "Why Us?" page (/why-us).
 *
 * The layout is the "WhyUs" board of the Website Redesign canvas. It emits the
 * same SEO tags and JSON-LD as the live page, states only the checkable facts
 * in companyFacts.ts (the trust tiles, the credentials and the FSP number
 * come from there), lists the partners from the same groups as the live
 * partners modal, and links only to routes the site already serves.
 */
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { Building2, Globe, Shield, UserCheck, type LucideIcon } from 'lucide-react';
import consultationImage from 'figma:asset/61c60b4a45c33d3564e85aaf184ff3f3b9db37f8.png';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { PROVIDER_GROUPS } from '../../components/shared/providerGroups';
import { COMPANY, TRUST_FACTS } from '../../config/companyFacts';
import { NwImage } from '../components/NwImage';
import { SectionHead } from '../sections/SectionHead';
import { WhyUsCompass, type CoreValue } from '../sections/WhyUsCompass';
import {
  ArrowIcon,
  AwardIcon,
  BarChartIcon,
  BuildingIcon,
  CheckIcon,
  GlobeIcon,
  HandshakeIcon,
  HeadphonesIcon,
  LockIcon,
  ShieldCheckIcon,
  ShieldIcon,
  UserCheckIcon,
} from '../sections/WhyUsIcons';
import { WhyUsPartnersDialog } from '../sections/WhyUsPartnersDialog';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/why-us.css';

const CONSULTATION_PATH = '/schedule-consultation';
const QUOTE_PATH = '/get-quote';
const SERVICES_PATH = '/services';
const CONSULTATION_IMAGE_KEY = '61c60b4a45c33d3564e85aaf184ff3f3b9db37f8';

type BoardIcon = ComponentType<{ size: number; stroke?: string }>;

/** The trust facts carry lucide icons; the board draws its own cut of each. */
const TRUST_ICONS = new Map<LucideIcon, BoardIcon>([
  [Shield, ShieldIcon],
  [Globe, GlobeIcon],
  [UserCheck, UserCheckIcon],
  [Building2, BuildingIcon],
]);

function TrustIcon({ icon: Lucide }: { icon: LucideIcon }) {
  const Board = TRUST_ICONS.get(Lucide);
  return Board ? <Board size={20} /> : <Lucide size={20} strokeWidth={1.75} aria-hidden="true" />;
}

const CORE_VALUES: readonly CoreValue[] = [
  {
    title: 'Independence',
    card: 'N',
    bearing: '000°',
    description:
      "We work for you, not product providers. Our recommendations are based solely on what's best for your financial future.",
    features: [
      'No product provider bias',
      'Access to leading providers',
      'Objective advice always',
      'Your interests first',
    ],
  },
  {
    title: 'Transparency',
    card: 'E',
    bearing: '090°',
    description:
      'Clear communication about fees, products, and strategies. No hidden costs or complex jargon.',
    features: [
      'Upfront fee disclosure',
      'Plain language explanations',
      'Full product transparency',
      'Regular reporting',
    ],
  },
  {
    title: 'Expertise',
    card: 'S',
    bearing: '180°',
    description:
      'Advice that meets the FSCA’s Fit and Proper standards, backed by continuous professional development.',
    features: [
      'FSCA Fit and Proper standards',
      'Continuous professional development',
      'Plain-language advice',
      'Regular plan reviews',
    ],
  },
  {
    title: 'Technology',
    card: 'W',
    bearing: '270°',
    description:
      'Modern digital platform combined with personal service for the best of both worlds.',
    features: [
      '24/7 online portal access',
      'Real-time portfolio tracking',
      'Secure document storage',
      'Mobile friendly',
    ],
  },
];

const ADVANTAGES: readonly { icon: BoardIcon; title: string; description: string }[] = [
  {
    icon: HandshakeIcon,
    title: 'Truly Independent',
    description:
      "Unlike tied agents, we're free to recommend products from a range of providers. Our only obligation is to you.",
  },
  {
    icon: HeadphonesIcon,
    title: 'Personal Service',
    description:
      'As a founder-led practice, you deal directly with the person advising you — someone who knows you, your family, and your goals. Real relationships, not call centres.',
  },
  {
    icon: BarChartIcon,
    title: 'Comprehensive Solutions',
    description:
      'From investments to insurance, retirement to estates - we handle every aspect of your financial life.',
  },
  {
    icon: LockIcon,
    title: 'Security & Compliance',
    description: `Authorised by the FSCA (FSP ${COMPANY.fspNumber}) and regulated under the FAIS Act. Your personal and financial information is protected with bank-level security.`,
  },
];

const PROCESS_STEPS: readonly {
  number: string;
  title: string;
  description: string;
  details: readonly string[];
}[] = [
  {
    number: '01',
    title: 'Discovery & Analysis',
    description:
      'We start by understanding your unique situation, goals, and values through comprehensive consultation.',
    details: ['Initial consultation', 'Goals identification', 'Risk profiling', 'Needs analysis'],
  },
  {
    number: '02',
    title: 'Strategy Development',
    description:
      'We research solutions across a range of providers and develop a tailored financial strategy.',
    details: ['Market research', 'Product comparison', 'Strategy formulation', 'Risk assessment'],
  },
  {
    number: '03',
    title: 'Clear Recommendations',
    description:
      'We present transparent recommendations with clear explanations of benefits, costs, and alternatives.',
    details: ['Detailed proposals', 'Fee transparency', 'Product comparisons', 'Q&A session'],
  },
  {
    number: '04',
    title: 'Implementation & Support',
    description:
      'We handle all paperwork and provide ongoing support as your needs evolve over time.',
    details: [
      'Application handling',
      'Regular reviews',
      'Portfolio monitoring',
      'Continuous support',
    ],
  },
];

const CREDENTIALS: readonly { term: string; detail: string }[] = [
  {
    term: 'FSCA authorisation',
    detail: `FSP ${COMPANY.fspNumber}, granted ${COMPANY.fscaAuthorisedOn}`,
  },
  { term: 'Registered company', detail: `${COMPANY.legalName}, ${COMPANY.registrationNumber}` },
  { term: 'Office', detail: COMPANY.office },
];

export function NavigatorWhyUsPage() {
  const seo = getSEOData('why-us');

  return (
    <div className="nw-site nw-base nwwu">
      <SEO
        {...seo}
        structuredData={createWebPageSchema(seo.title, seo.description, seo.canonicalUrl)}
      />

      {/* Hero */}
      <section className="nwwu-hero" aria-label="Hero">
        <div className="nw-grid-bg nwwu-hero-grid-bg" aria-hidden="true" />
        <div className="nwwu-hero-glow" aria-hidden="true" />
        <div className="nw-wrap nwwu-hero-inner">
          <div>
            <p className="nwwu-pill">
              <AwardIcon size={14} stroke="#C5CAD3" />
              <span>Independent Financial Advice</span>
            </p>
            <h1 className="nwwu-h1">
              Why Choose <span className="nw-accent">Navigate Wealth?</span>
            </h1>
            <p className="nwwu-hero-lead">
              We're not your typical financial advisers. As a truly independent practice, we work
              for you — not product providers, banks, or shareholders. Your financial success is our
              only measure of success.
            </p>
            <div className="nwwu-hero-ctas">
              <Link className="nw-btn nwwu-hero-btn" to={CONSULTATION_PATH}>
                Schedule Free Consultation <ArrowIcon size={18} />
              </Link>
              <WhyUsPartnersDialog groups={PROVIDER_GROUPS} quoteLink={QUOTE_PATH}>
                <button type="button" className="nw-ghost-dark nwwu-hero-ghost">
                  <HandshakeIcon size={17} />
                  View Our Partners
                </button>
              </WhyUsPartnersDialog>
            </div>
          </div>

          <ul className="nwwu-tiles">
            {TRUST_FACTS.map((fact) => (
              <li key={fact.value} className="nwwu-tile">
                <span className="nwwu-tile-icon" aria-hidden="true">
                  <TrustIcon icon={fact.icon} />
                </span>
                <span className="nwwu-tile-v">{fact.value}</span>
                <span className="nwwu-tile-l">{fact.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <WhyUsCompass
        index="01"
        kicker="Our Core Values"
        title="What Makes Us Different"
        lead="Our values aren't just words on a page—they're the foundation of how we serve our clients every single day."
        values={CORE_VALUES}
      />

      {/* The advantage */}
      <section className="nw-sec nwwu-adv" aria-labelledby="nwwu-adv-title">
        <div className="nw-wrap">
          <SectionHead
            index="02"
            kicker="The advantage"
            title="The Navigate Wealth Advantage"
            lead="Experience the difference that comes from working with an adviser who puts your interests first."
            titleId="nwwu-adv-title"
            className="nwwu-adv-head"
          />
          <ul className="nwwu-adv-grid">
            {ADVANTAGES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="nwwu-card">
                <span className="nwwu-card-icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <h3 className="nwwu-card-t">{title}</h3>
                <p className="nwwu-card-d">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How we work with you */}
      <section className="nw-sec nwwu-proc" aria-labelledby="nwwu-proc-title">
        <div className="nw-grid-bg nwwu-proc-grid-bg" aria-hidden="true" />
        <div className="nw-wrap nwwu-proc-inner">
          <div className="nwwu-proc-main">
            <p className="nw-mono nwwu-badge">Our Process</p>
            <h2 id="nwwu-proc-title" className="nwwu-h2 nwwu-proc-title">
              How We Work With You
            </h2>
            <p className="nwwu-proc-lead">
              Our four-step process ensures you receive personalized advice backed by thorough
              research and ongoing support.
            </p>

            <ol className="nwwu-steps">
              {PROCESS_STEPS.map((step) => (
                <li key={step.number} className="nwwu-step-row">
                  <span className="nw-mono nwwu-marker" aria-hidden="true">
                    {step.number}
                  </span>
                  <div className="nwwu-step">
                    <span className="nw-mono nwwu-leg">LEG {step.number}</span>
                    <h3 className="nwwu-step-t">{step.title}</h3>
                    <p className="nwwu-step-d">{step.description}</p>
                    <ul className="nwwu-chips">
                      {step.details.map((detail) => (
                        <li key={detail}>
                          <CheckIcon size={12} stroke="#C5CAD3" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <aside className="nwwu-aside">
            <div className="nwwu-photo">
              <NwImage
                src={consultationImage}
                imageKey={CONSULTATION_IMAGE_KEY}
                alt="Financial planning consultation"
                sizes="(max-width: 1080px) 100vw, 360px"
                hiddenBelow={760}
              />
              <div className="nwwu-photo-cap">
                <h3 className="nwwu-photo-t">Ready to Get Started?</h3>
                <p className="nwwu-photo-p">
                  Book a complimentary consultation to discuss your financial goals, in person or
                  online.
                </p>
              </div>
            </div>
            <Link className="nw-btn nwwu-aside-btn" to={CONSULTATION_PATH}>
              Schedule Free Consultation <ArrowIcon size={18} />
            </Link>
            <div className="nwwu-cred">
              <h4 className="nwwu-cred-t">
                <ShieldCheckIcon size={18} stroke="#4ADE80" />
                Check Our Credentials
              </h4>
              <dl className="nwwu-cred-list">
                {CREDENTIALS.map(({ term, detail }) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{detail}</dd>
                  </div>
                ))}
              </dl>
              <p className="nwwu-cred-p">
                Our authorisation can be confirmed on the FSCA’s public register of financial
                services providers.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* Final call to action */}
      <section className="nw-sec nwwu-cta" aria-labelledby="nwwu-cta-title">
        <div className="nw-wrap">
          <div className="nwwu-cta-box">
            <div className="nw-grid-bg nwwu-cta-grid-bg" aria-hidden="true" />
            <svg
              className="nwwu-cta-art"
              aria-hidden="true"
              focusable="false"
              width="380"
              height="380"
              viewBox="0 0 480 480"
              fill="none"
            >
              <rect
                x="140"
                y="80"
                width="200"
                height="320"
                rx="12"
                stroke="rgba(255,255,255,0.5)"
              />
              <path d="M200 400v-60h80v60" stroke="rgba(255,255,255,0.5)" />
              <path
                d="M190 140h.01M240 140h.01M290 140h.01M190 200h.01M240 200h.01M290 200h.01M190 260h.01M240 260h.01M290 260h.01"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="10"
                strokeLinecap="round"
              />
            </svg>
            <div className="nwwu-cta-copy">
              <h2 id="nwwu-cta-title" className="nwwu-h2 nwwu-cta-title">
                Experience the Navigate Wealth Difference
              </h2>
              <p className="nwwu-cta-lead">
                Discover what truly independent, personalized financial advice looks like. Schedule
                your free consultation today.
              </p>
              <div className="nwwu-cta-actions">
                <Link className="nwwu-cta-light" to={CONSULTATION_PATH}>
                  Schedule Free Consultation <ArrowIcon size={18} />
                </Link>
                <Link className="nwwu-cta-ghost" to={SERVICES_PATH}>
                  Explore Our Services
                </Link>
              </div>
              <dl className="nwwu-cta-facts">
                {TRUST_FACTS.slice(0, 3).map(({ value, label }) => (
                  <div key={value}>
                    <dt>{value}</dt>
                    <dd>{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default NavigatorWhyUsPage;
