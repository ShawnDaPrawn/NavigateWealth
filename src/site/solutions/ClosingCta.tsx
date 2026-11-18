/** The closing call-to-action panel: navy card, line art, two actions. */
import type { ReactNode } from 'react';
import { BuildingArt, CompassArt } from './SolutionArt';

interface ClosingCtaProps {
  title: string;
  text: string;
  /** The two actions: a `.nw-btn` then a `.nw-ghost-dark`, both `--lg`. */
  actions: ReactNode;
  /** What sits under the actions: a tick list or the trust facts. */
  footer: ReactNode;
  art: 'compass' | 'building';
  /** Pad the top too (when the section above it is a dark band). */
  padTop?: boolean;
}

export function ClosingCta({ title, text, actions, footer, art, padTop }: ClosingCtaProps) {
  return (
    <section
      className={padTop ? 'nwsol-closing nwsol-closing--pad' : 'nwsol-closing'}
      aria-labelledby="nwsol-closing-title"
    >
      <div className="nw-wrap">
        <div className="nwsol-cta-card">
          <div className="nw-grid-bg" aria-hidden="true" />
          {art === 'compass' ? (
            <CompassArt className="nwsol-cta-art" ticks={false} />
          ) : (
            <BuildingArt className="nwsol-cta-art nwsol-cta-art--building" />
          )}
          <div className="nwsol-cta-copy">
            <h2 id="nwsol-closing-title" className="nwsol-cta-title">
              {title}
            </h2>
            <p className="nwsol-cta-text">{text}</p>
            <div className="nwsol-cta-actions">{actions}</div>
            {footer}
          </div>
        </div>
      </div>
    </section>
  );
}
