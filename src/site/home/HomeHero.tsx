/**
 * The home page hero: the search-led H1, then the live site's four rotating
 * slides as supporting copy, the compass instrument and the trust strip.
 *
 * Every slide stays in the document; the inactive ones are hidden from view,
 * from assistive technology and from the tab order, and all four share one
 * grid cell so the hero never changes height as they rotate.
 *
 * Rotation (WCAG 2.2.2): an 8-second fill bar times each slide, so pausing is
 * simply pausing that animation. It pauses on hover and while focus is inside
 * the slides, has a pause button, and never starts for visitors who ask for
 * reduced motion — they move between slides with the dots alone.
 */
import { useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Pause, Play } from 'lucide-react';
import saFlag from 'figma:asset/543ae964645db88228743731ee3eebbbc2e3686e.png';
import { heroSlides } from '../../components/pages/homePageData';
import { COMPANY } from '../../config/companyFacts';
import { NwImage } from '../components/NwImage';
import { pad2 } from '../sections/format';
import { CompassBadge, HeroCompass } from './Compass';
import { TrustStrip } from './HomeParts';
import { HERO_SLIDE_MS, HOME_H1, prefersReducedMotion, saSpelling } from './homeContent';

export function HomeHero() {
  const count = heroSlides.length;
  const [index, setIndex] = useState(0);
  const [reduced] = useState(prefersReducedMotion);
  const [stopped, setStopped] = useState(reduced);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [moved, setMoved] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const running = !stopped && !hovered && !focused;

  const goTo = (i: number) => {
    setIndex((i + count) % count);
    setMoved(true);
  };

  const onPointer = (over: boolean) => (e: PointerEvent) => {
    // Touch has no hover: a tap would otherwise leave the slides paused.
    if (e.pointerType === 'mouse') setHovered(over);
  };
  const onBlur = (e: FocusEvent) => {
    if (!carouselRef.current?.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  return (
    <section className="nws-hero nwhm-hero" aria-labelledby="nwhm-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nwhm-glow" aria-hidden="true" />
      <div className="nw-wrap nws-hero-inner nwhm-hero-inner">
        <div className="nwhm-hero-copy">
          <p className="nwhm-pill">
            <NwImage
              src={saFlag}
              alt="South African flag"
              width={24}
              height={17}
              className="nwhm-flag"
              priority
            />
            <span>Proudly South African · Independent · FSP {COMPANY.fspNumber}</span>
          </p>
          <h1 id="nwhm-title" className="nws-h1 nwhm-h1">
            {HOME_H1}
          </h1>

          <div
            ref={carouselRef}
            className="nwhm-carousel"
            role="group"
            aria-roledescription="carousel"
            aria-label="Highlights"
            onPointerEnter={onPointer(true)}
            onPointerLeave={onPointer(false)}
            onFocus={() => setFocused(true)}
            onBlur={onBlur}
          >
            <div
              className={moved ? 'nwhm-slides nwhm-slides--moved' : 'nwhm-slides'}
              aria-live={running ? 'off' : 'polite'}
            >
              {heroSlides.map((slide, i) => {
                const active = i === index;
                const hide = active ? undefined : -1;
                return (
                  <div
                    key={slide.id}
                    className="nwhm-slide"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${i + 1} of ${count}`}
                    aria-hidden={active ? undefined : true}
                    data-active={active}
                  >
                    <p className="nws-slogan nwhm-slogan">
                      {slide.title} <span className="nw-accent">{slide.titleAccent.trim()}</span>
                    </p>
                    <p className="nws-lead nwhm-slide-p">{saSpelling(slide.description)}</p>
                    <div className="nws-ctas nwhm-ctas">
                      <Link
                        className="nw-btn nw-btn--lg nwhm-cta-main"
                        to={slide.primaryAction.link}
                        tabIndex={hide}
                      >
                        {slide.primaryAction.text}
                        <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
                      </Link>
                      <Link
                        className="nw-ghost-dark nw-btn--lg"
                        to={slide.secondaryAction.link}
                        tabIndex={hide}
                      >
                        {slide.secondaryAction.text}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="nwhm-controls">
              <span className="nwhm-count nw-mono" aria-hidden="true">
                {pad2(index + 1)} / {pad2(count)}
              </span>
              <div className="nwhm-dots">
                {heroSlides.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    className="nwhm-dot"
                    aria-label={`Go to slide ${i + 1}`}
                    aria-current={i === index ? 'true' : undefined}
                    onClick={() => goTo(i)}
                  >
                    <span className="nwhm-dotbar">
                      {i === index && !reduced ? (
                        <span
                          key={index}
                          className="nwhm-fill"
                          style={{ animationDuration: `${HERO_SLIDE_MS}ms` }}
                          data-running={running}
                          onAnimationEnd={() => goTo(index + 1)}
                        />
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
              {reduced ? null : (
                <button
                  type="button"
                  className="nwhm-pause"
                  aria-label={stopped ? 'Play slides' : 'Pause slides'}
                  onClick={() => setStopped((s) => !s)}
                >
                  {stopped ? (
                    <Play size={14} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Pause size={14} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          </div>

          <CompassBadge slide={index} />
        </div>

        <HeroCompass slide={index} />
      </div>
      <div className="nw-wrap">
        <TrustStrip />
      </div>
    </section>
  );
}
