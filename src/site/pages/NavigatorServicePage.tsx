/**
 * NavigatorServicePage — the redesigned layout for all eight service pages.
 *
 * Takes exactly the props of the live ServicePageTemplate, so each page's
 * content stays in its own file and serves both designs. The same SEO tags
 * and JSON-LD are emitted (serviceStructuredData.ts), every route and link
 * target is unchanged, and the H1 leads with what people search for.
 */
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, CircleCheck, ShieldCheck } from 'lucide-react';
import { SEO } from '../../components/seo/SEO';
import { serviceShareImage } from '../../components/seo/shareImages';
import { COMPANY } from '../../config/companyFacts';
import type {
  CoverContent,
  ServicePageConfig,
  ServicePageTemplateProps,
} from '../../components/templates/ServicePageTemplate';
import { buildServiceStructuredData } from '../../components/templates/serviceStructuredData';
import { NwImage } from '../components/NwImage';
import { ApproachSteps } from '../sections/ApproachSteps';
import { CallbackForm } from '../sections/CallbackForm';
import { FaqRail } from '../sections/FaqRail';
import { PartnerTiles } from '../sections/PartnerTiles';
import { ProductShowcase, type ShowcaseProduct } from '../sections/ProductShowcase';
import { pad2 } from '../sections/format';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/service.css';

const CONSULTATION_PATH = '/schedule-consultation';
const DEFAULT_QUOTE_PATH = '/get-quote';

type ProductGroup = ServicePageConfig['individuals'];

function toProducts(group: ProductGroup): ShowcaseProduct[] {
  const products: ShowcaseProduct[] = [];
  for (const { id, label } of group.toggleOptions) {
    const product: CoverContent | undefined = group.products[id];
    if (!product) continue;
    products.push({
      id,
      label,
      title: product.title,
      description: product.description,
      benefitsDescription: product.benefitsDescription,
      features: product.features,
      benefits: product.benefits,
      image: product.image,
      imageKey: product.imageKey,
      alt: group.imageAltMap[id] ?? product.title,
    });
  }
  return products;
}

/** Breadcrumb URLs in the config are absolute; links inside the app are paths. */
function toPath(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}

