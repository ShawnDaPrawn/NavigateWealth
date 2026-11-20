/**
 * NavigatorServicePage — the redesigned layout for all eight service pages.
 *
 * Takes exactly the props of the live ServicePageTemplate, so each page's
 * content stays in its own file and serves both designs. The same SEO tags
 * and JSON-LD are emitted (serviceStructuredData.ts) and every route and link
 * target is unchanged. The eight boards come in three layouts; serviceBoards.ts
 * says which page uses which, and what else varies between them.
 */
import { Link } from 'react-router';
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
import { ServiceIcon } from '../sections/serviceIcons';
import { pad2 } from '../sections/format';
import { serviceBoard, type ServiceBoard } from './serviceBoards';
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

/** "For Individuals" → "Individuals", the jump bar's shorter labels. */
function shortLabel(label: string): string {
  return label.replace(/^For\s+/i, '');
}

type Crumb = ServicePageConfig['breadcrumbs'][number];

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="nws-crumbs nw-mono">
      <ol>
        {crumbs.map((crumb) => (
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
  );
}

interface HeroProps {
  config: ServicePageConfig;
  board: ServiceBoard;
  quotePath: string;
}

function Hero({ config, board, quotePath }: HeroProps) {
  const { hero } = config;
  const { layout } = board;
  const crumbs = board.shortCrumbs
    ? config.breadcrumbs.filter((_, i) => i === 0 || i === config.breadcrumbs.length - 1)
    : config.breadcrumbs;
  const book = (
    <Link
      key="book"
      className={layout === 'jump' ? 'nw-ghost-dark nws-cta-alt' : 'nw-btn nws-cta-main'}
      to={CONSULTATION_PATH}
    >
      Book a Free Consultation
      {layout === 'jump' ? null : <ServiceIcon name="arrowRight" size={18} />}
    </Link>
  );
  const quote = (
    <Link
      key="quote"
      className={layout === 'standard' ? 'nw-ghost-dark nws-cta-alt' : 'nw-btn nws-cta-main'}
      to={quotePath}
    >
      Get a Quote
      {layout === 'standard' ? null : <ServiceIcon name="arrowRight" size={18} />}
    </Link>
  );
  const actions =
    layout === 'standard' ? [book, quote] : layout === 'jump' ? [quote, book] : [quote];

  const copy = (
    <div>
      {layout === 'standard' ? <Breadcrumbs crumbs={crumbs} /> : null}
      <div className="nws-badge">
        <ServiceIcon name={board.icons.badge} size={14} stroke="#C5CAD3" />
        <span>{hero.badgeText}</span>
      </div>
      <h1 id="nws-title" className="nws-h1">
        {board.heading?.[0] ?? hero.titleLine1}
        <br />
        <span className="nw-accent">{board.heading?.[1] ?? hero.titleLine2}</span>
      </h1>
      <p className="nws-lead">{hero.description}</p>
      <div className="nws-ctas">{actions}</div>
      <ul className="nw-trust nw-trust--dark nws-trust" aria-label="Why clients choose us">
        <li>
          <ServiceIcon name="shieldCheck" size={15} />
          FSCA-authorised · FSP {COMPANY.fspNumber}
        </li>
        <li>
          <ServiceIcon name="check" size={14} />
          Independent advice
        </li>
        <li>
          <ServiceIcon name="check" size={14} />
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
  );

  const media = (
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
          <ServiceIcon name={board.icons.status} size={20} />
        </span>
        <span>
          <span className="nws-status-l nw-mono">{hero.statusLabel}</span>
          <span className="nws-status-v">{hero.statusValue}</span>
        </span>
      </div>
    </div>
  );

  return (
    <section className="nws-hero" aria-labelledby="nws-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      {layout === 'risk' ? null : <div className="nws-hero-glow" aria-hidden="true" />}
      {layout === 'jump' ? (
        <div className="nw-wrap nws-hero-wrap">
          <Breadcrumbs crumbs={crumbs} />
          <div className="nws-hero-inner">
            {copy}
            {media}
          </div>
        </div>
      ) : (
        <div className="nw-wrap nws-hero-inner">
          {copy}
          {media}
        </div>
      )}
    </section>
  );
}

export function NavigatorServicePage({ config, seoData, children }: ServicePageTemplateProps) {
  const { hero, individuals, business, approach, partners, faqs, form } = config;
  const board = serviceBoard(config.seoKey);
  const { layout } = board;
  const quotePath = hero.quoteLink ?? DEFAULT_QUOTE_PATH;
  const indId = board.firstGroupId ?? 'individuals';
  const showApproach = Boolean(approach) && layout !== 'risk';
  const showPartners = partners.logos.length > 0;
  const showFaq = Boolean(faqs && faqs.length > 0);

  // Numbered kickers: "01 — For Individuals". The risk board numbers nothing,
  // and the jump boards leave the partner band out of the count.
  const numbered: string[] = [indId, 'businesses'];
  if (showApproach) numbered.push('approach');
  if (showPartners && layout === 'standard') numbered.push('partners');
  if (showFaq) numbered.push('faq');
  const indexOf = (id: string) => (layout === 'risk' ? undefined : pad2(numbered.indexOf(id) + 1));

  const sections: { id: string; label: string }[] = [
    { id: indId, label: individuals.badgeText },
    { id: 'businesses', label: business.badgeText },
  ];
  if (showApproach) sections.push({ id: 'approach', label: 'Our Approach' });
  if (showPartners) sections.push({ id: 'partners', label: 'Partners' });
  if (showFaq) sections.push({ id: 'faq', label: 'FAQ' });

  return (
    <div className={`nw-site nws nws--${layout}`}>
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        ogImage={serviceShareImage(config.seoKey) ?? hero.heroImage}
        structuredData={buildServiceStructuredData(config, seoData)}
      />

      <Hero config={config} board={board} quotePath={quotePath} />

      {layout === 'standard' ? (
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
            <Link className="nw-btn nws-subnav-cta" to={quotePath}>
              Get a Quote
            </Link>
          </div>
        </nav>
      ) : null}

      {layout === 'jump' ? (
        <div className="nws-jump">
          <div className="nw-wrap nws-subnav-row">
            <nav aria-label="On this page" className="nws-subnav-links">
              <span className="nws-subnav-label nw-mono" aria-hidden="true">
                On this page
              </span>
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`}>
                  {shortLabel(s.label)}
                </a>
              ))}
            </nav>
            <a className="nw-btn nws-subnav-cta" href="#callback">
              Call Me Back
            </a>
          </div>
        </div>
      ) : null}

      <ProductShowcase
        id={indId}
        layout={layout}
        index={indexOf(indId)}
        kicker={individuals.badgeText}
        title={individuals.title}
        subtitle={individuals.subtitle}
        groupLabel={individuals.badgeText}
        tone="white"
        chipLabel={individuals.cardLabel}
        chipIcon={board.icons.ind}
        headWidth={board.headWidth?.[0]}
        tabPad={board.tabPad?.[0]}
        products={toProducts(individuals)}
        quoteLink={individuals.quoteLink}
        consultationLink={CONSULTATION_PATH}
        ariaLabel={individuals.ariaLabel}
      />

      <ProductShowcase
        id="businesses"
        layout={layout}
        index={indexOf('businesses')}
        kicker={business.badgeText}
        title={business.title}
        subtitle={business.subtitle}
        groupLabel={business.badgeText}
        tone="paper"
        flip={layout !== 'jump'}
        chipLabel={business.cardLabel}
        chipIcon={board.icons.biz}
        headWidth={board.headWidth?.[1]}
        tabPad={board.tabPad?.[1]}
        products={toProducts(business)}
        quoteLink={business.quoteLink}
        consultationLink={CONSULTATION_PATH}
        ariaLabel={business.ariaLabel}
      />

      {approach && showApproach ? (
        <ApproachSteps
          variant={layout === 'jump' ? 'cards' : 'legs'}
          index={indexOf('approach') ?? ''}
          title={approach.serviceName}
          lead={approach.headerDescription}
          leadWidth={board.approachLead}
          steps={approach.steps}
          promise={approach.commitmentText}
          quoteLink={quotePath}
        />
      ) : null}

      {showPartners ? (
        <PartnerTiles
          variant={layout === 'standard' ? 'tiles' : layout === 'risk' ? 'strip' : board.partners}
          index={indexOf('partners')}
          kicker={partners.subHeading ?? 'Trusted Partners'}
          title={
            layout === 'risk'
              ? `${partners.logos.length} Insurers Compared`
              : (partners.heading ?? "We work with South Africa's leading insurers")
          }
          tiles={board.tiles}
          partners={partners.logos.map((p, i) =>
            i === 0 && board.partnerNote ? { ...p, description: board.partnerNote } : p,
          )}
        />
      ) : null}

      {faqs && showFaq ? (
        <FaqRail
          index={indexOf('faq')}
          kicker={layout === 'risk' ? 'Frequently asked questions' : 'FAQ'}
          faqs={faqs}
          lead={
            board.faqLead ??
            config.faqSubtitle ??
            `Clear answers to the questions clients ask us most about ${form.specialistType}.`
          }
          action={
            layout === 'standard'
              ? { label: 'Get a Quote', to: quotePath }
              : { label: 'Call Me Back', href: '#callback', arrow: false }
          }
        />
      ) : null}

      <CallbackForm
        variant={layout}
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
