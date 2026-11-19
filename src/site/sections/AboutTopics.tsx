/**
 * AboutTopics — "Discover Navigate Wealth": a column of topic tabs beside one
 * panel (a wrapping row of tabs above it on phones).
 *
 * Every panel is rendered and the inactive ones carry `hidden`, so all four
 * topics are in the document for search engines and find-in-page, not only
 * the first. Tabs follow the WAI-ARIA pattern: arrow keys (either axis, since
 * the column becomes a row on phones), Home and End; only the selected tab is
 * in the tab order.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { pad2 } from './format';
import '../styles/sections.css';
import '../styles/about.css';

export interface AboutTopic {
  key: string;
  label: string;
  title: string;
  description: string;
  items: { title: string; text: string }[];
}

interface AboutTopicsProps {
  kicker: string;
  title: string;
  lead: string;
  /** The tab list's accessible name, e.g. "About Navigate Wealth". */
  tabsLabel: string;
  topics: AboutTopic[];
}

export function AboutTopics({ kicker, title, lead, tabsLabel, topics }: AboutTopicsProps) {
  const base = useId();
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = topics.length;
  const tabId = (i: number) => `${base}-tab-${i}`;
  const panelId = (i: number) => `${base}-panel-${i}`;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = {
      ArrowDown: active + 1,
      ArrowRight: active + 1,
      ArrowUp: active - 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: count - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = (moves[e.key] + count) % count;
    setActive(next);
    tabRefs.current[next]?.focus({ preventScroll: true });
  };

  if (count === 0) return null;

  return (
    <section className="nwab-topics" aria-labelledby={`${base}-title`}>
      <div className="nw-wrap">
        <div className="nwab-head">
          <p className="nw-kicker nw-mono nwab-kicker">{kicker}</p>
          <h2 id={`${base}-title`} className="nwab-h2">
            {title}
          </h2>
          <p className="nwab-lead">{lead}</p>
        </div>

        <div className="nwab-switch">
          <div role="tablist" aria-label={tabsLabel} className="nwab-tablist">
            {topics.map((t, i) => (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={tabId(i)}
                aria-selected={i === active}
                aria-controls={panelId(i)}
                tabIndex={i === active ? 0 : -1}
                className="nwab-tab"
                onClick={() => setActive(i)}
                onKeyDown={onTabKey}
              >
                <span className="nwab-tab-no nw-mono" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
                <span className="nwab-tab-label">{t.label}</span>
              </button>
            ))}
          </div>

          {topics.map((t, i) => (
            <div
              key={t.key}
              role="tabpanel"
              id={panelId(i)}
              aria-labelledby={tabId(i)}
              hidden={i !== active}
              className="nwab-panel nw-in"
            >
              <h3 className="nwab-panel-title">{t.title}</h3>
              <p className="nwab-panel-desc">{t.description}</p>
              <ul className="nwab-cards">
                {t.items.map((item, n) => (
                  <li key={item.title} className="nwab-card">
                    <span className="nwab-card-no nw-mono" aria-hidden="true">
                      {pad2(n + 1)}
                    </span>
                    <h4 className="nwab-card-title">{item.title}</h4>
                    <p className="nwab-card-text">{item.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
