/**
 * ResourcesMarketWatch — the "Market Watch" section: six TradingView views
 * and the panel that shows the chosen one.
 *
 * The widgets are the live page's own (src/components/tradingview/), lazy-loaded
 * one at a time, so the page embeds exactly what it embedded before and adds
 * no third-party source. Until the chosen widget's frame has loaded, the panel
 * shows the board's placeholder for that kind of view; if the widget's script
 * cannot load, the widget's own message takes its place. Switching view waits
 * for the previous widget to unmount first, as the live tab does.
 */
import {
  Suspense,
  lazy,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type RefObject,
} from 'react';

type Kind = 'line' | 'fx' | 'tiles' | 'table';

interface WatchSection {
  id: string;
  label: string;
  description: string;
  kind: Kind;
  widget: ComponentType;
}

const MarketOverview = lazy(
  () => import('../../components/tradingview/TradingViewMarketOverviewWidget'),
);
const Forex = lazy(() => import('../../components/tradingview/TradingViewForexWidget'));
const StockHeatmap = lazy(
  () => import('../../components/tradingview/TradingViewStockHeatmapWidget'),
);
const EtfHeatmap = lazy(() => import('../../components/tradingview/TradingViewETFHeatmapWidget'));
const CryptoHeatmap = lazy(
  () => import('../../components/tradingview/TradingViewCryptoHeatmapWidget'),
);
const EconomicCalendar = lazy(
  () => import('../../components/tradingview/TradingViewEconomicCalendarWidget'),
);

/** The live tab's six views, labels and descriptions. */
const WATCH_SECTIONS: WatchSection[] = [
  {
    id: 'overview',
    label: 'Market Overview',
    description: 'Global market summary and key indices',
    kind: 'line',
    widget: MarketOverview,
  },
  {
    id: 'forex',
    label: 'Forex Rates',
    description: 'Real-time currency exchange rates',
    kind: 'fx',
    widget: Forex,
  },
  {
    id: 'stocks',
    label: 'Stocks Heatmap',
    description: 'S&P 500 sector performance',
    kind: 'tiles',
    widget: StockHeatmap,
  },
  {
    id: 'etfs',
    label: 'ETFs Heatmap',
    description: 'US Exchange Traded Funds performance',
    kind: 'tiles',
    widget: EtfHeatmap,
  },
  {
    id: 'crypto',
    label: 'Crypto Heatmap',
    description: 'Cryptocurrency market visualization',
    kind: 'tiles',
    widget: CryptoHeatmap,
  },
  {
    id: 'economic-calendar',
    label: 'Economic Calendar',
    description: 'Upcoming economic events',
    kind: 'table',
    widget: EconomicCalendar,
  },
];

/** How long the previous widget gets to clean up (the live tab's delay). */
const UNMOUNT_DELAY_MS = 350;

interface ResourcesMarketWatchProps {
  active: string;
  onSelect: (id: string) => void;
}

