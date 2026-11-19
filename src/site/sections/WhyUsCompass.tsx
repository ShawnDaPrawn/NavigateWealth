/**
 * WhyUsCompass — the core values as the four cardinal points of a compass.
 *
 * The points are tabs (WAI-ARIA tabs pattern: arrow keys, Home and End move
 * between them, and selection follows focus); the card beside the dial is
 * their tab panel, with previous and next buttons as the board draws them.
 * The needle swings to the selected point; under reduced motion it moves at
 * once (navigator.css shortens every transition there).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { SectionHead } from './SectionHead';
import { CheckIcon, ChevronIcon } from './WhyUsIcons';
import { pad2 } from './format';
import '../styles/sections.css';
import '../styles/why-us.css';

export type CardinalPoint = 'N' | 'E' | 'S' | 'W';

export interface CoreValue {
  title: string;
  card: CardinalPoint;
  bearing: string;
  description: string;
  features: readonly string[];
}

const NEEDLE_DEG: Record<CardinalPoint, number> = { N: 0, E: 90, S: 180, W: 270 };

interface WhyUsCompassProps {
  index: string;
  kicker: string;
  title: string;
  lead: string;
  values: readonly CoreValue[];
}

export function WhyUsCompass({ index, kicker, title, lead, values }: WhyUsCompassProps) {
  const [current, setCurrent] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const id = useId();
  const count = values.length;
  const value = values[current];

  // The card fades in afresh for each value, as it does on first view. The
  // animation is restarted in place rather than by remounting the card, so a
  // focused previous/next button keeps focus.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = panel.current;
    if (!el || typeof el.getAnimations !== 'function') return;
    for (const animation of el.getAnimations()) {
      animation.cancel();
      animation.play();
    }
  }, [current]);

  const select = (i: number, focus = false) => {
    const next = (i + count) % count;
    setCurrent(next);
    if (focus) tabs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowDown: current + 1,
      ArrowLeft: current - 1,
      ArrowUp: current - 1,
      Home: 0,
      End: count - 1,
    };
    if (!(event.key in target)) return;
    event.preventDefault();
    select(target[event.key], true);
  };

  const tabId = (i: number) => `${id}-tab-${i}`;
  const panelId = `${id}-panel`;

  return (
    <section className="nw-sec nwwu-values" aria-labelledby="nwwu-values-title">
      <div className="nw-wrap nwwu-rel">
        <SectionHead
          index={index}
          kicker={kicker}
          title={title}
          lead={lead}
          center
          titleId="nwwu-values-title"
          className="nwwu-values-head"
        />

        <div className="nwwu-values-grid">
          <div
            className="nwwu-compass"
            role="tablist"
            aria-label="Core values"
            onKeyDown={onKeyDown}
          >
            <svg
              className="nwwu-dial"
              viewBox="0 0 480 480"
              width="100%"
              height="100%"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <linearGradient id="nwwu-needle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#E3D9C3" />
                  <stop offset="1" stopColor="#6D28D9" />
                </linearGradient>
                <radialGradient id="nwwu-dial" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#0D1626" stopOpacity="0.3" />
                  <stop offset="0.75" stopColor="#0D1626" stopOpacity="0.05" />
                  <stop offset="1" stopColor="#0D1626" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="240" cy="240" r="236" fill="url(#nwwu-dial)" />
              <circle cx="240" cy="240" r="200" fill="none" stroke="rgba(13,22,38,0.16)" />
              <circle
                cx="240"
                cy="240"
                r="186"
                fill="none"
                stroke="rgba(13,22,38,0.22)"
                strokeWidth="8"
                strokeDasharray="1 15.23"
              />
              <circle
                cx="240"
                cy="240"
                r="186"
                fill="none"
                stroke="#5E6676"
                strokeOpacity="0.7"
                strokeWidth="16"
                strokeDasharray="2 95.39"
              />
              <circle
                cx="240"
                cy="240"
                r="120"
                fill="none"
                stroke="rgba(13,22,38,0.09)"
                strokeDasharray="2 6"
              />
              <line x1="60" y1="240" x2="420" y2="240" stroke="rgba(13,22,38,0.06)" />
              <line x1="240" y1="60" x2="240" y2="420" stroke="rgba(13,22,38,0.06)" />
              <polygon
                points="240,120 256,224 360,240 256,256 240,360 224,256 120,240 224,224"
                fill="rgba(255,255,255,0.03)"
                stroke="rgba(13,22,38,0.18)"
              />
              <g
                className="nwwu-needle"
                data-testid="compass-needle"
                style={{ transform: `rotate(${NEEDLE_DEG[value.card]}deg)` }}
              >
                <polygon points="240,96 250,240 230,240" fill="url(#nwwu-needle)" />
                <polygon points="240,384 250,240 230,240" fill="rgba(255,255,255,0.22)" />
              </g>
              <circle cx="240" cy="240" r="11" fill="#0D1626" stroke="#5E6676" strokeWidth="2" />
              <circle cx="240" cy="240" r="3.5" fill="#E3D9C3" />
            </svg>
            {values.map((v, i) => {
              const selected = i === current;
              return (
                <button
                  key={v.title}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={tabId(i)}
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  className={`nwwu-pt nwwu-tab nwwu-tab--${v.card.toLowerCase()}`}
                  onClick={() => select(i)}
                >
                  <span className="nw-mono nwwu-tab-card" aria-hidden="true">
                    {v.card}
                  </span>
                  {v.title}
                </button>
              );
            })}
          </div>

          <div
            ref={panel}
            className="nw-in nwwu-panel"
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId(current)}
          >
            <div className="nwwu-panel-top">
              <span className="nw-mono nwwu-panel-bearing">
                Bearing {value.bearing} · {value.card}
              </span>
              <span className="nw-mono nwwu-panel-pos">
                {pad2(current + 1)} / {pad2(count)}
              </span>
            </div>
            <h3 className="nwwu-panel-title">{value.title}</h3>
            <p className="nwwu-panel-desc">{value.description}</p>
            <ul className="nwwu-panel-feats">
              {value.features.map((feature) => (
                <li key={feature}>
                  <CheckIcon size={16} stroke="#5E6676" />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="nwwu-panel-nav">
              <button
                type="button"
                className="nwwu-pt nwwu-step-btn"
                aria-label="Previous value"
                onClick={() => select(current - 1)}
              >
                <ChevronIcon direction="left" size={18} />
              </button>
              <button
                type="button"
                className="nwwu-pt nwwu-step-btn"
                aria-label="Next value"
                onClick={() => select(current + 1)}
              >
                <ChevronIcon direction="right" size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
