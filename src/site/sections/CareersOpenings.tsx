/**
 * CareersOpenings — "01 — Open Positions": the department tabs, the roles
 * published from the admin careers manager for the chosen department, and,
 * when a department has none, the board's "No Current … Openings" panel.
 *
 * The tabs follow the WAI-ARIA tabs pattern (arrow keys, Home and End move
 * between them and select). Each role opens like an accordion: its heading
 * holds the button, which says whether the details are shown.
 */
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Link as LinkIcon,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { SectionHead } from './SectionHead';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/careers.css';

export interface CareersCategory {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

/** A role as GET /publications/careers returns it. */
export interface JobListing {
  id: string;
  title: string;
  category: string;
  location: string;
  type: string;
  description: string;
  requirements: string[];
  benefits: string[];
  closingDate?: string;
}

interface CareersOpeningsProps {
  id: string;
  index: string;
  categories: readonly CareersCategory[];
  active: string;
  onSelect: (id: string) => void;
  listings: readonly JobListing[];
  loading: boolean;
  /** The short list under the "no openings" panel. */
  perks: readonly string[];
  onApply: (event: MouseEvent<HTMLButtonElement>) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Oct 2026", as the Navigator pages write dates. */
function formatClosingDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Copies text, falling back to the textarea route the live page uses. */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Clipboard API unavailable or refused; fall through.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
  } catch {
    // Nothing more to try.
  }
  document.body.removeChild(area);
}

const tabId = (id: string) => `nwcr-tab-${id}`;
const PANEL_ID = 'nwcr-openings-panel';

export function CareersOpenings({
  id,
  index,
  categories,
  active,
  onSelect,
  listings,
  loading,
  perks,
  onApply,
}: CareersOpeningsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const select = (next: string) => {
    onSelect(next);
    setExpanded(null);
  };

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = categories.findIndex((c) => c.id === active);
    const last = categories.length - 1;
    const to =
      e.key === 'ArrowRight'
        ? (at + 1) % categories.length
        : e.key === 'ArrowLeft'
          ? (at - 1 + categories.length) % categories.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : -1;
    if (to < 0) return;
    e.preventDefault();
    select(categories[to].id);
    document.getElementById(tabId(categories[to].id))?.focus();
  };

  const category = categories.find((c) => c.id === active) ?? categories[0];
  const roles = listings.filter((l) => l.category === category.id);
  const CategoryIcon = category.icon;

  const share = async (listing: JobListing) => {
    await copyText(`${window.location.origin}/careers#${listing.id}`);
    setCopied(listing.id);
  };

  return (
    <section id={id} className="nwcr-openings" aria-labelledby="nwcr-openings-title">
      <div className="nw-wrap">
        <SectionHead
          index={index}
          kicker="Open Positions"
          title="Explore Career Opportunities"
          lead="We're always looking for talented individuals across our business. Browse by department to find where you fit."
          center
          titleId="nwcr-openings-title"
          className="nwcr-head"
        />

        <div className="nwcr-tabs-row">
          <div role="tablist" aria-label="Departments" className="nwcr-tabs" onKeyDown={onTabKey}>
            {categories.map((c) => {
              const on = c.id === category.id;
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  id={tabId(c.id)}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={PANEL_ID}
                  tabIndex={on ? 0 : -1}
                  className="nwcr-chip"
                  onClick={() => select(c.id)}
                >
                  <span className="nwcr-chip-i" aria-hidden="true">
                    <Icon size={16} strokeWidth={1.75} />
                  </span>
                  {c.title}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={tabId(category.id)}
          aria-busy={loading || undefined}
          className="nwcr-panel"
        >
          {loading ? (
            <p className="nwcr-loading" role="status">
              Loading positions…
            </p>
          ) : roles.length > 0 ? (
            <div className="nwcr-jobs">
              {roles.map((listing) => {
                const open = expanded === listing.id;
                const bodyId = `nwcr-job-${listing.id}`;
                const closes = formatClosingDate(listing.closingDate);
                const requirements = listing.requirements ?? [];
                const benefits = listing.benefits ?? [];
                return (
                  <article
                    key={listing.id}
                    className={open ? 'nwcr-job nwcr-job--open' : 'nwcr-job'}
                  >
                    <h3 className="nwcr-job-h">
                      <button
                        type="button"
                        className="nwcr-job-head"
                        aria-expanded={open}
                        aria-controls={bodyId}
                        onClick={() => setExpanded(open ? null : listing.id)}
                      >
                        <span className="nwcr-job-main">
                          <span className="nwcr-job-top">
                            <span className="nw-h nwcr-job-title">{listing.title}</span>
                            <span className="nwcr-job-tag">{category.title}</span>
                          </span>
                          <span className="nwcr-job-meta">
                            <span>
                              <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
                              {listing.location}
                            </span>
                            <span>
                              <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
                              {listing.type}
                            </span>
                            {closes ? (
                              <span>
                                <Calendar size={14} strokeWidth={1.75} aria-hidden="true" />
                                Closes {closes}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <ChevronRight
                          className="nwcr-job-chev"
                          size={20}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      </button>
                    </h3>
                    {open ? (
                      <div id={bodyId} className="nwcr-job-body">
                        {listing.description ? (
                          <p className="nwcr-job-desc">{listing.description}</p>
                        ) : null}
                        {requirements.length > 0 || benefits.length > 0 ? (
                          <div className="nwcr-job-cols">
                            {requirements.length > 0 ? (
                              <div>
                                <h4 className="nwcr-job-h4">Requirements</h4>
                                <ul className="nwcr-job-list">
                                  {requirements.map((item, i) => (
                                    <li key={i}>
                                      <CheckCircle
                                        size={16}
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                      />
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {benefits.length > 0 ? (
                              <div>
                                <h4 className="nwcr-job-h4">What We Offer</h4>
                                <ul className="nwcr-job-list nwcr-job-list--offer">
                                  {benefits.map((item, i) => (
                                    <li key={i}>
                                      <CheckCircle
                                        size={16}
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                      />
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="nwcr-job-actions">
                          <button type="button" className="nw-btn" onClick={onApply}>
                            Apply Now
                            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="nw-outline"
                            onClick={() => void share(listing)}
                          >
                            <LinkIcon size={16} strokeWidth={1.75} aria-hidden="true" />
                            <span aria-live="polite">
                              {copied === listing.id ? 'Link copied' : 'Share Position'}
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="nwcr-empty">
              <div className="nwcr-empty-icon" aria-hidden="true">
                <CategoryIcon size={34} strokeWidth={1.75} />
              </div>
              <h3 className="nw-h nwcr-empty-title">No Current {category.title} Openings</h3>
              <p className="nwcr-empty-p">
                {category.description} We don&apos;t have open positions here right now, but
                we&apos;d love to hear from you.
              </p>
              <button type="button" className="nw-btn nwcr-btn-lg nwcr-empty-btn" onClick={onApply}>
                Send Us Your CV
                <ArrowRight size={17} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <ul className="nwcr-mini">
                {perks.map((item) => (
                  <li key={item}>
                    <CheckCircle size={16} strokeWidth={1.75} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
