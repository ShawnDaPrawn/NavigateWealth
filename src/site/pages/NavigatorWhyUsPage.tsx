/**
 * /why-us in the Navigator design. Copy comes from the live WhyUsPage (shared
 * through whyUsContent.ts); facts about the firm from companyFacts.ts. The H1
 * leads with the searched-for phrase and keeps the live headline beneath it.
 *
 * Behaviour matches the live page: every "Schedule Free Consultation" opens
 * the same ConsultationModal, "View Our Partners" opens the partner roster,
 * reviews appear only once there are published ones to trace.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Award, Check, Handshake, ShieldCheck } from 'lucide-react';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { ConsultationModal } from '../../components/modals/ConsultationModal';
import { TRUST_FACTS } from '../../config/companyFacts';
import consultationImage from 'figma:asset/61c60b4a45c33d3564e85aaf184ff3f3b9db37f8.png';
import { NwImage } from '../components/NwImage';
import { SectionHead } from '../sections/SectionHead';
import { CompanyReviews } from '../company/CompanyReviews';
import { ClosingCta } from '../solutions/ClosingCta';
import { CompassValues } from '../solutions/CompassValues';
import { PartnersDialog } from '../solutions/PartnersDialog';
import {
  CORE_VALUES,
  CREDENTIALS,
  DIFFERENTIATORS,
  PROCESS_STEPS,
} from '../solutions/whyUsContent';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/service.css';
import '../styles/solutions.css';

/** The consultation photograph's generated AVIF/WebP variants. */
const CONSULTATION_IMAGE_KEY = '61c60b4a45c33d3564e85aaf184ff3f3b9db37f8';

