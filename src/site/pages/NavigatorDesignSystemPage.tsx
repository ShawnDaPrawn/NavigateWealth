/**
 * NavigatorDesignSystemPage — the redesigned /design-system page.
 *
 * The layout is the "Design system" board of the Website Redesign canvas. What
 * the live page (DesignSystemPage.tsx) does, it still does:
 * - the same eight tabs, under the same values; choosing one (a tab, an
 *   overview card or a phone's select) scrolls the page to the tab bar, as the
 *   live page's navigateToTab does;
 * - "Copy" buttons copy through the site's clipboard helper and read "Copied"
 *   for two seconds; the CLI commands are the live Download tab's;
 * - the back-to-top button appears once the page has scrolled 600px;
 * - no <SEO> tags: like the live page, the route is kept out of search by
 *   robots.txt, the X-Robots-Tag header (vercel.json) and the prerender's
 *   noindex list, none of which this page changes.
 *
 * Beyond the board: the tabs are a real tablist (arrow keys, Home, End) with
 * labelled panels; each copy is announced in a polite live region; and the
 * board's example links to "#" are drawn as links without a destination.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../../utils/clipboard';
import {
  ComponentsPanel,
  DownloadPanel,
  IconsPanel,
  PatternsPanel,
  SectionsPanel,
  type CopyControl,
} from '../sections/DesignSystemCatalogue';
import { DesignSystemHero, DesignSystemTabs } from '../sections/DesignSystemHero';
import { DsIcon } from '../sections/DesignSystemIcons';
import { ColoursPanel, OverviewPanel, TypographyPanel } from '../sections/DesignSystemPanels';
import { DesignSystemPartnership } from '../sections/DesignSystemPartnership';
import { panelId, tabId, type DsTabId } from '../sections/designSystemModel';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/design-system.css';

/** The live page's thresholds and timings. */
const SHOW_TOP_AFTER = 600;
const COPIED_FOR_MS = 2000;
/** The sticky site header's height once its top bar has collapsed. */
const HEADER_HEIGHT = 72;

export function NavigatorDesignSystemPage() {
  const [tab, setTab] = useState<DsTabId>('overview');
  const [showTop, setShowTop] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const heroRef = useRef<HTMLElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > SHOW_TOP_AFTER);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(copiedTimer.current);
    };
  }, []);

  // The live page scrolls to the tab bar whenever a tab is chosen. The tab bar
  // is sticky, so its resting place — the hero's foot — is measured instead.
  const navigateToTab = useCallback((next: DsTabId) => {
    setTab(next);
    const hero = heroRef.current;
    const top = hero ? hero.offsetTop + hero.offsetHeight - HEADER_HEIGHT : 0;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, []);

  const copy = useCallback<CopyControl['copy']>(async (key, text, what) => {
    try {
      await copyToClipboard(text);
    } catch {
      setAnnouncement('Copying failed. Select the text and copy it instead.');
      return;
    }
    setCopied(key);
    setAnnouncement(`${what} copied.`);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), COPIED_FOR_MS);
  }, []);

  const control: CopyControl = { copied, copy };

  return (
    <div className="nw-site nwds">
      <DesignSystemHero heroRef={heroRef} />
      <DesignSystemTabs active={tab} onSelect={navigateToTab} />

      <div className="nwds-main">
        <div className="nw-wrap">
          <div
            key={tab}
            className="nw-in"
            role="tabpanel"
            id={panelId(tab)}
            aria-labelledby={tabId(tab)}
          >
            {tab === 'overview' ? <OverviewPanel onNavigate={navigateToTab} /> : null}
            {tab === 'colors' ? <ColoursPanel /> : null}
            {tab === 'typography' ? <TypographyPanel /> : null}
            {tab === 'components' ? <ComponentsPanel control={control} /> : null}
            {tab === 'patterns' ? <PatternsPanel control={control} /> : null}
            {tab === 'icons' ? <IconsPanel control={control} /> : null}
            {tab === 'sections' ? <SectionsPanel control={control} /> : null}
            {tab === 'download' ? <DownloadPanel control={control} /> : null}
          </div>
        </div>
      </div>

      <DesignSystemPartnership />

      <p className="nw-sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {showTop ? (
        <button
          type="button"
          className="nwds-totop nw-in"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <DsIcon name="arrow-up" size={20} />
        </button>
      ) : null}
    </div>
  );
}

export default NavigatorDesignSystemPage;
