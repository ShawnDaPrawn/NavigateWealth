/**
 * NavigatorAboutPage — the About page in the Navigator design.
 *
 * Same SEO call and AboutPage JSON-LD as the live page; the H1 leads with what
 * people search for and keeps the live headline ("Your Trusted Financial
 * Partner") beneath it. Every fact about the firm is read from
 * companyFacts.ts, the four topics from aboutContent.ts (shared with the live
 * page), and every action of the live page is kept: the consultation and
 * providers modals, /legal, /careers, /press and the #founder anchor.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowRight, Calendar, Check, Shield } from 'lucide-react';
import { SEO, createAboutPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { ConsultationModal } from '../../components/modals/ConsultationModal';
import { ProvidersModal } from '../../components/modals/ProvidersModal';
import { COMPANY, FOUNDER, TRUST_FACTS } from '../../config/companyFacts';
import { getOptimizedFallbackUrl } from '../../utils/optimizedImages';
import { NwImage } from '../components/NwImage';
import { SectionHead } from '../sections/SectionHead';
import { pad2 } from '../sections/format';
import { CompanyHero } from '../company/CompanyHero';
import { CompanyReviews } from '../company/CompanyReviews';
import { FactList, type Fact } from '../company/FactList';
import { ABOUT_SECTIONS, ABOUT_SECTION_KEYS, type AboutSectionKey } from '../company/aboutContent';
import { useTabs } from '../company/useTabs';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/service.css';
import '../styles/company.css';

const REGISTER_FACTS: Fact[] = [
  { term: 'Trading name', value: COMPANY.tradingName },
  { term: 'Legal name', value: COMPANY.legalName },
  { term: 'Registration', value: COMPANY.registrationNumber, mono: true },
  { term: 'FSP number', value: COMPANY.fspNumber, mono: true, accent: true },
  { term: 'Authorised', value: `${COMPANY.fscaAuthorisedOn} · FSCA` },
  { term: 'Office', value: COMPANY.office },
  { term: 'Languages', value: COMPANY.languages.join(', ') },
];

function scrollToFounder() {
  document.getElementById('founder')?.scrollIntoView({ behavior: 'smooth' });
}

export function NavigatorAboutPage() {
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [providersOpen, setProvidersOpen] = useState(false);
  const tabs = useTabs<AboutSectionKey>(ABOUT_SECTION_KEYS, 'mission');
  const { hash } = useLocation();
  const seoData = getSEOData('about');

  // /about#founder (linked from the Team page) lands on the founder's note.
  // A frame's delay lets ScrollToTop's route-change reset run first.
  useEffect(() => {
    if (hash !== '#founder') return;
    const frame = requestAnimationFrame(scrollToFounder);
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  const openConsultation = () => setConsultationOpen(true);

  return (
    <div className="nw-site nwx-about">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={createAboutPageSchema()}
      />

      <CompanyHero
        titleId="nwx-about-title"
        pillIcon={Shield}
        pill={`FSCA-authorised · FSP ${COMPANY.fspNumber}`}
        title={
          <>
            Independent Financial Advisors, <span className="nw-accent">Founded in Pretoria</span>
          </>
        }
        slogan="Your Trusted Financial Partner"
        lead="Navigate Wealth is an independent, founder-led practice that helps individuals and families build, protect, and transfer wealth through comprehensive financial planning and investment management."
        actions={
          <>
            <button type="button" className="nw-btn nw-btn--lg" onClick={scrollToFounder}>
              Meet Our Founder
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button type="button" className="nw-ghost-dark nw-btn--lg" onClick={openConsultation}>
              Schedule Consultation
            </button>
          </>
        }
        aside={
          <aside className="nwco-card-dark" aria-label="On the register">
            <div className="nwco-card-head">
              <p className="nwco-card-label nw-mono">On the register</p>
              <span className="nwco-status nwco-status--dark">Authorised</span>
            </div>
            <FactList tone="dark" facts={REGISTER_FACTS} />
          </aside>
        }
      />

      <section className="nw-sec nw-sec--paper" aria-labelledby="nwx-about-discover">
        <div className="nw-wrap">
          <SectionHead
            kicker="Learn More About Us"
            title="Discover Navigate Wealth"
            titleId="nwx-about-discover"
            lead="Select a topic to learn more about our company, values, and commitment to excellence."
          />
          <div className="nwco-discover">
            <div role="tablist" aria-label="About Navigate Wealth" className="nwco-segs">
              {ABOUT_SECTION_KEYS.map((key, i) => (
                <button
                  key={key}
                  ref={tabs.tabRef(key)}
                  type="button"
                  role="tab"
                  id={`nwx-about-tab-${key}`}
                  aria-selected={tabs.active === key}
                  aria-controls={`nwx-about-panel-${key}`}
                  tabIndex={tabs.active === key ? 0 : -1}
                  className="nwco-seg"
                  onClick={() => tabs.setActive(key)}
                  onKeyDown={tabs.onKeyDown}
                >
                  <span className="nwco-seg-no nw-mono" aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                  <span className="nwco-seg-label">{ABOUT_SECTIONS[key].label}</span>
                </button>
              ))}
            </div>

            {ABOUT_SECTION_KEYS.map((key) => {
              const section = ABOUT_SECTIONS[key];
              return (
                <div
                  key={key}
                  role="tabpanel"
                  id={`nwx-about-panel-${key}`}
                  aria-labelledby={`nwx-about-tab-${key}`}
                  hidden={tabs.active !== key}
                  className="nwco-tabpanel nw-in"
                >
                  <h3 className="nwco-tabpanel-title">{section.title}</h3>
                  <p className="nwco-tabpanel-lead">{section.description}</p>
                  <ul className="nwco-points">
                    {section.content.map((item, i) => (
                      <li key={item.title} className="nwco-point">
                        <span className="nwco-point-no nw-mono" aria-hidden="true">
                          {pad2(i + 1)}
                        </span>
                        <h4>{item.title}</h4>
                        <p>{item.text}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="nwco-tabpanel-cta">
                    {key === 'partners' ? (
                      <button
                        type="button"
                        className="nw-btn"
                        onClick={() => setProvidersOpen(true)}
                      >
                        View Our Partners
                        <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    ) : key === 'licensing' ? (
                      <Link className="nw-btn" to="/legal">
                        Legal Information
                        <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                      </Link>
                    ) : (
                      <button type="button" className="nw-btn" onClick={openConsultation}>
                        <Calendar size={16} strokeWidth={1.75} aria-hidden="true" />
                        Schedule a Consultation
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="founder"
        className="nw-sec nw-sec--white nwco-founder"
        aria-labelledby="nwx-about-founder"
      >
        <div className="nw-wrap nwco-founder-grid">
          <figure className="nwco-portrait">
            <div className="nwco-portrait-frame">
              <NwImage
                src={getOptimizedFallbackUrl(FOUNDER.imageKey)}
                imageKey={FOUNDER.imageKey}
                alt={`${FOUNDER.name}, ${FOUNDER.title} of ${COMPANY.tradingName}`}
                sizes="(min-width: 1000px) 560px, 100vw"
                width={1254}
                height={1254}
              />
            </div>
            <figcaption className="nwco-portrait-cap">
              <span>
                <span className="nwco-portrait-name">{FOUNDER.name}</span>
                <span className="nwco-portrait-role">{FOUNDER.title}</span>
              </span>
              <span className="nwco-portrait-tag nw-mono">FSP {COMPANY.fspNumber}</span>
            </figcaption>
          </figure>
          <div>
            <SectionHead
              kicker="Founder-led practice"
              title="A Note From Our Founder"
              titleId="nwx-about-founder"
            />
            <div className="nwco-note">
              {FOUNDER.note.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="nwco-sign">
              <span aria-hidden="true" />
              {FOUNDER.name}, {FOUNDER.title}
            </p>
            <button
              type="button"
              className="nw-btn nw-btn--lg nwco-note-cta"
              onClick={openConsultation}
            >
              <Calendar size={18} strokeWidth={1.75} aria-hidden="true" />
              Book a Consultation
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <CompanyReviews />

      <section className="nw-sec nwco-closing" aria-labelledby="nwx-about-next">
        <div className="nw-wrap nwco-closing-inner">
          <h2 id="nwx-about-next" className="nw-sec-title">
            Work With Us or Stay Informed
          </h2>
          <p className="nw-sec-lead">
            Discover exciting career opportunities with Navigate Wealth or stay up to date with our
            latest news, announcements, and industry insights.
          </p>
          <div className="nwco-closing-ctas">
            <Link className="nw-btn nw-btn--lg" to="/careers">
              Explore Careers
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <Link className="nw-outline nw-btn--lg" to="/press">
              For the Press
            </Link>
          </div>
          <ul className="nw-trust nwco-closing-trust" aria-label="Checkable facts">
            {TRUST_FACTS.map(({ value, label }) => (
              <li key={value}>
                <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                {value} — {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ConsultationModal open={consultationOpen} onOpenChange={setConsultationOpen} />
      <ProvidersModal isOpen={providersOpen} onClose={() => setProvidersOpen(false)} />
    </div>
  );
}