export function NavigatorWhyUsPage() {
  const [consultOpen, setConsultOpen] = useState(false);
  const openConsult = () => setConsultOpen(true);
  const seo = getSEOData('why-us');

  return (
    <div className="nw-site nwsol-why">
      <SEO
        {...seo}
        structuredData={createWebPageSchema(seo.title, seo.description, seo.canonicalUrl)}
      />

      <section className="nws-hero nwsol-why-hero" aria-labelledby="nwsol-title">
        <div className="nw-grid-bg" aria-hidden="true" />
        <div className="nw-wrap nws-hero-inner">
          <div>
            <p className="nwsol-badge">
              <Award size={14} strokeWidth={1.75} aria-hidden="true" />
              Independent Financial Advice
            </p>
            <h1 id="nwsol-title" className="nws-h1">
              Why Choose an <span className="nw-accent">Independent Financial Advisor</span>
            </h1>
            <p className="nws-slogan">Why Choose Navigate Wealth?</p>
            <p className="nws-lead">
              We&apos;re not your typical financial advisers. As a truly independent practice, we
              work for you — not product providers, banks, or shareholders. Your financial success
              is our only measure of success.
            </p>
            <div className="nws-ctas">
              <button
                type="button"
                className="nw-btn nw-btn--lg"
                aria-haspopup="dialog"
                onClick={openConsult}
              >
                Schedule Free Consultation
                <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <PartnersDialog
                trigger={
                  <button type="button" className="nw-ghost-dark nw-btn--lg">
                    <Handshake size={17} strokeWidth={1.75} aria-hidden="true" />
                    View Our Partners
                  </button>
                }
              />
            </div>
          </div>
          <ul className="nwsol-tiles" aria-label="Credentials">
            {TRUST_FACTS.map(({ value, label, icon: Icon }) => (
              <li key={value} className="nwsol-tile">
                <span className="nwsol-tile-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <span className="nwsol-tile-v">{value}</span>
                <span className="nwsol-tile-l">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="nw-sec nwsol-values-sec" aria-labelledby="nwsol-values-title">
        <div className="nw-wrap">
          <SectionHead
            index="01"
            kicker="Our Core Values"
            title="What Makes Us Different"
            titleId="nwsol-values-title"
            lead="Our values aren't just words on a page—they're the foundation of how we serve our clients every single day."
            center
          />
          <CompassValues values={CORE_VALUES} />
        </div>
      </section>

      <section className="nw-sec nw-sec--white" aria-labelledby="nwsol-adv-title">
        <div className="nw-wrap">
          <SectionHead
            index="02"
            kicker="The advantage"
            title="The Navigate Wealth Advantage"
            titleId="nwsol-adv-title"
            lead="Experience the difference that comes from working with an adviser who puts your interests first."
          />
          <ul className="nwsol-adv">
            {DIFFERENTIATORS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="nwsol-adv-card">
                <span className="nwsol-svc-icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.75} />
                </span>
                <h3 className="nwsol-adv-t">{title}</h3>
                <p className="nwsol-adv-d">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="nw-sec nwsol-process" aria-labelledby="nwsol-process-title">
        <div className="nw-grid-bg" aria-hidden="true" />
        <div className="nw-wrap nwsol-process-row">
          <div className="nwsol-process-main">
            <SectionHead
              index="03"
              kicker="Our Process"
              title="How We Work With You"
              titleId="nwsol-process-title"
              lead="Our four-step process ensures you receive personalized advice backed by thorough research and ongoing support."
              dark
            />
            <ol className="nwsol-steps">
              {PROCESS_STEPS.map((step) => (
                <li key={step.number} className="nwsol-step">
                  <span className="nwsol-step-no nw-mono" aria-hidden="true">
                    {step.number}
                  </span>
                  <div className="nwsol-step-card">
                    <span className="nwsol-step-leg nw-mono" aria-hidden="true">
                      Leg {step.number}
                    </span>
                    <h3 className="nwsol-step-t">{step.title}</h3>
                    <p className="nwsol-step-d">{step.description}</p>
                    <ul className="nwsol-step-details">
                      {step.details.map((d) => (
                        <li key={d}>
                          <Check size={13} strokeWidth={1.75} aria-hidden="true" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <aside className="nwsol-process-aside" aria-label="Book a consultation">
            <div className="nwsol-ready">
              <NwImage
                src={consultationImage}
                imageKey={CONSULTATION_IMAGE_KEY}
                alt="Financial planning consultation"
                sizes="(min-width: 1000px) 420px, 100vw"
                hiddenBelow={760}
              />
              <div className="nwsol-ready-copy">
                <h3 className="nwsol-ready-t">Ready to Get Started?</h3>
                <p className="nwsol-ready-d">
                  Book a complimentary consultation to discuss your financial goals, in person or
                  online.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="nw-btn nw-btn--lg nwsol-ready-cta"
              aria-haspopup="dialog"
              onClick={openConsult}
            >
              Schedule Free Consultation
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <div className="nwsol-creds">
              <h3 className="nwsol-creds-t">
                <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
                Check Our Credentials
              </h3>
              <dl className="nwsol-creds-list">
                {CREDENTIALS.map(({ term, detail }) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{detail}</dd>
                  </div>
                ))}
              </dl>
              <p className="nwsol-creds-note">
                Our authorisation can be confirmed on the FSCA’s public register of financial
                services providers.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <CompanyReviews />

      <ClosingCta
        padTop
        art="building"
        title="Experience the Navigate Wealth Difference"
        text="Discover what truly independent, personalized financial advice looks like. Schedule your free consultation today."
        actions={
          <>
            <button
              type="button"
              className="nw-btn nw-btn--lg"
              aria-haspopup="dialog"
              onClick={openConsult}
            >
              Schedule Free Consultation
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <Link className="nw-ghost-dark nw-btn--lg" to="/services">
              Explore Our Services
            </Link>
          </>
        }
        footer={
          <dl className="nws-stats nwsol-cta-stats">
            {TRUST_FACTS.slice(0, 3).map(({ value, label }) => (
              <div key={value}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        }
      />

      <ConsultationModal isOpen={consultOpen} onClose={() => setConsultOpen(false)} />
    </div>
  );
}