export function NavigatorServicePage({ config, seoData, children }: ServicePageTemplateProps) {
  const { hero, individuals, business, approach, partners, faqs, form } = config;
  const quotePath = hero.quoteLink ?? DEFAULT_QUOTE_PATH;
  const heading = hero.searchHeading ?? { lead: hero.titleLine1, accent: hero.titleLine2 };
  const slogan = hero.searchHeading ? `${hero.titleLine1} ${hero.titleLine2}`.trim() : null;
  const StatusIcon: ComponentType<{ className?: string }> = hero.statusIcon ?? CircleCheck;

  const sections: { id: string; label: string }[] = [
    { id: 'individuals', label: individuals.badgeText },
    { id: 'businesses', label: business.badgeText },
  ];
  if (approach) sections.push({ id: 'approach', label: 'Our Approach' });
  if (partners.logos.length > 0) sections.push({ id: 'partners', label: 'Partners' });
  if (faqs && faqs.length > 0) sections.push({ id: 'faq', label: 'FAQ' });
  const indexOf = (id: string) => pad2(sections.findIndex((s) => s.id === id) + 1);

  return (
    <div className="nw-site nws">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        ogImage={serviceShareImage(config.seoKey) ?? hero.heroImage}
        structuredData={buildServiceStructuredData(config, seoData)}
      />

      <section className="nws-hero" aria-labelledby="nws-title">
        <div className="nw-grid-bg" aria-hidden="true" />
        <div className="nw-wrap nws-hero-inner">
          <div>
            <nav aria-label="Breadcrumb" className="nws-crumbs nw-mono">
              <ol>
                {config.breadcrumbs.map((crumb) => (
                  <li key={crumb.name}>
                    {crumb.url ? (
                      <Link to={toPath(crumb.url)}>{crumb.name}</Link>
                    ) : (
                      <span aria-current="page">{crumb.name}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            <h1 id="nws-title" className="nws-h1">
              {heading.lead}
              {heading.accent ? (
                <>
                  {' '}
                  <span className="nw-accent">{heading.accent}</span>
                </>
              ) : null}
            </h1>
            {slogan ? <p className="nws-slogan">{slogan}</p> : null}
            <p className="nws-lead">{hero.description}</p>
            <div className="nws-ctas">
              <Link className="nw-btn nw-btn--lg" to={CONSULTATION_PATH}>
                Book a Free Consultation
                <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </Link>
              <Link className="nw-ghost-dark nw-btn--lg" to={quotePath}>
                Get a Quote
              </Link>
            </div>
            <ul className="nw-trust nw-trust--dark" aria-label="Why clients choose us">
              <li>
                <ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true" />
                FSCA-authorised · FSP {COMPANY.fspNumber}
              </li>
              <li>
                <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                Independent advice
              </li>
              <li>
                <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                Free first consultation
              </li>
            </ul>
            {hero.stats.length > 0 ? (
              <dl className="nws-stats">
                {hero.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd className="nw-mono">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
          <div className="nws-media">
            <NwImage
              src={hero.heroImage}
              imageKey={hero.heroImageKey}
              alt={hero.heroImageAlt}
              sizes="(min-width: 1320px) 600px, (min-width: 1000px) 46vw, 100vw"
              priority
              hiddenBelow={760}
            />
            <div className="nws-status">
              <span className="nws-status-icon" aria-hidden="true">
                <StatusIcon className="nws-status-svg" />
              </span>
              <span>
                <span className="nws-status-l nw-mono">{hero.statusLabel}</span>
                <span className="nws-status-v">{hero.statusValue}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <nav aria-label="On this page" className="nws-subnav">
        <div className="nw-wrap nws-subnav-row">
          <div className="nws-subnav-links">
            <span className="nws-subnav-label nw-mono" aria-hidden="true">
              On this page
            </span>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.label}
              </a>
            ))}
          </div>
          <Link className="nw-btn nw-btn--sm" to={quotePath}>
            Get a Quote
          </Link>
        </div>
      </nav>

      <ProductShowcase
        id="individuals"
        index={indexOf('individuals')}
        kicker={individuals.badgeText}
        title={individuals.title}
        subtitle={individuals.subtitle}
        groupLabel={individuals.badgeText}
        tone="white"
        chipLabel={individuals.cardLabel}
        chipIcon={individuals.cardIcon}
        products={toProducts(individuals)}
        quoteLink={individuals.quoteLink}
        consultationLink={CONSULTATION_PATH}
        ariaLabel={individuals.ariaLabel}
      />

      <ProductShowcase
        id="businesses"
        index={indexOf('businesses')}
        kicker={business.badgeText}
        title={business.title}
        subtitle={business.subtitle}
        groupLabel={business.badgeText}
        tone="paper"
        flip
        chipLabel={business.cardLabel}
        chipIcon={business.cardIcon}
        products={toProducts(business)}
        quoteLink={business.quoteLink}
        consultationLink={CONSULTATION_PATH}
        ariaLabel={business.ariaLabel}
      />

      {approach ? (
        <ApproachSteps
          index={indexOf('approach')}
          title={approach.serviceName}
          lead={approach.headerDescription}
          steps={approach.steps}
          promise={approach.commitmentText}
          quoteLink={quotePath}
        />
      ) : null}

      <PartnerTiles
        index={indexOf('partners')}
        kicker={partners.subHeading ?? 'Trusted Partners'}
        title={partners.heading ?? "We work with South Africa's leading insurers"}
        partners={partners.logos}
      />

      {faqs && faqs.length > 0 ? (
        <FaqRail
          index={indexOf('faq')}
          faqs={faqs}
          lead={
            config.faqSubtitle ??
            `Clear answers to the questions clients ask us most about ${form.specialistType}.`
          }
          action={{ label: 'Get a Quote', to: quotePath }}
        />
      ) : null}

      <CallbackForm
        topic={form.specialistType}
        serviceName={config.structuredDataServiceName}
        selectLabel={form.selectLabel}
        selectPlaceholder={form.selectPlaceholder}
        options={form.selectOptions}
        messagePlaceholder={form.textareaPlaceholder}
      />

      {children}
    </div>
  );
}
