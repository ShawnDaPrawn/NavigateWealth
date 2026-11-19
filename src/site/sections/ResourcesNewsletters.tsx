/**
 * ResourcesNewsletters — "The Wealth Compass" archive and the sign-up panel.
 *
 * The archive is the live tab's (NewslettersTab.tsx), on the same rules from
 * newsletterArchive.ts: this year and the three before it as tabs, the five
 * before those behind "Older", only years and months that have an issue, the
 * newest year first. Each issue reads online at /resources/newsletter/<slug>
 * or downloads as the PDF the endpoint names.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import {
  buildYearTabs,
  defaultYear,
  formatIssueMonth,
  formatPdfSize,
  groupByMonth,
  selectableYears,
  yearsWithNewsletters,
  type PublicNewsletter,
} from '../../components/pages/resources/newsletterArchive';
import { SIGNUP_NOTE, issueTheme } from './resourcesModel';
import { ResourcesIcon } from './ResourcesIcons';
import { ResourcesSignup, type NewsletterSignup } from './ResourcesSignup';

interface ResourcesNewslettersProps {
  newsletters: PublicNewsletter[];
  loading: boolean;
  signup: NewsletterSignup;
  /** Injected in tests to pin the clock; production reads the real one. */
  now?: Date;
}

export function ResourcesNewsletters({
  newsletters,
  loading,
  signup,
  now,
}: ResourcesNewslettersProps) {
  const base = useId();
  const clock = useMemo(() => now ?? new Date(), [now]);
  const years = useMemo(() => yearsWithNewsletters(newsletters), [newsletters]);
  const tabs = useMemo(() => buildYearTabs(clock, years), [clock, years]);
  const reachable = useMemo(() => selectableYears(tabs), [tabs]);
  const [selected, setSelected] = useState<number | null>(null);
  const [olderOpen, setOlderOpen] = useState(false);
  const yearButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const olderButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // Follow the data: land on the newest year, and again if the chosen one
  // drops out of reach (NewslettersTab's rule).
  useEffect(() => {
    setSelected((current) =>
      current !== null && reachable.includes(current) ? current : defaultYear(tabs),
    );
  }, [reachable, tabs]);

  const months = useMemo(
    () => (selected === null ? [] : groupByMonth(newsletters, selected)),
    [newsletters, selected],
  );
  const olderSelected = selected !== null && tabs.older.includes(selected);
  const tabId = (year: number) => `${base}-year-${year}`;
  const olderId = `${base}-older`;
  const panelId = `${base}-panel`;

  // The "Older" menu closes on Escape and on a click anywhere else.
  useEffect(() => {
    if (!olderOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !olderButton.current?.contains(target)) {
        setOlderOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [olderOpen]);

  const pickYear = (year: number) => {
    setSelected(year);
    setOlderOpen(false);
  };

  const onYearKey = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = tabs.primary.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (i + 1) % (last + 1)
        : event.key === 'ArrowLeft'
          ? (i + last) % (last + 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    pickYear(tabs.primary[next]);
    yearButtons.current[next]?.focus();
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
    ];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      setOlderOpen(false);
      olderButton.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Tab') {
      setOlderOpen(false);
    }
  };

  return (
    <section className="nw-in nwrs-tabsec" aria-labelledby={`${base}-title`}>
      <div className="nw-wrap">
        <p className="nw-eyebrow nwrs-eyebrow">Newsletters</p>
        <div className="nwrs-nlwrap">
          <div className="nwrs-nlmain">
            <h2 id={`${base}-title`} className="nwrs-h2 nwrs-h2--tight nwrs-h2--flush">
              The Wealth Compass <span className="nwrs-accent-l">archive</span>
            </h2>

            {loading ? (
              <div className="nwrs-fetching" role="status">
                <ResourcesIcon name="spinner" stroke="#0D1626" className="nwrs-spin" />
                <span>Loading newsletters…</span>
              </div>
            ) : newsletters.length === 0 ? (
              <div className="nwrs-nlempty">
                <p className="nw-h nwrs-empty-t">No newsletters yet</p>
                <p className="nwrs-empty-p">
                  Our newsletters will appear here as they are published. Subscribe at the bottom of
                  any page to get each one by email.
                </p>
              </div>
            ) : (
              <>
                <div className="nwrs-years">
                  <div className="nwrs-years-tabs" role="tablist" aria-label="Newsletter years">
                    {tabs.primary.map((year, i) => {
                      const on = selected === year;
                      return (
                        <button
                          key={year}
                          ref={(el) => {
                            yearButtons.current[i] = el;
                          }}
                          type="button"
                          role="tab"
                          id={tabId(year)}
                          aria-selected={on}
                          aria-controls={on ? panelId : undefined}
                          tabIndex={on || (olderSelected && i === 0) ? 0 : -1}
                          className="nwrs-year"
                          onClick={() => pickYear(year)}
                          onKeyDown={(e) => onYearKey(e, i)}
                        >
                          {year}
                        </button>
                      );
                    })}
                  </div>
                  {tabs.older.length > 0 ? (
                    <div className="nwrs-older">
                      <button
                        ref={olderButton}
                        type="button"
                        id={olderId}
                        className={olderSelected ? 'nwrs-year nwrs-year--on' : 'nwrs-year'}
                        aria-label="Older years"
                        aria-haspopup="menu"
                        aria-expanded={olderOpen}
                        onClick={() => setOlderOpen((open) => !open)}
                      >
                        {olderSelected ? selected : 'Older'}
                        <ResourcesIcon name="chevronDown" size={14} />
                      </button>
                      {olderOpen ? (
                        <div
                          ref={menu}
                          className="nwrs-menu nw-in"
                          role="menu"
                          aria-labelledby={olderId}
                          onKeyDown={onMenuKey}
                        >
                          {tabs.older.map((year) => (
                            <button
                              key={year}
                              type="button"
                              role="menuitem"
                              className="nwrs-menuitem"
                              onClick={() => {
                                pickYear(year);
                                olderButton.current?.focus();
                              }}
                            >
                              {year}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div
                  id={panelId}
                  role="tabpanel"
                  aria-labelledby={olderSelected ? olderId : selected ? tabId(selected) : undefined}
                >
                  {months.length === 0 ? (
                    <p className="nwrs-nlempty">No newsletters for {selected}.</p>
                  ) : (
                    months.map((group) => (
                      <div key={group.month} className="nwrs-month">
                        <h3 className="nwrs-label nwrs-month-h">
                          {group.label} {selected}
                        </h3>
                        {group.items.map((item) => (
                          <IssueCard key={item.slug} newsletter={item} />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <aside className="nwrs-aside" aria-labelledby={`${base}-signup`}>
            <p className="nw-eyebrow nwrs-aside-eyebrow">Monthly briefing</p>
            <h3 id={`${base}-signup`} className="nw-h nwrs-aside-h">
              Stay <span className="nw-accent">Connected</span>
            </h3>
            <p className="nwrs-aside-p">
              Get the latest market insights and financial tips delivered to your inbox.
            </p>
            <ResourcesSignup variant="panel" signup={signup} />
            <p className="nwrs-aside-note">{SIGNUP_NOTE}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

function IssueCard({ newsletter }: { newsletter: PublicNewsletter }) {
  const issue = formatIssueMonth(newsletter.issueMonth);
  const theme = issueTheme(newsletter.title);
  const size = formatPdfSize(newsletter.pdfSizeBytes);
  return (
    <article className="nwrs-issue">
      <div className="nwrs-cover" aria-hidden="true">
        <span className="nwrs-cover-frame" />
        <span className="nwrs-label nwrs-cover-brand">Navigate Wealth</span>
        <span className="nw-h nwrs-cover-title">
          The Wealth
          <br />
          <span className="nw-accent">Compass</span>
        </span>
        {theme ? <span className="nwrs-cover-theme">{theme}</span> : null}
        <span className="nwrs-label nwrs-cover-issue">{issue}</span>
      </div>
      <div className="nwrs-issue-body">
        <span className="nwrs-label nwrs-issue-label">{issue}</span>
        <h4 className="nw-h nwrs-issue-t">{newsletter.title}</h4>
        {newsletter.description ? <p className="nwrs-issue-p">{newsletter.description}</p> : null}
        <div className="nwrs-issue-actions">
          <Link className="nw-btn nwrs-issue-btn" to={`/resources/newsletter/${newsletter.slug}`}>
            <ResourcesIcon name="fileText" />
            Read online
          </Link>
          <a
            className="nw-outline nwrs-issue-btn"
            href={newsletter.pdfUrl}
            download={newsletter.pdfFileName}
          >
            <ResourcesIcon name="download" />
            Download PDF
          </a>
          {size ? <span className="nw-mono nwrs-issue-size">PDF · {size}</span> : null}
        </div>
      </div>
    </article>
  );
}
