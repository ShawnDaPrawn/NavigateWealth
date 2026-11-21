/**
 * PartnerTiles — the partners a service page compares, in the form its
 * board draws:
 * - `tiles`: a centred heading over logo tiles with the founding year;
 * - `strip`: a one-line logo strip beside a short label (Risk Management);
 * - `card`, `pair`, `grid`: a navy band with the heading beside one
 *   described partner, beside two logos, or over a grid of logos.
 */
import type { CSSProperties } from 'react';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';

export interface PartnerTile {
  id: string;
  name: string;
  logo: string;
  est: string;
  /** One line on what the partner does, for the `card` form. */
  description?: string;
}

export type PartnerTilesVariant = 'tiles' | 'strip' | 'card' | 'pair' | 'grid';

interface PartnerTilesProps {
  id?: string;
  variant?: PartnerTilesVariant;
  /** Omit for an unnumbered kicker. */
  index?: string;
  kicker: string;
  title: string;
  /** Tile and logo sizes for the `tiles` form; they vary board to board. */
  tiles?: { maxWidth: number; height: number; logoWidth: number; logoHeight: number };
  partners: PartnerTile[];
}

export function PartnerTiles({
  id = 'partners',
  variant = 'tiles',
  index,
  kicker,
  title,
  tiles,
  partners,
}: PartnerTilesProps) {
  if (partners.length === 0) return null;

  const logo = (p: PartnerTile) => (
    <img src={p.logo} alt={`${p.name} logo`} loading="lazy" decoding="async" />
  );

  if (variant === 'strip') {
    return (
      <section id={id} aria-label="Trusted partners" className="nwl-partner-strip">
        <div className="nw-wrap nwl-strip-row">
          <div className="nwl-strip-head">
            <p className="nwl-strip-k nw-mono">{kicker}</p>
            <h2 className="nwl-strip-t">{title}</h2>
          </div>
          <ul className="nwl-strip-logos">
            {partners.map((p) => (
              <li key={p.id} className="nwl-logo">
                {logo(p)}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (variant === 'card' || variant === 'pair' || variant === 'grid') {
    const head = (
      <div className="nwl-band-head">
        <p className="nwl-band-k nw-mono">{kicker}</p>
        <h2 className="nwl-band-t">{title}</h2>
      </div>
    );
    return (
      <section id={id} aria-label="Trusted partners" className={`nwl-band nwl-band--${variant}`}>
        <div className="nw-grid-bg" aria-hidden="true" />
        <div className="nw-wrap nwl-band-row">
          {head}
          {variant === 'card' ? (
            partners.map((p) => (
              <div key={p.id} className="nwl-card">
                {logo(p)}
                <div className="nwl-card-copy">
                  <p className="nwl-card-name">{p.name}</p>
                  {p.description ? <p className="nwl-card-desc">{p.description}</p> : null}
                </div>
              </div>
            ))
          ) : (
            <ul className="nwl-band-logos">
              {partners.map((p) => (
                <li key={p.id} className="nwl-band-logo">
                  {logo(p)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  }

  const style = tiles
    ? ({
        '--nwl-tile-w': `${tiles.maxWidth}px`,
        '--nwl-tile-h': `${tiles.height}px`,
        '--nwl-logo-w': `${tiles.logoWidth}px`,
        '--nwl-logo-h': `${tiles.logoHeight}px`,
      } as CSSProperties)
    : undefined;
  return (
    <section id={id} aria-label="Trusted partners" className="nw-sec nw-sec--white" style={style}>
      <div className="nw-wrap">
        <SectionHead index={index} kicker={kicker} title={title} center className="nwl-head" />
        <ul className="nwl-grid">
          {partners.map((p) => (
            <li key={p.id} className="nwl-tile">
              {logo(p)}
              <span className="nwl-est nw-mono">Est. {p.est}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
