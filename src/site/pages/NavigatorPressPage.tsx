/**
 * NavigatorPressPage — /press in the Navigator design.
 *
 * The press-release feed, its categories and the media-kit items come from
 * pressContent.ts (shared with the live page); every fact about the firm from
 * companyFacts.ts. Media materials are requested by email, as on the live
 * page (MediaKitDialog). Filtered-out releases stay in the document, hidden.
 * The logos shown are the ones the site uses today (Logo.tsx); the new logo
 * pack is not used until the site adopts it.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Building2, Clock, Copy, Mail, Newspaper, Search } from 'lucide-react';
import navigateWealthLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import reversedLogo from 'figma:asset/8dc2892f50ecc4c5f692fd5ad52639699e2e4656.png';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { COMPANY, FOUNDER } from '../../config/companyFacts';
import { SITE_ORIGIN } from '../../utils/siteOrigin';
import { getOptimizedFallbackUrl } from '../../utils/optimizedImages';
import { NwImage } from '../components/NwImage';
import { SectionHead } from '../sections/SectionHead';
import { CompanyHero } from '../company/CompanyHero';
import { FactList, type Fact } from '../company/FactList';
import { MediaKitDialog } from '../company/MediaKitDialog';
import { PressArticleCard } from '../company/PressArticleCard';
import { copyText } from '../company/clipboard';
import {
  CATEGORY_TABS,
  MEDIA_ASSETS,
  PRESS_BOILERPLATE,
  PRESS_FACTS,
  fetchPressArticles,
  matchesPressFilter,
  type MediaAsset,
  type PressArticle,
} from '../company/pressContent';
import { useTabs } from '../company/useTabs';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/service.css';
import '../styles/company.css';

const COMPANY_INFO: Fact[] = [
  { term: 'Legal entity', value: COMPANY.legalName },
  { term: 'Founder', value: FOUNDER.name },
  { term: 'Founded', value: String(COMPANY.foundedYear) },
  { term: 'FSCA authorised', value: COMPANY.fscaAuthorisedOn },
  { term: 'Headquarters', value: COMPANY.headquarters },
  { term: 'FSP Licence', value: COMPANY.fspNumber, mono: true },
  {
    term: 'Website',
    value: (
      <a href={SITE_ORIGIN} target="_blank" rel="noopener noreferrer">
        www.navigatewealth.co
      </a>
    ),
  },
];

function AssetThumb({ id }: { id: MediaAsset['id'] }) {
  if (id === 'brand') {
    return <img src={navigateWealthLogo} alt="" className="nwco-asset-logo" />;
  }
  if (id === 'founder') {
    return (
      <NwImage
        src={getOptimizedFallbackUrl(FOUNDER.imageKey)}
        imageKey={FOUNDER.imageKey}
        alt=""
        sizes="320px"
        className="nwco-asset-photo"
      />
    );
  }
  return null;
}

export function NavigatorPressPage() {
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState<PressArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [kitOpen, setKitOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const tabs = useTabs(CATEGORY_TABS, 'All');
  const seoData = getSEOData('press');

  useEffect(() => {
    fetchPressArticles().then((list) => {
      setArticles(list);
      setLoading(false);
    });
  }, []);

  const visible = useMemo(
    () =>
      new Set(articles.filter((a) => matchesPressFilter(a, tabs.active, query)).map((a) => a.id)),
    [articles, tabs.active, query],
  );
  const filtering = tabs.active !== 'All' || query.trim().length > 0;
  const openKit = () => setKitOpen(true);
  const copyBoilerplate = async () => setCopied(await copyText(PRESS_BOILERPLATE));

  return (
    <div className="nw-site nwx-press">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={createWebPageSchema(
          seoData.title,
          seoData.description,
          seoData.canonicalUrl,
        )}
      />

      <CompanyHero
        titleId="nwx-press-title"
        pillIcon={Newspaper}
        pill="Press Centre"
        title={
          <>
            Navigate Wealth <span className="nw-accent">Press and Media</span>
          </>
        }
        lead="The latest announcements and company news from Navigate Wealth, an independent, founder-led financial advisory practice."
        actions={
          <>
            <button type="button" className="nw-btn nw-btn--lg" onClick={openKit}>
              Request Media Kit
              <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <a className="nw-ghost-dark nw-btn--lg" href="#contact">
              Media Contact
            </a>
          </>
        }
        aside={
          <div
            className="nwco-brand nwco-hide-phone"
            aria-label="Brand assets preview"
            role="group"
          >
            <div className="nwco-brand-main">
              <img src={navigateWealthLogo} alt="Navigate Wealth logo" />
            </div>
            <div className="nwco-brand-dark">
              <img src={reversedLogo} alt="Navigate Wealth logo, reversed for dark backgrounds" />
            </div>
            <div className="nwco-brand-swatch">
              <span className="nwco-brand-chip" aria-hidden="true" />
              <span className="nw-mono">#6D28D9</span>
            </div>
          </div>
        }
      />

      <section className="nwco-factbar" aria-label="Company facts">
        <dl className="nw-wrap nwco-factbar-list">
          {PRESS_FACTS.map(({ label, value, icon: Icon }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <span className="nwco-factbar-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <span className="nwco-factbar-value">{value}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="nwco-boiler-sec" aria-labelledby="nwx-press-boiler">
        <div className="nw-wrap">
          <div className="nwco-boiler">
            <div>
              <SectionHead
                index="01"
                kicker="Boilerplate"
                title="About Navigate Wealth"
                titleId="nwx-press-boiler"
                lead="For use in articles and announcements. The licensing details can be checked on the FSCA's public register."
                className="nwco-boiler-head"
              />
              <button
                type="button"
                className="nw-outline nwco-boiler-btn"
                onClick={copyBoilerplate}
              >
                <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
                {copied ? 'Copied' : 'Copy boilerplate'}
              </button>
              <span className="nw-sr-only" role="status">
                {copied ? 'Boilerplate copied' : ''}
              </span>
            </div>
            <blockquote className="nwco-boiler-text">{PRESS_BOILERPLATE}</blockquote>
          </div>
        </div>
      </section>

      <section className="nwco-news-sec" aria-labelledby="nwx-press-news">
        <div className="nw-wrap">
          <SectionHead
            index="02"
            kicker="Newsroom"
            title="Featured News"
            titleId="nwx-press-news"
            lead="Latest major announcements and company developments."
          />
          <div className="nwco-toolbar">
            <div className="nwco-search">
              <label htmlFor="nwx-press-search" className="nw-sr-only">
                Search press releases
              </label>
              <Search size={17} strokeWidth={1.75} aria-hidden="true" />
              <input
                id="nwx-press-search"
                className="nwc-input"
                type="search"
                placeholder="Search press releases..."
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div role="tablist" aria-label="Press categories" className="nwp-tabs nwco-tabstrip">
              {CATEGORY_TABS.map((label) => (
                <button
                  key={label}
                  ref={tabs.tabRef(label)}
                  type="button"
                  role="tab"
                  id={`nwx-press-tab-${label.replace(/\s+/g, '-').toLowerCase()}`}
                  aria-selected={tabs.active === label}
                  aria-controls="nwx-press-results"
                  tabIndex={tabs.active === label ? 0 : -1}
                  className="nwp-tab"
                  onClick={() => tabs.setActive(label)}
                  onKeyDown={tabs.onKeyDown}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            id="nwx-press-results"
            role="tabpanel"
            aria-labelledby={`nwx-press-tab-${tabs.active.replace(/\s+/g, '-').toLowerCase()}`}
            className="nwco-results"
          >
            {loading ? (
              <p className="nwco-loading" role="status">
                <span className="nwco-spinner" aria-hidden="true" />
                Loading press releases…
              </p>
            ) : null}
            {articles.length > 0 ? (
              <ul className="nwco-articles" hidden={visible.size === 0}>
                {articles.map((article) => (
                  <PressArticleCard
                    key={article.id}
                    article={article}
                    hidden={!visible.has(article.id)}
                  />
                ))}
              </ul>
            ) : null}
            {!loading && visible.size === 0 ? (
              <div className="nwco-empty nwco-empty--dashed">
                <span className="nwco-empty-icon nwco-empty-icon--soft" aria-hidden="true">
                  <Newspaper size={34} strokeWidth={1.7} />
                </span>
                <h3>{filtering ? 'No Matching Results' : 'No News Available'}</h3>
                <p>
                  {filtering
                    ? 'Try adjusting your search or category filter to find press releases.'
                    : "We don't have any press releases or news announcements to share at the moment. Please check back soon for updates on our latest developments and company news."}
                </p>
                <p className="nwco-empty-note">
                  For immediate assistance or enquiries, please contact us directly.
                </p>
                <Link className="nw-btn" to="/contact">
                  Contact Us
                  <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section
        id="media-kit"
        className="nw-sec nwco-dark-sec nwco-anchor"
        aria-labelledby="nwx-press-kit"
      >
        <div className="nw-grid-bg nwco-fade-center" aria-hidden="true" />
        <div className="nw-wrap nwco-rel">
          <SectionHead
            center
            dark
            index="03"
            kicker="Media Kit"
            title="Media Resources"
            titleId="nwx-press-kit"
            lead="Our media kit, with brand assets, founder photos and company information, is sent on request."
          />
          <ul className="nwco-assets">
            {MEDIA_ASSETS.map((asset) => {
              const Icon = asset.icon;
              return (
                <li key={asset.id} className="nwco-asset">
                  <div className={`nwco-asset-thumb nwco-asset-thumb--${asset.id}`}>
                    <AssetThumb id={asset.id} />
                    {asset.id === 'facts' || asset.id === 'brochures' ? (
                      <Icon size={44} strokeWidth={1.75} aria-hidden="true" />
                    ) : null}
                  </div>
                  <div className="nwco-asset-body">
                    <div className="nwco-asset-head">
                      <h3>{asset.title}</h3>
                      <span className="nwco-asset-type nw-mono">{asset.type}</span>
                    </div>
                    <p>{asset.description}</p>
                    <button
                      type="button"
                      className="nw-btn"
                      onClick={openKit}
                      aria-label={`Request ${asset.title}`}
                    >
                      Request
                      <Mail size={15} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section
        id="contact"
        className="nw-sec nw-sec--white nwco-anchor"
        aria-labelledby="nwx-press-contact"
      >
        <div className="nw-wrap">
          <SectionHead
            center
            index="04"
            kicker="Contact"
            title="Media Contact"
            titleId="nwx-press-contact"
            lead="For press enquiries, interviews, and additional information, contact us directly."
          />
          <div className="nwco-contact-grid">
            <div className="nwco-contact-dark">
              <div className="nw-grid-bg" aria-hidden="true" />
              <div className="nwco-rel nwco-contact-inner">
                <h3 className="nwco-contact-h">
                  <span className="nwco-contact-icon" aria-hidden="true">
                    <Mail size={18} strokeWidth={1.75} />
                  </span>
                  Press Enquiries
                </h3>
                <dl className="nwco-contact-list">
                  <div>
                    <dt className="nw-mono">Email</dt>
                    <dd>
                      <a href={`mailto:${COMPANY.email}`} className="nwco-contact-email">
                        {COMPANY.email}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="nw-mono">Phone</dt>
                    <dd>
                      <a href={COMPANY.phone.tel}>{COMPANY.phone.display}</a>
                    </dd>
                  </div>
                </dl>
                <p className="nwco-contact-time">
                  <Clock size={15} strokeWidth={1.75} aria-hidden="true" />
                  Response time: Within 24 hours during business days
                </p>
              </div>
            </div>
            <div className="nwco-contact-light">
              <h3 className="nwco-contact-h">
                <span className="nwco-contact-icon nwco-contact-icon--light" aria-hidden="true">
                  <Building2 size={18} strokeWidth={1.75} />
                </span>
                Company Information
              </h3>
              <FactList tone="plain" facts={COMPANY_INFO} />
            </div>
          </div>
        </div>
      </section>

      <MediaKitDialog open={kitOpen} onOpenChange={setKitOpen} />
    </div>
  );
}
