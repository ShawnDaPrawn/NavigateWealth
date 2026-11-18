/**
 * Sections of the Navigator /services page. Copy, links and quote routes
 * come from servicesPageData.ts, shared with the live page.
 *
 * The live page opened a consultation pop-up from three places; here, as on
 * the redesigned service pages, those actions go to the consultation page.
 */
import { Link } from 'react-router';
import { ArrowRight, Check, Compass, ShieldCheck } from 'lucide-react';
import { CONSULT_ONLY_SERVICE_ID, SERVICES, WHY_US } from '../../components/pages/servicesPageData';
import { COMPANY } from '../../config/companyFacts';
import { NwImage } from '../components/NwImage';
import { SectionHead } from '../sections/SectionHead';
import { pad2 } from '../sections/format';
import { CardLink, ContactStrip, TrustStrip } from './HomeParts';
import { CONSULTATION_PATH, QUOTE_PATH, SERVICES_H1, saSpelling } from './homeContent';

export function ServicesHero() {
  return (
    <section className="nws-hero nwhm-hero" aria-labelledby="nwsv-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nwhm-glow" aria-hidden="true" />
      <div className="nw-wrap nws-hero-inner nwhm-hero-inner">
        <div>
          <p className="nwhm-pill nwhm-pill--icon">
            <Compass size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Comprehensive Wealth Management</span>
          </p>
          <h1 id="nwsv-title" className="nws-h1 nwhm-h1">
            {SERVICES_H1}
          </h1>
          <p className="nws-slogan">
            Financial Solutions for <span className="nw-accent">Every Stage of Life</span>
          </p>
          <p className="nws-lead">
            From investment management to estate planning, we provide independent, unbiased
            financial advice, compared across the product providers we work with, to find the right
            solution for your goals.
          </p>
          <div className="nws-ctas">
            <Link className="nw-btn nw-btn--lg nwhm-cta-main" to={QUOTE_PATH}>
              Get a Free Quote
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <Link className="nw-ghost-dark nw-btn--lg" to={CONSULTATION_PATH}>
              Book a Consultation
            </Link>
          </div>
          <ul className="nw-trust nw-trust--dark" aria-label="Why clients choose us">
            <li>
              <ShieldCheck size={15} strokeWidth={1.75} aria-hidden="true" />
              FSCA Regulated · FSP {COMPANY.fspNumber}
            </li>
            <li>
              <Check size={14} strokeWidth={1.75} aria-hidden="true" />
              Fiercely Independent
            </li>
            <li>
              <Check size={14} strokeWidth={1.75} aria-hidden="true" />
              Founder-led
            </li>
          </ul>
        </div>

        <nav className="nwsv-index" aria-label="Service index">
          <div className="nwsv-index-head nw-mono">
            <span>Chart your course</span>
            <span>{pad2(SERVICES.length)} services</span>
          </div>
          <ul className="nwsv-index-list">
            {SERVICES.map((service, i) => (
              <li key={service.id}>
                <a href={`#${service.id}`}>
                  <span className="nwsv-index-no nw-mono" aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                  <span className="nwsv-index-t">{service.title}</span>
                  <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="nw-wrap">
        <TrustStrip />
      </div>
    </section>
  );
}

export function ServiceRows({ index }: { index: string }) {
  return (
    <section className="nw-sec nw-sec--white nwsv-list" aria-labelledby="nwsv-list-title">
      <div className="nw-wrap">
        <SectionHead
          index={index}
          kicker="Services"
          title="Our Services"
          titleId="nwsv-list-title"
          lead="Comprehensive wealth management solutions for every stage of your financial journey"
        />
        <ul className="nwsv-rows">
          {SERVICES.map((service, i) => (
            <li key={service.id} id={service.id} className="nwsv-row">
              <div className="nwsv-row-main">
                <span className="nwsv-row-no nw-mono" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
                <h3 className="nwsv-row-t">
                  <CardLink to={service.path}>{service.title}</CardLink>
                </h3>
                <p className="nwsv-row-d">{service.description}</p>
                <div className="nwsv-row-acts">
                  {service.id === CONSULT_ONLY_SERVICE_ID ? (
                    <Link className="nw-outline nw-btn--sm" to={CONSULTATION_PATH}>
                      Book Consult <span className="nw-sr-only">for {service.title}</span>
                    </Link>
                  ) : (
                    <Link
                      className="nw-outline nw-btn--sm"
                      to={`/get-quote/${service.quoteSlug}/contact`}
                    >
                      Get Quote <span className="nw-sr-only">for {service.title}</span>
                    </Link>
                  )}
                </div>
              </div>
              <ul className="nwsv-hl" aria-label={`${service.title} includes`}>
                {service.highlights.map((h) => (
                  <li key={h}>
                    <Check size={15} strokeWidth={1.75} aria-hidden="true" />
                    {saSpelling(h)}
                  </li>
                ))}
              </ul>
              <div className="nwsv-row-side" aria-hidden="true">
                <span className="nwsv-row-img">
                  <NwImage
                    src={service.image}
                    imageKey={service.imageKey}
                    alt=""
                    sizes="200px"
                    width={200}
                    height={136}
                    hiddenBelow={860}
                  />
                </span>
                <span className="nwsv-go">
                  <ArrowRight size={18} strokeWidth={1.75} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function WhyChooseSection({ index }: { index: string }) {
  return (
    <section className="nw-sec nwhm-why" aria-labelledby="nwsv-why-title">
      <div className="nw-grid-bg nwhm-fade-c" aria-hidden="true" />
      <div className="nw-wrap nwhm-rel">
        <SectionHead
          index={index}
          kicker="Why us?"
          title="Why Choose Navigate Wealth?"
          titleId="nwsv-why-title"
          lead="We exist to give you access to the best financial products and unbiased advice — because your goals deserve nothing less."
          center
          dark
        />
        <ul className="nwsv-tiles">
          {WHY_US.map((item) => (
            <li key={item.title} className="nwsv-tile">
              <span className="nwsv-tile-i" aria-hidden="true">
                <item.icon className="nwsv-tile-svg" />
              </span>
              <h3 className="nwsv-tile-t">{item.title}</h3>
              <p className="nwsv-tile-d">{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ServicesCta() {
  return (
    <section className="nw-sec nwhm-close" aria-labelledby="nwsv-cta-title">
      <div className="nw-wrap nwsv-cta-inner">
        <p className="nwhm-live">
          <span className="nwhm-live-dot" aria-hidden="true" />
          Free initial consultation
        </p>
        <h2 id="nwsv-cta-title" className="nw-sec-title">
          Ready to Take the First Step?
        </h2>
        <p className="nw-sec-lead">
          Schedule a complimentary, no-obligation consultation to discuss how our services can help
          you reach your financial goals.
        </p>
        <div className="nws-ctas nwsv-cta-row">
          <Link className="nw-btn nw-btn--lg nwhm-cta-main" to={CONSULTATION_PATH}>
            Schedule Consultation
            <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <Link className="nw-outline nw-btn--lg" to={QUOTE_PATH}>
            Get a Free Quote
          </Link>
        </div>
        <ContactStrip center />
      </div>
    </section>
  );
}
