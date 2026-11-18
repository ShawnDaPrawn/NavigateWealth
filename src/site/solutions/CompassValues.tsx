/**
 * The four core values as the points of a compass. The points are WAI-ARIA
 * tabs (arrow keys, Home, End); every value's panel stays in the document
 * with `hidden`, so all four are there for search engines and find-in-page.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { pad2 } from '../sections/format';
import type { CoreValue } from './whyUsContent';

const POINTS = [
  { card: 'N', bearing: '000°', place: 'n' },
  { card: 'E', bearing: '090°', place: 'e' },
  { card: 'S', bearing: '180°', place: 's' },
  { card: 'W', bearing: '270°', place: 'w' },
] as const;

const MOVES: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export function CompassValues({ values }: { values: CoreValue[] }) {
  const base = useId();
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = Math.min(values.length, POINTS.length);
  const tabId = (i: number) => `${base}-tab-${i}`;
  const panelId = (i: number) => `${base}-panel-${i}`;

  const select = (i: number, focus: boolean) => {
    const next = (i + count) % count;
    setActive(next);
    if (focus) tabRefs.current[next]?.focus({ preventScroll: true });
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    let next: number | null = null;
    if (e.key in MOVES) next = active + MOVES[e.key];
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  };

  return (
    <div className="nwsol-values">
      <div role="tablist" aria-label="Core values" className="nwsol-compass">
        <svg className="nwsol-compass-dial" viewBox="0 0 480 480" aria-hidden="true">
          <defs>
            <linearGradient id="nwsol-needle-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E3D9C3" />
              <stop offset="1" stopColor="#6D28D9" />
            </linearGradient>
            <radialGradient id="nwsol-dial-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#0D1626" stopOpacity="0.3" />
              <stop offset="0.75" stopColor="#0D1626" stopOpacity="0.05" />
              <stop offset="1" stopColor="#0D1626" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="240" cy="240" r="236" fill="url(#nwsol-dial-grad)" />
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
          <g className="nwsol-needle" data-point={active}>
            <polygon points="240,96 250,240 230,240" fill="url(#nwsol-needle-grad)" />
            <polygon points="240,384 250,240 230,240" fill="rgba(255,255,255,0.22)" />
          </g>
          <circle cx="240" cy="240" r="11" fill="#0D1626" stroke="#5E6676" strokeWidth="2" />
          <circle cx="240" cy="240" r="3.5" fill="#E3D9C3" />
        </svg>
        {values.slice(0, count).map((v, i) => (
          <button
            key={v.title}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(i)}
            aria-selected={i === active}
            aria-controls={panelId(i)}
            tabIndex={i === active ? 0 : -1}
            className={`nwsol-pt nwsol-pt--${POINTS[i].place}`}
            onClick={() => select(i, false)}
            onKeyDown={onKey}
          >
            <span className="nwsol-pt-card nw-mono" aria-hidden="true">
              {POINTS[i].card}
            </span>
            {v.title}
          </button>
        ))}
      </div>

      <div className="nwsol-val-card">
        {values.slice(0, count).map((v, i) => (
          <div
            key={v.title}
            id={panelId(i)}
            role="tabpanel"
            aria-labelledby={tabId(i)}
            tabIndex={0}
            hidden={i !== active}
            className="nwsol-val-panel nw-in"
          >
            <div className="nwsol-val-meta nw-mono" aria-hidden="true">
              <span>
                Bearing {POINTS[i].bearing} · {POINTS[i].card}
              </span>
              <span className="nwsol-val-pos">
                {pad2(i + 1)} / {pad2(count)}
              </span>
            </div>
            <h3 className="nwsol-val-t">{v.title}</h3>
            <p className="nwsol-val-d">{v.description}</p>
            <ul className="nwsol-val-feats">
              {v.features.map((f) => (
                <li key={f}>
                  <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="nwsol-val-nav">
          <button
            type="button"
            className="nwsol-pt nwsol-pt--icon"
            aria-label="Previous value"
            onClick={() => select(active - 1, false)}
          >
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="nwsol-pt nwsol-pt--icon"
            aria-label="Next value"
            onClick={() => select(active + 1, false)}
          >
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
