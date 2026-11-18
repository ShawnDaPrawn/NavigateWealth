/**
 * NavigatorCareersPage — /careers in the Navigator design.
 *
 * Reads the same published roles as the live page (careersContent.ts) and
 * sends applications through the same endpoint and payload as the live CV
 * form (CareersApplyDialog). Each department's roles are a tab panel; the
 * panels and each role's details stay in the document while hidden. A shared
 * link /careers#<role id> now opens that role.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  ArrowRight,
  Briefcase,
  ChevronRight,
  CircleCheck,
  Globe,
  Send,
  Shield,
} from 'lucide-react';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { COMPANY } from '../../config/companyFacts';
import { SectionHead } from '../sections/SectionHead';
import { pad2 } from '../sections/format';
import { CompanyHero } from '../company/CompanyHero';
import { CareersApplyDialog } from '../company/CareersApplyDialog';
import { JobListingCard } from '../company/JobListingCard';
import {
  CAREER_CATEGORIES,
  CAREER_HIGHLIGHTS,
  CAREER_PERKS,
  CAREER_VALUES,
  fetchJobListings,
  type JobListing,
} from '../company/careersContent';
import { useTabs } from '../company/useTabs';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/service.css';
import '../styles/company.css';

const CATEGORY_IDS = CAREER_CATEGORIES.map((c) => c.id);

function scrollToOpportunities() {
  document.getElementById('opportunities')?.scrollIntoView({ behavior: 'smooth' });
}

export function NavigatorCareersPage() {
  const [listings, setListings] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const tabs = useTabs(CATEGORY_IDS, 'advisory');
  const { setActive } = tabs;
  const { hash } = useLocation();
  const seoData = getSEOData('careers');

  useEffect(() => {
    fetchJobListings().then((data) => {
      setListings(data);
      setLoading(false);
    });
  }, []);

  // A shared position link (/careers#<id>) opens that role in its department.
  useEffect(() => {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    const listing = id ? listings.find((l) => l.id === id) : undefined;
    if (!listing || !CATEGORY_IDS.includes(listing.category)) return;
    setActive(listing.category);
    setExpandedJob(listing.id);
    const frame = requestAnimationFrame(() =>
      document.getElementById(listing.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [hash, listings, setActive]);

  const byCategory = useMemo(() => {
    const groups: Record<string, JobListing[]> = {};
    for (const id of CATEGORY_IDS) groups[id] = listings.filter((l) => l.category === id);
    return groups;
  }, [listings]);

  const totalOpenings = listings.length;
  const openApply = () => setApplyOpen(true);
  const pickCategory = (id: string) => {
    tabs.setActive(id);
    setExpandedJob(null);
  };

  return (
    <div className="nw-site nwx-careers">
      <SEO
        {...seoData}
        structuredData={createWebPageSchema(
          seoData.title,
          seoData.description,
          seoData.canonicalUrl,
        )}
      />

      <CompanyHero
        titleId="nwx-careers-title"
        pillIcon={Briefcase}
        pill={
          totalOpenings > 0
            ? `${totalOpenings} Open Position${totalOpenings !== 1 ? 's' : ''}`
            : COMPANY.headquarters
        }
        title={
          <>
            Careers at <span className="nw-accent">Navigate Wealth</span>
          </>
        }
        slogan="Build Your Career in Financial Advisory"
        lead="Navigate Wealth is an independent, founder-led financial advisory practice. We combine modern technology with personalised service to help clients achieve their financial goals."
        actions={
          <>
            <button type="button" className="nw-btn nw-btn--lg" onClick={scrollToOpportunities}>
              View Open Positions
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button type="button" className="nw-ghost-dark nw-btn--lg" onClick={openApply}>
              <Send size={18} strokeWidth={1.75} aria-hidden="true" />
              Send Your CV
            </button>
          </>
        }
        meta={
          <ul className="nw-trust nw-trust--dark">
            <li>
              <Shield size={14} strokeWidth={1.75} aria-hidden="true" />
              FSCA Regulated
            </li>
            <li>
              <Globe size={14} strokeWidth={1.75} aria-hidden="true" />
              Independent
            </li>
            <li>
              <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />
              Equal Opportunity Employer
            </li>
          </ul>
        }
        aside={
          <aside className="nwco-card-dark nwco-hide-phone" aria-label="Departments">
            <div className="nwco-card-head">
              <p className="nwco-card-label nw-mono">Crew manifest</p>
              <span className="nwco-card-count nw-mono">
                {CAREER_CATEGORIES.length} departments
              </span>
            </div>
            <ul className="nwco-depts">
              {CAREER_CATEGORIES.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="nwco-dept"
                    onClick={() => {
                      pickCategory(c.id);
                      scrollToOpportunities();
                    }}
                  >
                    <span className="nwco-dept-no nw-mono" aria-hidden="true">
                      {pad2(i + 1)}
                    </span>
                    <span className="nwco-dept-txt">
                      <span className="nwco-dept-t">{c.title}</span>
                      <span className="nwco-dept-d">{c.description}</span>
                    </span>
                    <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        }
      />

      <section
        id="opportunities"
        className="nw-sec nw-sec--white nwco-anchor"
        aria-labelledby="nwx-careers-open"
      >
        <div className="nw-wrap">
          <SectionHead
            center
            index="01"
            kicker="Open Positions"
            title="Explore Career Opportunities"
            titleId="nwx-careers-open"
            lead="We're always looking for talented individuals across our business. Browse by department to find where you fit."
          />
          <div className="nwco-chips-row">
            <div role="tablist" aria-label="Departments" className="nwp-tabs nwco-tabstrip">
              {CAREER_CATEGORIES.map((c) => {
                const Icon = c.icon;
                const count = byCategory[c.id].length;
                return (
                  <button
                    key={c.id}
                    ref={tabs.tabRef(c.id)}
                    type="button"
                    role="tab"
                    id={`nwx-careers-tab-${c.id}`}
                    aria-selected={tabs.active === c.id}
                    aria-controls={`nwx-careers-panel-${c.id}`}
                    tabIndex={tabs.active === c.id ? 0 : -1}
                    className="nwp-tab"
                    onClick={() => pickCategory(c.id)}
                    onKeyDown={tabs.onKeyDown}
                  >
                    <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                    {c.title}
                    {count > 0 ? (
                      <span className="nwco-tab-count nw-mono">
                        {count}
                        <span className="nw-sr-only"> open</span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="nwco-roles">
            {loading ? (
              <p className="nwco-loading" role="status">
                <span className="nwco-spinner" aria-hidden="true" />
                Loading positions…
              </p>
            ) : null}
            {CAREER_CATEGORIES.map((c) => {
              const Icon = c.icon;
              const roles = byCategory[c.id];
              return (
                <div
                  key={c.id}
                  role="tabpanel"
                  id={`nwx-careers-panel-${c.id}`}
                  aria-labelledby={`nwx-careers-tab-${c.id}`}
                  hidden={loading || tabs.active !== c.id}
                  className="nw-in"
                >
                  {roles.length > 0 ? (
                    <div className="nwco-job-list">
                      {roles.map((listing) => (
                        <JobListingCard
                          key={listing.id}
                          listing={listing}
                          categoryTitle={c.title}
                          expanded={expandedJob === listing.id}
                          onToggle={() =>
                            setExpandedJob(expandedJob === listing.id ? null : listing.id)
                          }
                          onApply={openApply}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="nwco-empty">
                      <span className="nwco-empty-icon" aria-hidden="true">
                        <Icon size={34} strokeWidth={1.75} />
                      </span>
                      <h3>No Current {c.title} Openings</h3>
                      <p>
                        {c.description} We don&apos;t have open positions here right now, but
                        we&apos;d love to hear from you.
                      </p>
                      <button type="button" className="nw-btn nw-btn--lg" onClick={openApply}>
                        Send Us Your CV
                        <ArrowRight size={17} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                      <ul className="nwco-highlights">
                        {CAREER_HIGHLIGHTS.map((item) => (
                          <li key={item}>
                            <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="nw-sec nwco-dark-sec" aria-labelledby="nwx-careers-culture">
        <div className="nw-grid-bg nwco-fade-center" aria-hidden="true" />
        <div className="nw-wrap nwco-rel">
          <SectionHead
            center
            dark
            index="02"
            kicker="Our Culture"
            title="Why Navigate Wealth?"
            titleId="nwx-careers-culture"
            lead="Join a growing, founder-led practice built on independence, transparency and personal service."
          />
          <ul className="nwco-values">
            {CAREER_VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <li key={value.title}>
                  <span className="nwco-value-icon" aria-hidden="true">
                    <Icon size={22} strokeWidth={1.75} />
                  </span>
                  <h3>{value.title}</h3>
                  <p>{value.description}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="nw-sec nw-sec--white" aria-labelledby="nwx-careers-perks">
        <div className="nw-wrap">
          <SectionHead
            center
            index="03"
            kicker="Benefits & Perks"
            title="Everything You Need to Thrive"
            titleId="nwx-careers-perks"
            lead="We believe that taking care of the people who work with us is the foundation of exceptional client service. Here's what you can expect."
          />
          <ul className="nwco-perks">
            {CAREER_PERKS.map((perk) => {
              const Icon = perk.icon;
              return (
                <li key={perk.title}>
                  <span className="nwco-perk-icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3>{perk.title}</h3>
                    <p>{perk.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="nw-sec nwco-closing" aria-labelledby="nwx-careers-next">
        <div className="nw-wrap nwco-closing-inner">
          <h2 id="nwx-careers-next" className="nw-sec-title">
            Ready to Shape the Future of{' '}
            <span className="nwco-accent-ink">Financial Advisory?</span>
          </h2>
          <p className="nw-sec-lead">
            Even if you don&apos;t see a current opening that matches your skills, we&apos;re always
            interested in hearing from exceptional candidates who share our vision.
          </p>
          <ol className="nwco-legs" aria-label="How to apply">
            <li>
              <span className="nw-mono">Leg 01</span>
              Send us your details
            </li>
            <li>
              <span className="nw-mono">Leg 02</span>
              Email your CV to {COMPANY.email}
            </li>
          </ol>
          <div className="nwco-closing-ctas">
            <button type="button" className="nw-btn nw-btn--lg" onClick={openApply}>
              Start Your Journey With Us
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <Link className="nw-outline nw-btn--lg" to="/contact">
              Contact Us
            </Link>
          </div>
          <p className="nwco-closing-note">
            Equal opportunity employer • Professional development • Competitive benefits •
            Growth-focused culture
          </p>
        </div>
      </section>

      <CareersApplyDialog open={applyOpen} onOpenChange={setApplyOpen} />
    </div>
  );
}