export function ResourcesMarketWatch({ active, onSelect }: ResourcesMarketWatchProps) {
  const base = useId();
  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = `${base}-panel`;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const current = WATCH_SECTIONS.find((s) => s.id === active) ?? WATCH_SECTIONS[0];

  // The widget actually mounted. It trails `active` by the unmount delay.
  const [mounted, setMounted] = useState<string | null>(current.id);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setMounted(null);
    const timer = setTimeout(() => setMounted(current.id), UNMOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [current.id]);

  const host = useRef<HTMLDivElement>(null);
  const ready = useWidgetReady(host, mounted);
  const Widget = WATCH_SECTIONS.find((s) => s.id === mounted)?.widget;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = WATCH_SECTIONS.length - 1;
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const back = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    const next = forward
      ? (i + 1) % (last + 1)
      : back
        ? (i + last) % (last + 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : -1;
    if (next < 0) return;
    event.preventDefault();
    onSelect(WATCH_SECTIONS[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <section className="nw-in nwrs-tabsec" aria-labelledby={`${base}-title`}>
      <div className="nw-wrap">
        <p className="nw-eyebrow nwrs-eyebrow">Market Watch</p>
        <h2 id={`${base}-title`} className="nwrs-h2 nwrs-h2--tight">
          Live markets, <span className="nwrs-accent-l">at a glance</span>
        </h2>
        <div className="nwrs-mw">
          <div
            className="nwrs-strip nwrs-mwlist"
            role="tablist"
            aria-label="Market Watch sections"
            aria-orientation="vertical"
          >
            {WATCH_SECTIONS.map((section, i) => {
              const on = section.id === current.id;
              return (
                <button
                  key={section.id}
                  ref={(el) => {
                    buttons.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={tabId(section.id)}
                  aria-selected={on}
                  aria-controls={on ? panelId : undefined}
                  aria-label={`View ${section.label}`}
                  tabIndex={on ? 0 : -1}
                  className="nwrs-sec"
                  onClick={() => onSelect(section.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  <span className="nwrs-mwlabel">{section.label}</span>
                  <span className="nwrs-mwdesc">{section.description}</span>
                </button>
              );
            })}
          </div>
          <div
            className="nwrs-mwpanel"
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId(current.id)}
          >
            <div className="nwrs-mwhead">
              <div>
                <h3 className="nw-h nwrs-mwh">{current.label}</h3>
                <p className="nwrs-mwp">{current.description}</p>
              </div>
              <span className="nwrs-label nwrs-live">
                <span className="nwrs-pulse nwrs-live-dot" aria-hidden="true" />
                Live · TradingView
              </span>
            </div>
            <div className="nwrs-mwbody" aria-busy={!ready}>
              {ready ? null : <WidgetPlaceholder kind={current.kind} />}
              <div
                ref={host}
                className={ready ? 'nwrs-widget' : 'nwrs-widget nwrs-widget--pending'}
              >
                {Widget ? (
                  <Suspense fallback={null}>
                    <Widget key={mounted} />
                  </Suspense>
                ) : null}
              </div>
              <p className="nwrs-mwnote">
                {ready
                  ? 'Market data is provided by TradingView and is for information only.'
                  : 'Widget preview — the live TradingView widget streams in when this section opens. Market data is provided by TradingView and is for information only.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * True once the mounted widget is showing something: its TradingView frame
 * has loaded, or it has swapped its container for its own failure message.
 */
function useWidgetReady(host: RefObject<HTMLDivElement>, mounted: string | null): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const el = host.current;
    if (!el || !mounted) return;
    const watched = new Set<HTMLIFrameElement>();
    const onLoad = () => setReady(true);
    const check = () => {
      el.querySelectorAll('iframe').forEach((frame) => {
        if (watched.has(frame)) return;
        watched.add(frame);
        frame.addEventListener('load', onLoad, { once: true });
      });
      if (el.childElementCount > 0 && !el.querySelector('.tradingview-widget-container')) {
        setReady(true);
      }
    };
    const observer = new MutationObserver(check);
    observer.observe(el, { childList: true, subtree: true });
    check();
    return () => {
      observer.disconnect();
      watched.forEach((frame) => frame.removeEventListener('load', onLoad));
    };
  }, [host, mounted]);
  return ready;
}

const ROWS = [0, 1, 2, 3, 4, 5, 6];

/** The board's stand-in for each kind of view while the widget loads. */
function WidgetPlaceholder({ kind }: { kind: Kind }) {
  if (kind === 'line') {
    return (
      <div aria-hidden="true">
        <div className="nwrs-skel-stats">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="nwrs-skel-stat">
              <div className="nwrs-skel nwrs-skel-a" />
              <div className="nwrs-skel nwrs-skel-b" />
            </div>
          ))}
        </div>
        <svg
          className="nwrs-skel-chart"
          viewBox="0 0 800 260"
          width="100%"
          height="260"
          preserveAspectRatio="none"
        >
          <g stroke="#EFEBE3">
            <line x1="0" y1="52" x2="800" y2="52" />
            <line x1="0" y1="104" x2="800" y2="104" />
            <line x1="0" y1="156" x2="800" y2="156" />
            <line x1="0" y1="208" x2="800" y2="208" />
          </g>
          <path
            d="M0 190 C 60 180, 90 150, 150 160 S 260 120, 320 128 S 420 80, 480 96 S 590 60, 650 70 S 760 40, 800 46"
            fill="none"
            stroke="#B9BFCA"
            strokeWidth="1.5"
            strokeDasharray="4 5"
          />
        </svg>
      </div>
    );
  }
  if (kind === 'fx') {
    return (
      <div className="nwrs-skel-rows" aria-hidden="true">
        {ROWS.map((i) => (
          <div key={i} className="nwrs-skel-row">
            <div className="nwrs-skel" style={{ width: 80, height: 10 }} />
            <div className="nwrs-skel" style={{ flex: 1, height: 10 }} />
            <div className="nwrs-skel" style={{ width: 70, height: 10 }} />
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'tiles') {
    const spans: [number, number][] = [
      [2, 3],
      [2, 2],
      [2, 2],
      [1, 1],
      [1, 1],
      [2, 1],
      [3, 2],
      [1, 2],
      [2, 1],
      [2, 1],
      [2, 2],
      [2, 2],
      [2, 2],
    ];
    return (
      <div className="nwrs-skel-tiles" aria-hidden="true">
        {spans.map(([cols, rows], i) => (
          <div
            key={i}
            className="nwrs-skel"
            style={{ gridColumn: `span ${cols}`, gridRow: `span ${rows}` }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="nwrs-skel-rows nwrs-skel-rows--table" aria-hidden="true">
      {ROWS.map((i) => (
        <div key={i} className="nwrs-skel-row">
          <div className="nwrs-skel" style={{ width: 64, height: 10 }} />
          <div className="nwrs-skel" style={{ flex: 1, height: 10 }} />
          <div className="nwrs-skel" style={{ width: 90, height: 10 }} />
        </div>
      ))}
    </div>
  );
}
