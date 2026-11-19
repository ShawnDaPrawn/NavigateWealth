/**
 * HomeHero — the home page's opening, as the "Main" board draws it: badge,
 * four rotating slides (each slide's headline is the page's H1, so the first
 * one is what search engines read), the compass "instrument" and the trust
 * strip.
 *
 * Rotation follows the WAI-ARIA carousel pattern without adding anything the
 * board does not show:
 * - hovering or focusing the slides pauses it while you are there;
 * - with reduced motion requested, it does not rotate on its own;
 * - while it runs the slides are not a live region, so a screen reader is not
 *   interrupted; while paused, changing slide is announced.
 *
 * The timer is the progress bar itself: a slide advances when its bar's fill
 * animation ends, so pausing the animation pauses the slide and the two can
 * never drift apart.
 */
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import type { TrustFact } from '../../config/companyFacts';
import { pad2 } from './format';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/home.css';

export interface HeroAction {
  text: string;
  link: string;
}

export interface HeroSlide {
  id: number;
  title: string;
  accent: string;
  description: string;
  primary: HeroAction;
  secondary: HeroAction;
}

interface HomeHeroProps {
  badge: string;
  flagSrc: string;
  slides: readonly HeroSlide[];
  trustFacts: readonly TrustFact[];
  slideMs?: number;
}

