/**
 * ResourcesMarketNews — the "Market News" section: headlines from the four
 * RSS feeds the live page reads, through the same hook and server proxy.
 *
 * As on the live tab: four feeds as tabs, at most twelve headlines each, a
 * refresh button, the time of the last update, and an empty state that offers
 * to try again. Headlines open on the publisher's site in a new tab. Feed
 * thumbnails are whatever URL a feed supplies and the site's
 * Content-Security-Policy may block them, so a card falls back to the board's
 * no-image panel rather than a broken picture.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { EMPTY_NEWS, formatCardDate, type NewsFeeds, type NewsItem } from './resourcesModel';
import { ResourcesIcon } from './ResourcesIcons';

const FEED_TABS: { id: string; label: string; feed: keyof NewsFeeds }[] = [
  { id: 'economic-news', label: 'Economic News', feed: 'economicNews' },
  { id: 'forex-news', label: 'Forex News', feed: 'forexNews' },
  { id: 'stock-market', label: 'Stock Market', feed: 'stockMarket' },
  { id: 'investing-ideas', label: 'Investing Ideas', feed: 'investingIdeas' },
];

/** The live tab shows this many headlines per feed. */
const MAX_HEADLINES = 12;

interface ResourcesMarketNewsProps {
  active: string;
  onSelect: (id: string) => void;
  news: NewsFeeds | undefined;
  loading: boolean;
  refreshing: boolean;
  updatedAt: number;
  onRefresh: () => void;
}

export function ResourcesMarketNews({
  active,
  onSelect,
  news,
  loading,
  refreshing,
  updatedAt,
  onRefresh,
}: ResourcesMarketNewsProps) {
  const base = useId();
  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = `${base}-panel`;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const current = FEED_TABS.find((t) => t.id === active) ?? FEED_TABS[0];
  const items = (news ?? EMPTY_NEWS)[current.feed] ?? [];
  // The first load has its own status line; only a refetch spins the button.
  const refetching = refreshing && !loading;
  const updated = useUpdatedLabel(updatedAt, refetching);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = FEED_TABS.length - 1;
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
    onSelect(FEED_TABS[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <section className="nw-in nwrs-tabsec" aria-labelledby={`${base}-title`}>
      <div className="nw-wrap">
        <p className="nw-eyebrow nwrs-eyebrow">Market News</p>
        <div className="nwrs-mnhead">
          <h2 id={`${base}-title`} className="nwrs-h2 nwrs-h2--tight">
            Headlines <span className="nwrs-accent-l">from the wire</span>
          </h2>
          <div className="nwrs-mnactions">
            <span className="nwrs-updated">{updated}</span>
            <button
              type="button"
              className="nw-outline nwrs-refresh"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <ResourcesIcon name="refresh" className={refetching ? 'nwrs-spin' : undefined} />
              Refresh
            </button>
          </div>
        </div>
        <div className="nwrs-strip nwrs-mntabs" role="tablist" aria-label="Market News sections">
          {FEED_TABS.map((tab, i) => {
            const on = tab.id === current.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                role="tab"
                id={tabId(tab.id)}
                aria-selected={on}
                aria-controls={on ? panelId : undefined}
                aria-label={`View ${tab.label}`}
                tabIndex={on ? 0 : -1}
                className="nwrs-tab nwrs-tab--sm"
                onClick={() => onSelect(tab.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div id={panelId} role="tabpanel" aria-labelledby={tabId(current.id)} aria-busy={loading}>
          {loading ? (
            <>
              <div className="nwrs-fetching" role="status">
                <ResourcesIcon name="spinner" stroke="#0D1626" className="nwrs-spin" />
                <span>Fetching latest market updates...</span>
              </div>
              <div className="nwrs-newsgrid" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="nwrs-news">
                    <div className="nwrs-skel nwrs-skel-newsimg" />
                    <div
                      className="nwrs-skel"
                      style={{ marginTop: 16, width: '35%', height: 10 }}
                    />
                    <div
                      className="nwrs-skel"
                      style={{ marginTop: 12, width: '92%', height: 16 }}
                    />
                    <div className="nwrs-skel" style={{ marginTop: 8, width: '70%', height: 16 }} />
                    <div className="nwrs-news-go">
                      Read Article <ResourcesIcon name="externalLink" size={14} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : items.length > 0 ? (
            <>
              <div className="nwrs-newsgrid">
                {items.slice(0, MAX_HEADLINES).map((item, i) => (
                  <NewsCard key={`${current.id}-${item.link}-${i}`} item={item} />
                ))}
              </div>
              {items.length > MAX_HEADLINES ? (
                <p className="nw-mono nwrs-showing nwrs-news-count">
                  Showing {MAX_HEADLINES} of {items.length} articles
                </p>
              ) : null}
            </>
          ) : (
            <div className="nwrs-empty">
              <p className="nw-h nwrs-empty-t">No updates available</p>
              <p className="nwrs-empty-p">Unable to fetch news for this section at the moment.</p>
              <button
                type="button"
                className="nw-outline nwrs-refresh nwrs-empty-btn"
                onClick={onRefresh}
              >
                <ResourcesIcon name="refresh" />
                Try Again
              </button>
            </div>
          )}
        </div>
        <p className="nwrs-mnnote">
          Live feed — headlines come from external publishers and open on their sites in a new tab.
        </p>
      </div>
    </section>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const [failed, setFailed] = useState(false);
  const date = formatCardDate(item.pubDate);
  return (
    <a className="nwrs-story nwrs-news" href={item.link} target="_blank" rel="noopener noreferrer">
      <span className="nwrs-news-img">
        {item.image && !failed ? (
          <img
            src={item.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="nwrs-noimg" aria-hidden="true">
            <ResourcesIcon name="compass" size={44} />
          </span>
        )}
      </span>
      <span className="nwrs-meta nwrs-news-meta">
        {date}
        {date && item.author ? <i aria-hidden="true" /> : null}
        {item.author}
      </span>
      <h3 className="nw-h nwrs-st nwrs-clamp3 nwrs-news-t">{item.title}</h3>
      <span className="nwrs-news-go">
        Read Article <ResourcesIcon name="externalLink" size={14} />
        <span className="nw-sr-only"> (opens in a new tab)</span>
      </span>
    </a>
  );
}

/** "Updated just now", "Updated 5 min ago", or the date; "Refreshing…" meanwhile. */
function useUpdatedLabel(updatedAt: number, refreshing: boolean): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => setNow(Date.now()), [updatedAt]);
  if (refreshing) return 'Refreshing…';
  if (!updatedAt) return 'Live updates';
  const minutes = Math.floor((now - updatedAt) / 60_000);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  return `Updated ${formatCardDate(new Date(updatedAt).toISOString())}`;
}
