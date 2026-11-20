/**
 * PartnerWall — the provider logo wall, and a dialog listing every partner by
 * the service it covers.
 *
 * The dialog is Radix: focus is trapped while it is open, Escape and the
 * overlay close it, and focus returns to "View All Partners". As on the board,
 * the whole dialog scrolls over the dimmed page: the content sits inside the
 * overlay, which is the scroll container (Radix's scrollable-overlay pattern).
 * Radix portals it
 * to <body>, outside the page's `.nw-site` wrapper, so the portal carries its
 * own `nw-site` class for the scoped styles to apply.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'react-router';
import { ArrowRight, X } from 'lucide-react';
import { ProviderLogo } from '../../components/shared/ProviderLogo';
import type { ProviderGroup } from '../../components/shared/providerGroups';
import { SectionHead } from './SectionHead';
import { pad2 } from './format';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/home.css';

interface PartnerWallProps {
  index: string;
  title: string;
  lead: string;
  logos: readonly { name: string; logo: string }[];
  groups: readonly ProviderGroup[];
  consultationLink: string;
}

function partnerCount(n: number): string {
  return `${pad2(n)} ${n === 1 ? 'partner' : 'partners'}`;
}

export function PartnerWall({
  index,
  title,
  lead,
  logos,
  groups,
  consultationLink,
}: PartnerWallProps) {
  return (
    <section className="nw-sec nw-sec--paper" aria-labelledby="nwpw-title">
      <div className="nw-wrap">
        <Dialog.Root>
          <div className="nw-sec-row">
            <SectionHead
              index={index}
              kicker="Partners"
              title={title}
              lead={lead}
              titleId="nwpw-title"
            />
            <Dialog.Trigger className="nw-outline">
              View All Partners
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Dialog.Trigger>
          </div>

          <ul className="nwpw-grid">
            {logos.map((p) => (
              <li key={p.name} className="nwpw-tile">
                <ProviderLogo
                  src={p.logo}
                  alt={`${p.name} logo`}
                  width={150}
                  height={75}
                  sizes="150px"
                />
              </li>
            ))}
          </ul>

          <Dialog.Portal>
            <div className="nw-site nw-base">
              <Dialog.Overlay className="nwpd-overlay">
                <Dialog.Content className="nwpd">
                  <div className="nwpd-head">
                    <div>
                      <p className="nw-kicker nw-mono">Partners by service</p>
                      <Dialog.Title className="nwpd-title">Our Trusted Partners</Dialog.Title>
                      <Dialog.Description className="nwpd-desc">
                        Navigate Wealth works with established South African product providers, so
                        you can compare real options side by side.
                      </Dialog.Description>
                    </div>
                    <Dialog.Close className="nwpd-close" aria-label="Close">
                      <X size={18} strokeWidth={1.75} aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                  <div className="nwpd-body">
                    {groups.map((group) => (
                      <section key={group.id} aria-labelledby={`nwpd-${group.id}`}>
                        <div className="nwpd-group-head">
                          <h3 id={`nwpd-${group.id}`} className="nwpd-group-t">
                            {group.title}
                          </h3>
                          <span className="nwpd-count nw-mono">
                            {partnerCount(group.providers.length)}
                          </span>
                        </div>
                        <ul className="nwpd-list">
                          {group.providers.map((p) => (
                            <li key={p.name}>
                              {p.logo ? (
                                <ProviderLogo
                                  src={p.logo}
                                  alt=""
                                  width={110}
                                  height={55}
                                  sizes="110px"
                                />
                              ) : null}
                              {p.name}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                  <div className="nwpd-foot">
                    <div className="nw-grid-bg" aria-hidden="true" />
                    <div className="nwpd-foot-text">
                      <p className="nwpd-foot-t">Independent. Unbiased. Personal.</p>
                      <p className="nwpd-foot-p">
                        Our independence means we evaluate solutions across our partners to
                        recommend what suits you.
                      </p>
                      <ul className="nwpd-tags nw-mono">
                        <li>Free consultation</li>
                        <li>No obligation</li>
                      </ul>
                    </div>
                    <Link className="nw-btn" to={consultationLink}>
                      Book a Free Consultation
                      <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                    </Link>
                  </div>
                </Dialog.Content>
              </Dialog.Overlay>
            </div>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </section>
  );
}
