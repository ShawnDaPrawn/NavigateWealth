/**
 * PressMediaKit — "Media Resources": the four parts of the media kit, each with
 * a button that opens the request dialog. The kit is sent on request, as on
 * the live page, so nothing here downloads.
 */
import type { MouseEvent } from 'react';
import { getOptimizedFallbackUrl } from '../../utils/optimizedImages';
import { NwImage } from '../components/NwImage';
import { PressIcon, type PressIconName } from './PressIcons';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/press.css';

/** What sits in the top of each card: the logo, a photograph, or an icon. */
export type PressAssetMedia =
  | { kind: 'logo'; src: string; width: number; height: number }
  | { kind: 'photo'; imageKey: string }
  | { kind: 'icon'; icon: PressIconName };

export interface PressAsset {
  title: string;
  description: string;
  type: string;
  media: PressAssetMedia;
}

interface PressMediaKitProps {
  index: string;
  title: string;
  lead: string;
  assets: readonly PressAsset[];
  onRequest: (event: MouseEvent<HTMLButtonElement>) => void;
}

function AssetMedia({ media }: { media: PressAssetMedia }) {
  if (media.kind === 'photo') {
    return (
      <div className="nwpr2-asset-media nwpr2-asset-media--photo">
        <NwImage
          src={getOptimizedFallbackUrl(media.imageKey)}
          imageKey={media.imageKey}
          alt=""
          sizes="(max-width: 640px) 100vw, 320px"
          className="nwpr2-asset-photo"
        />
      </div>
    );
  }
  if (media.kind === 'logo') {
    return (
      <div className="nwpr2-asset-media">
        <img
          src={media.src}
          alt=""
          width={media.width}
          height={media.height}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }
  return (
    <div className="nwpr2-asset-media">
      <PressIcon name={media.icon} size={44} />
    </div>
  );
}

export function PressMediaKit({ index, title, lead, assets, onRequest }: PressMediaKitProps) {
  return (
    <section id="media-kit" className="nwpr2-kit" aria-labelledby="nwpr2-kit-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nw-wrap nwpr2-kit-wrap">
        <SectionHead
          index={index}
          kicker="Media Kit"
          title={title}
          lead={lead}
          titleId="nwpr2-kit-title"
          center
          dark
          className="nwpr2-head-center nwpr2-head-dark"
        />
        <div className="nwpr2-assets">
          {assets.map((asset) => (
            <article key={asset.title} className="nwpr2-asset">
              <AssetMedia media={asset.media} />
              <div className="nwpr2-asset-body">
                <div className="nwpr2-asset-row">
                  <h3 className="nwpr2-asset-title">{asset.title}</h3>
                  <span className="nwpr2-badge nw-mono">{asset.type}</span>
                </div>
                <p className="nwpr2-asset-desc">{asset.description}</p>
                <button
                  type="button"
                  className="nw-btn nwpr2-asset-btn"
                  aria-haspopup="dialog"
                  aria-label={`Request ${asset.title}`}
                  onClick={onRequest}
                >
                  Request <PressIcon name="mail" size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