/** One compass heading per slide, purely decorative. */
const HEADINGS = [
  { deg: 32, label: '032° NNE' },
  { deg: 58, label: '058° ENE' },
  { deg: 14, label: '014° NNE' },
  { deg: 76, label: '076° ENE' },
] as const;
const PRETORIA = '25°44′S 28°11′E';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function HomeHero({ badge, flagSrc, slides, trustFacts, slideMs = 8000 }: HomeHeroProps) {
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) setAutoplay(false);
  }, []);

  if (slides.length === 0) return null;
  const slide = slides[index % slides.length];
  const running = autoplay && !hovered && !focused && slides.length > 1;
  const compass = HEADINGS[index % HEADINGS.length];
  const advance = () => setIndex((i) => (i + 1) % slides.length);

  return (
    <section className="nwhh" aria-label="Hero">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nw-wrap nwhh-inner">
        <div className="nwhh-grid">
          <div>
            <p className="nwhh-pill">
              <img src={flagSrc} alt="" width={24} height={17} />
              {badge}
            </p>

            <div
              className="nwhh-slides"
              role="group"
              aria-roledescription="carousel"
              aria-label="Highlights"
              aria-live={running ? 'off' : 'polite'}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onFocus={() => setFocused(true)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
              }}
            >
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${slides.length}`}
              >
                <h1 className="nwhh-title nwhh-up">
                  {slide.title} <span className="nw-accent">{slide.accent}</span>
                </h1>
                <p className="nwhh-lead nwhh-up2">{slide.description}</p>
                <div className="nwhh-ctas nwhh-up3">
                  <Link className="nw-btn nw-btn--lg" to={slide.primary.link}>
                    {slide.primary.text}
                    <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                  <Link className="nw-ghost-dark nw-btn--lg" to={slide.secondary.link}>
                    {slide.secondary.text}
                  </Link>
                </div>
              </div>
            </div>

            {slides.length > 1 ? (
              <div className="nwhh-controls">
                <span className="nwhh-count nw-mono" aria-hidden="true">
                  {pad2(index + 1)} / {pad2(slides.length)}
                </span>
                <div className="nwhh-dots">
                  {slides.map((s, i) => {
                    const active = i === index;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className="nwhh-dot"
                        aria-label={`Show highlight ${i + 1} of ${slides.length}`}
                        aria-current={active ? 'true' : undefined}
                        onClick={() => setIndex(i)}
                      >
                        <span className="nwhh-dot-bar">
                          {active ? (
                            <span
                              key={`${s.id}-${index}`}
                              className="nwhh-dot-fill"
                              data-testid="hero-progress"
                              style={
                                {
                                  '--nwhh-slide-ms': `${slideMs}ms`,
                                  animationPlayState: running ? 'running' : 'paused',
                                } as CSSProperties
                              }
                              onAnimationEnd={advance}
                            />
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="nwhh-chip" aria-hidden="true">
              <MiniCompass deg={compass.deg} />
              <div>
                <div className="nwhh-chip-l nw-mono">Heading {compass.label}</div>
                <div className="nwhh-chip-v nw-mono">Pretoria · {PRETORIA}</div>
              </div>
            </div>
          </div>

          <div className="nwhh-dial" aria-hidden="true">
            <Compass deg={compass.deg} />
            <div className="nwhh-readout nwhh-readout--tl">
              <div className="nwhh-readout-l nw-mono">Heading</div>
              <div className="nwhh-readout-v nw-mono">{compass.label}</div>
            </div>
            <div className="nwhh-readout nwhh-readout--br">
              <div className="nwhh-readout-l nw-mono">Pretoria</div>
              <div className="nwhh-readout-v nw-mono">{PRETORIA.replace(' ', ' · ')}</div>
            </div>
          </div>
        </div>

        <ul className="nwhh-trust" aria-label="About the practice">
          {trustFacts.map(({ value, label, icon: Icon }) => (
            <li key={value}>
              <span className="nwhh-trust-icon" aria-hidden="true">
                <Icon size={19} strokeWidth={1.75} />
              </span>
              <span>
                <span className="nwhh-trust-v">{value}</span>
                <span className="nwhh-trust-l">{label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The large compass rose beside the slides (desktop only). */
function Compass({ deg }: { deg: number }) {
  const uid = useId().replace(/:/g, '');
  const needle = `nwhh-needle-${uid}`;
  const dial = `nwhh-dial-${uid}`;
  const marks: [string, number, number][] = [
    ['030', 330, 88],
    ['060', 396, 154],
    ['120', 396, 334],
    ['150', 330, 400],
    ['210', 150, 400],
    ['240', 84, 334],
    ['300', 84, 154],
    ['330', 150, 88],
  ];
  return (
    <svg viewBox="0 0 480 480" width="500" height="500" focusable="false">
      <defs>
        <linearGradient id={needle} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3D9C3" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
        <radialGradient id={dial} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#0D1626" stopOpacity="0.26" />
          <stop offset="0.72" stopColor="#0D1626" stopOpacity="0.05" />
          <stop offset="1" stopColor="#0D1626" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="240" r="236" fill={`url(#${dial})`} />
      <circle cx="240" cy="240" r="224" fill="none" stroke="rgba(255,255,255,0.16)" />
      <circle
        cx="240"
        cy="240"
        r="208"
        fill="none"
        stroke="rgba(255,255,255,0.24)"
        strokeWidth="8"
        strokeDasharray="1 17.15"
      />
      <circle
        cx="240"
        cy="240"
        r="208"
        fill="none"
        stroke="#C5CAD3"
        strokeOpacity="0.75"
        strokeWidth="16"
        strokeDasharray="2 106.92"
      />
      <circle
        cx="240"
        cy="240"
        r="150"
        fill="none"
        stroke="rgba(255,255,255,0.09)"
        strokeDasharray="2 6"
      />
      <circle cx="240" cy="240" r="96" fill="none" stroke="rgba(255,255,255,0.1)" />
      <line x1="40" y1="240" x2="440" y2="240" stroke="rgba(255,255,255,0.06)" />
      <line x1="240" y1="40" x2="240" y2="440" stroke="rgba(255,255,255,0.06)" />
      <g
        fontFamily="Inter Variable, Inter, sans-serif"
        fontSize="11"
        fill="#9AA3B2"
        textAnchor="middle"
      >
        <text x="240" y="64" fill="#E3D9C3" fontSize="15" fontWeight="600">
          N
        </text>
        <text x="420" y="245" fill="#C5CAD3" fontSize="14" fontWeight="600">
          E
        </text>
        <text x="240" y="425" fill="#C5CAD3" fontSize="14" fontWeight="600">
          S
        </text>
        <text x="60" y="245" fill="#C5CAD3" fontSize="14" fontWeight="600">
          W
        </text>
        {marks.map(([label, x, y]) => (
          <text key={label} x={x} y={y}>
            {label}
          </text>
        ))}
      </g>
      <polygon
        points="296.6,183.4 258,240 296.6,296.6 240,258 183.4,296.6 222,240 183.4,183.4 240,222"
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.12)"
      />
      <polygon
        points="240,112 258.4,221.6 368,240 258.4,258.4 240,368 221.6,258.4 112,240 221.6,221.6"
        fill="rgba(255,255,255,0.03)"
        stroke="rgba(255,255,255,0.18)"
      />
      <polyline
        points="96,372 168,318 238,262 314,196 372,128"
        fill="none"
        stroke="#C5CAD3"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeDasharray="5 6"
      />
      <circle cx="168" cy="318" r="4" fill="#0D1626" stroke="#C5CAD3" strokeWidth="1.5" />
      <circle cx="314" cy="196" r="4" fill="#0D1626" stroke="#C5CAD3" strokeWidth="1.5" />
      <circle
        cx="372"
        cy="128"
        r="6"
        fill="#C5CAD3"
        fillOpacity="0.25"
        stroke="#C5CAD3"
        strokeWidth="1.5"
      />
      <g className="nwhh-needle" style={{ transform: `rotate(${deg}deg)` }}>
        <polygon points="240,78 251,240 229,240" fill={`url(#${needle})`} />
        <polygon points="240,402 251,240 229,240" fill="rgba(255,255,255,0.22)" />
      </g>
      <circle cx="240" cy="240" r="12" fill="#0D1626" stroke="#C5CAD3" strokeWidth="2" />
      <circle cx="240" cy="240" r="3.5" fill="#E3D9C3" />
    </svg>
  );
}

/** The small compass in the phone chip. */
function MiniCompass({ deg }: { deg: number }) {
  return (
    <svg width="52" height="52" viewBox="0 0 480 480" focusable="false">
      <circle
        cx="240"
        cy="240"
        r="224"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="12"
      />
      <circle
        cx="240"
        cy="240"
        r="196"
        fill="none"
        stroke="#C5CAD3"
        strokeOpacity="0.75"
        strokeWidth="28"
        strokeDasharray="4 98.63"
      />
      <g className="nwhh-needle" style={{ transform: `rotate(${deg}deg)` }}>
        <polygon points="240,64 264,240 216,240" fill="#C5CAD3" />
        <polygon points="240,416 264,240 216,240" fill="rgba(255,255,255,0.3)" />
      </g>
      <circle cx="240" cy="240" r="24" fill="#0D1626" stroke="#C5CAD3" strokeWidth="10" />
    </svg>
  );
}
