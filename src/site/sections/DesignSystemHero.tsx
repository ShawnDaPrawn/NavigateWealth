/**
 * The Design System page's hero and its tab bar, as the "Design system"
 * board draws them. The tabs are real tabs (arrow keys, Home and End move
 * between them, as the live page's Radix tabs do); on phones the board swaps
 * them for a select.
 */
import { useRef, type KeyboardEvent, type RefObject } from 'react';
import { DsIcon } from './DesignSystemIcons';
import { DS_TABS, panelId, tabId, type DsTabId } from './designSystemModel';

const HERO_TRUST = ['React + TypeScript', 'Tailwind CSS v4', 'shadcn/ui', 'WCAG AA'];

export function DesignSystemHero({ heroRef }: { heroRef: RefObject<HTMLElement> }) {
  return (
    <section className="nwds-hero" ref={heroRef} aria-labelledby="nwds-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <svg
        className="nwds-hero-mark"
        aria-hidden="true"
        width="520"
        height="520"
        viewBox="0 0 480 480"
        fill="none"
      >
        <circle cx="240" cy="240" r="220" stroke="rgba(255,255,255,0.07)" />
        <circle
          cx="240"
          cy="240"
          r="206"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
          strokeDasharray="1 16.97"
        />
        <circle cx="240" cy="240" r="140" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 6" />
        <polygon
          points="240,110 258.4,221.6 370,240 258.4,258.4 240,370 221.6,258.4 110,240 221.6,221.6"
          stroke="rgba(246, 244, 239, 0.14)"
        />
      </svg>
      <div className="nw-wrap nwds-hero-inner">
        <span className="nwds-version">
          <DsIcon name="code" size={14} />
          Design System v6 · Navigator
        </span>
        <h1 id="nwds-title" className="nw-h nwds-h1">
          Navigate Wealth <span className="nw-accent">Design System</span>
        </h1>
        <p className="nwds-hero-lead">
          The authoritative source for the tokens, type, components, patterns and section layouts
          powering the Navigate Wealth platform. Change a token here and every page follows.
        </p>
        <ul className="nw-trust nw-trust--dark">
          {HERO_TRUST.map((item) => (
            <li key={item}>
              <DsIcon name="check" size={14} />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

interface DesignSystemTabsProps {
  active: DsTabId;
  onSelect: (id: DsTabId) => void;
}

export function DesignSystemTabs({ active, onSelect }: DesignSystemTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = DS_TABS.findIndex((t) => t.id === active);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % DS_TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + DS_TABS.length) % DS_TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = DS_TABS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    onSelect(DS_TABS[next].id);
    listRef.current?.querySelector<HTMLButtonElement>(`#${tabId(DS_TABS[next].id)}`)?.focus();
  };

  return (
    <div className="nwds-tabbar">
      <div className="nw-wrap">
        <div className="nwds-tabs" role="tablist" aria-label="Design system sections" ref={listRef}>
          {DS_TABS.map((t) => (
            <button
              key={t.id}
              id={tabId(t.id)}
              type="button"
              role="tab"
              className="nwds-tab"
              aria-selected={t.id === active}
              aria-controls={panelId(t.id)}
              tabIndex={t.id === active ? 0 : -1}
              onClick={() => onSelect(t.id)}
              onKeyDown={onKeyDown}
            >
              <DsIcon name={t.icon} size={15} />
              {t.label}
            </button>
          ))}
        </div>
        <label className="nwds-tabsel">
          <span className="nw-sr-only">Design system section</span>
          <select value={active} onChange={(e) => onSelect(e.target.value as DsTabId)}>
            {DS_TABS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <DsIcon name="chevron-down" size={16} />
        </label>
      </div>
    </div>
  );
}
