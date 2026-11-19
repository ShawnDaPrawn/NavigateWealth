/**
 * ResourcesTabs — the strip that switches the page between its four sections.
 *
 * Each tab is one of the live page's `?section=` values, and choosing one
 * rewrites the address the way the live page does, so the footer's and the
 * home page's deep links keep landing on the right tab. The strip follows the
 * WAI-ARIA tabs pattern: one tab stop, arrow keys, Home and End.
 */
import { forwardRef, useRef, type KeyboardEvent } from 'react';
import type { ResourceSection } from './resourcesModel';

export interface ResourcesTab {
  key: ResourceSection;
  label: string;
  /** Shown beside the label when known (counted from the data). */
  count?: number;
}

interface ResourcesTabsProps {
  tabs: ResourcesTab[];
  active: ResourceSection;
  onSelect: (key: ResourceSection) => void;
  tabId: (key: ResourceSection) => string;
  panelId: (key: ResourceSection) => string;
}

export const ResourcesTabs = forwardRef<HTMLDivElement, ResourcesTabsProps>(function ResourcesTabs(
  { tabs, active, onSelect, tabId, panelId },
  ref,
) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = tabs.length - 1;
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
    onSelect(tabs[next].key);
    buttons.current[next]?.focus();
  };

  return (
    <div className="nwrs-tabbar" ref={ref}>
      <div className="nw-wrap">
        <div className="nwrs-strip nwrs-sectabs" role="tablist" aria-label="Resource sections">
          {tabs.map((tab, i) => {
            const on = tab.key === active;
            return (
              <button
                key={tab.key}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                role="tab"
                id={tabId(tab.key)}
                aria-selected={on}
                // Only the open section's panel is rendered.
                aria-controls={on ? panelId(tab.key) : undefined}
                tabIndex={on ? 0 : -1}
                className="nwrs-tab nwrs-sectab"
                onClick={() => onSelect(tab.key)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <span>{tab.label}</span>
                {tab.count ? <span className="nwrs-tabcount">{tab.count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
