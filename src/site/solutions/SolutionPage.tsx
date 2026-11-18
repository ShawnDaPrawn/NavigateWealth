/**
 * SolutionPage — the Navigator layout shared by the three Solutions pages
 * (individuals, businesses, advisers). Each page passes its own copy (most of
 * it from solutionsContent.ts, shared with the live design) and its SEO tags
 * as children. Built from the shared blocks: the service-page hero, SectionHead,
 * ApproachSteps and FaqRail.
 *
 * Actions keep the live pages' behaviour exactly: "Get Started" goes where the
 * live hero sent it, and the consultation and quote buttons open the same
 * ConsultationModal and GetQuoteModal, with the same props, as the live page.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Calendar, Check, type LucideIcon } from 'lucide-react';
import { TRUST_FACTS } from '../../config/companyFacts';
import { ConsultationModal } from '../../components/modals/ConsultationModal';
import { GetQuoteModal } from '../../components/modals/GetQuoteModal';
import { NwImage } from '../components/NwImage';
import { ApproachSteps } from '../sections/ApproachSteps';
import { FaqRail } from '../sections/FaqRail';
import { SectionHead } from '../sections/SectionHead';
import { pad2 } from '../sections/format';
import { AudienceNav } from './AudienceNav';
import { ClosingCta } from './ClosingCta';
import { CompassArt } from './SolutionArt';
import { HOW_WE_WORK, type FaqEntry, type SolutionAudience } from './navigatorContent';
import type {
  SolutionFeature,
  SolutionImage,
  SolutionService,
  SolutionStage,
} from './solutionsContent';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/service.css';
import '../styles/solutions.css';

/** Where the FAQ rail's quote button goes: the site's quote gateway. */
const QUOTE_PATH = '/get-quote';

export interface SolutionPageConfig {
  audience: SolutionAudience;
  hero: {
    badge: string;
    /** Omit for the plain rule the individuals board uses. */
    badgeIcon?: LucideIcon;
    /** The search-led H1, with its closing words set in the accent. */
    heading: { lead: string; accent: string };
    /** The live page's headline, kept beneath the H1 where it differs. */
    slogan?: string;
    lead: string;
    /** The live hero's "Get Started" button and where it went. */
    start: { label: string; to: string };
  };
  journey: {
    kicker: string;
    title: string;
    text: string;
    stages: SolutionStage[];
    image: SolutionImage;
    badge: { icon: LucideIcon; label: string; value: string };
  };
  services: { kicker: string; title: string; lead: string; items: SolutionService[] };
  band: { kicker: string; title: string; text: string; action: string };
  digital: {
    kicker: string;
    title: string;
    text: string;
    note: string;
    features: SolutionFeature[];
    art: ReactNode;
  };
  faqs: FaqEntry[];
  closing: { title: string; text: string };
  /** The live page's quote button label (it opens GetQuoteModal). */
  quoteLabel: string;
  /** "Free consultation · No obligation · …", as on the live page. */
  ticks: readonly string[];
}

interface SolutionPageProps {
  config: SolutionPageConfig;
  /** The page's <SEO> tags. */
  children: ReactNode;
}

function Ticks({ items, className }: { items: readonly string[]; className: string }) {
  return (
    <ul className={className}>
      {items.map((t) => (
        <li key={t}>
          <Check size={14} strokeWidth={1.75} aria-hidden="true" />
          {t}
        </li>
      ))}
    </ul>
  );
}

