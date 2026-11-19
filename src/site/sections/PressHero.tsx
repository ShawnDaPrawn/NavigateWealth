/**
 * PressHero — the press page's opening: the heading, the media-kit request and
 * a preview of the brand assets the kit contains.
 *
 * The three logos are the approved brand files already served from
 * public/brand-assets (see its README): the full logo, the reversed logo for
 * dark backgrounds, and the sail mark on its own.
 */
import type { MouseEvent } from 'react';
import { PressIcon } from './PressIcons';
import '../styles/sections.css';
import '../styles/press.css';

const LOGO_FULL = '/brand-assets/navigate-wealth-primary.svg';
const LOGO_REVERSED = '/brand-assets/navigate-wealth-reversed.svg';
const SAIL_MARK = '/brand-assets/navigate-wealth-icon-only-brand.svg';
/** The sail mark's violet, as the board labels it. */
const BRAND_HEX = '#6D28D9';

interface PressHeroProps {
  badge: string;
  title: string;
  accent: string;
  lead: string;
  onRequestKit: (event: MouseEvent<HTMLButtonElement>) => void;
  /** In-page anchor of the media contact section. */
  contactHref: string;
}

export function PressHero({
  badge,
  title,
  accent,
  lead,
  onRequestKit,
  contactHref,
}: PressHeroProps) {
  return (
    <section className="nwpr2-hero" aria-label="Hero">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nwpr2-glow" aria-hidden="true" />
      <div className="nw-wrap nwpr2-hero-grid">
        <div>
          <div className="nwpr2-pill">
            <PressIcon name="newspaper" size={14} stroke="#C5CAD3" />
            <span>{badge}</span>
          </div>
          <h1 className="nwpr2-title">
            {title} <span className="nw-accent">{accent}</span>
          </h1>
          <p className="nwpr2-lead">{lead}</p>
          <div className="nwpr2-hero-ctas">
            <button
              type="button"
              className="nw-btn nw-btn--lg nwpr2-kit-btn"
              aria-haspopup="dialog"
              onClick={onRequestKit}
            >
              Request Media Kit <PressIcon name="mail" size={18} />
            </button>
            <a className="nw-ghost-dark nw-btn--lg" href={contactHref}>
              Media Contact
            </a>
          </div>
        </div>

        <div className="nwpr2-brand" role="group" aria-label="Brand assets preview">
          <div className="nwpr2-brand-main">
            <img
              src={LOGO_FULL}
              alt="Navigate Wealth logo with sail mark"
              width={1576}
              height={892}
              decoding="async"
            />
          </div>
          <div className="nwpr2-brand-dark">
            <img
              src={LOGO_REVERSED}
              alt="Navigate Wealth logo, reversed for dark backgrounds"
              width={1576}
              height={892}
              decoding="async"
            />
          </div>
          <div className="nwpr2-brand-mark">
            <span className="nwpr2-brand-tile">
              <img
                src={SAIL_MARK}
                alt="Navigate Wealth sail mark"
                width={622}
                height={838}
                loading="lazy"
                decoding="async"
              />
            </span>
            <span className="nwpr2-hex nw-mono">{BRAND_HEX}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