export function SolutionPage({ config, children }: SolutionPageProps) {
  const { audience, hero, journey, services, band, digital, faqs, closing, quoteLabel } = config;
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const BadgeIcon = hero.badgeIcon;
  const JourneyIcon = journey.badge.icon;
  const openQuote = () => setQuoteOpen(true);
  const openConsult = () => setConsultOpen(true);

  return (
    <div className={`nw-site nwsol-page nwsol-page--${audience}`}>
      {children}

      <section className="nws-hero" aria-labelledby="nwsol-title">
        <div className="nw-grid-bg" aria-hidden="true" />
        <div className="nw-wrap nws-hero-inner">
          <div>
            <p className="nwsol-badge">
              {BadgeIcon ? (
                <BadgeIcon size={14} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <span className="nwsol-badge-rule" aria-hidden="true" />
              )}
              {hero.badge}
            </p>
            <h1 id="nwsol-title" className="nws-h1">
              {hero.heading.lead} <span className="nw-accent">{hero.heading.accent}</span>
            </h1>
            {hero.slogan ? <p className="nws-slogan">{hero.slogan}</p> : null}
            <p className="nws-lead">{hero.lead}</p>
            <div className="nws-ctas">
              <button
                type="button"
                className="nw-btn nw-btn--lg"
                aria-haspopup="dialog"
                onClick={openConsult}
              >
                Book a Free Consultation
                <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <Link className="nw-ghost-dark nw-btn--lg" to={hero.start.to}>
                {hero.start.label}
              </Link>
            </div>
            <Ticks items={config.ticks} className="nw-trust nw-trust--dark" />
            <dl className="nws-stats">
              {TRUST_FACTS.slice(0, 3).map(({ value, label }) => (
                <div key={value}>
                  <dt>{label}</dt>
                  <dd className="nw-mono">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <AudienceNav current={audience} />
        </div>
      </section>

      <section className="nw-sec nw-sec--white" aria-labelledby="nwsol-journey-title">
        <div className="nw-wrap nwsol-split">
          <div>
            <SectionHead
              index="01"
              kicker={journey.kicker}
              title={journey.title}
              titleId="nwsol-journey-title"
              lead={journey.text}
            />
            <ol className="nwsol-stages">
              {journey.stages.map(({ icon: Icon, title, description }) => (
                <li key={title} className="nwsol-stage">
                  <span className="nwsol-stage-icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <span className="nwsol-stage-t">{title}</span>
                  <span className="nwsol-stage-d">{description}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="nwsol-figure">
            <div className="nwsol-figure-media">
              <NwImage
                src={journey.image.src}
                alt={journey.image.alt}
                sizes="(min-width: 1320px) 600px, (min-width: 1000px) 46vw, 100vw"
                hiddenBelow={760}
              />
            </div>
            <p className="nwsol-figbadge">
              <span className="nwsol-figbadge-icon" aria-hidden="true">
                <JourneyIcon size={18} strokeWidth={1.75} />
              </span>
              <span>
                <span className="nwsol-figbadge-l nw-mono">{journey.badge.label}</span>
                <span className="nwsol-figbadge-v">{journey.badge.value}</span>
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="nw-sec nw-sec--paper" aria-labelledby="nwsol-services-title">
        <div className="nw-wrap">
          <div className="nwsol-head-row">
            <SectionHead
              index="02"
              kicker={services.kicker}
              title={services.title}
              titleId="nwsol-services-title"
              lead={services.lead}
            />
            <button type="button" className="nw-btn" aria-haspopup="dialog" onClick={openQuote}>
              {quoteLabel}
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <ul
            className={
              services.items.length === 4 ? 'nwsol-svc-grid nwsol-svc-grid--four' : 'nwsol-svc-grid'
            }
          >
            {services.items.map(({ icon: Icon, title, description, link, features }, i) => (
              <li key={title} className="nwsol-svc">
                <div className="nwsol-svc-top">
                  <span className="nwsol-svc-icon" aria-hidden="true">
                    <Icon size={22} strokeWidth={1.75} />
                  </span>
                  <span className="nwsol-svc-no nw-mono" aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                </div>
                <div>
                  <h3 className="nwsol-svc-t">
                    <Link className="nwsol-svc-link" to={link}>
                      {title}
                    </Link>
                  </h3>
                  <p className="nwsol-svc-d">{description}</p>
                </div>
                <ul className="nwsol-svc-feats">
                  {features.map((f) => (
                    <li key={f}>
                      <Check size={15} strokeWidth={1.75} aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <span className="nwsol-svc-more" aria-hidden="true">
                  {link.startsWith('/contact') ? 'Discuss with us' : 'Learn More'}
                  <ArrowRight size={15} strokeWidth={1.75} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="nwsol-band" aria-labelledby="nwsol-band-title">
        <div className="nw-grid-bg" aria-hidden="true" />
        <CompassArt className="nwsol-band-art" />
        <div className="nw-wrap nwsol-band-row">
          <div className="nwsol-band-copy">
            <p className="nw-kicker nw-kicker--dark nw-mono">{band.kicker}</p>
            <h2 id="nwsol-band-title" className="nw-sec-title nwsol-band-title">
              {band.title}
            </h2>
            <p className="nw-sec-lead nwsol-band-text">{band.text}</p>
          </div>
          <button
            type="button"
            className="nw-btn nw-btn--lg nwsol-band-cta"
            aria-haspopup="dialog"
            onClick={openConsult}
          >
            <Calendar size={18} strokeWidth={1.75} aria-hidden="true" />
            {band.action}
          </button>
        </div>
      </section>

      <section className="nw-sec nw-sec--white" aria-labelledby="nwsol-digital-title">
        <div className="nw-wrap nwsol-split">
          {digital.art}
          <div>
            <SectionHead
              index="03"
              kicker={digital.kicker}
              title={digital.title}
              titleId="nwsol-digital-title"
              lead={digital.text}
            />
            <p className="nwsol-note">{digital.note}</p>
            <ul className="nwsol-feats">
              {digital.features.map(({ icon: Icon, title, description }) => (
                <li key={title} className="nwsol-feat">
                  <span className="nwsol-feat-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="nwsol-feat-t">{title}</span>
                    <span className="nwsol-feat-d">{description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ApproachSteps
        index="04"
        title={HOW_WE_WORK.title}
        lead={HOW_WE_WORK.lead}
        steps={HOW_WE_WORK.steps}
        quoteLink={QUOTE_PATH}
      />

      <FaqRail
        index="05"
        faqs={faqs}
        lead="Answers to the questions South Africans ask us most about independent financial advice."
        quoteLink={QUOTE_PATH}
      />

      <ClosingCta
        title={closing.title}
        text={closing.text}
        art="compass"
        actions={
          <>
            <button
              type="button"
              className="nw-btn nw-btn--lg"
              aria-haspopup="dialog"
              onClick={openQuote}
            >
              {quoteLabel}
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="nw-ghost-dark nw-btn--lg"
              aria-haspopup="dialog"
              onClick={openConsult}
            >
              <Calendar size={18} strokeWidth={1.75} aria-hidden="true" />
              Book Consultation
            </button>
          </>
        }
        footer={<Ticks items={config.ticks} className="nw-trust nw-trust--dark nwsol-cta-ticks" />}
      />

      <GetQuoteModal isOpen={quoteOpen} onClose={() => setQuoteOpen(false)} />
      <ConsultationModal isOpen={consultOpen} onClose={() => setConsultOpen(false)} />
    </div>
  );
}
