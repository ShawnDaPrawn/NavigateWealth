/**
 * "Our Trusted Partners" — every provider, grouped by the service it serves.
 * Opened from the home page's partners section. Radix Dialog moves focus in,
 * traps it, closes on Escape or a click outside and returns focus to the
 * "View All Partners" button (its Trigger). The portal lands outside the page's `.nw-site`
 * wrapper, so the dialog carries the class itself. Logos load only once the
 * dialog is open.
 */
import type { ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'react-router';
import { ArrowRight, X } from 'lucide-react';
import { PROVIDER_GROUPS } from '../../components/modals/providerGroups';
import { pad2 } from '../sections/format';
import { NwLogo } from '../components/NwLogo';
import { CONSULTATION_PATH } from './homeContent';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/home.css';

interface PartnersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens it; focus returns there on close. */
  children: ReactElement;
}

export function PartnersDialog({ open, onOpenChange, children }: PartnersDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        {open ? (
          <div className="nw-site nwhm-dlg">
            <Dialog.Overlay className="nwhm-dlg-overlay">
              <Dialog.Content className="nwhm-dlg-panel">
                <div className="nwhm-dlg-head">
                  <div>
                    <p className="nw-kicker nw-mono">Partners by service</p>
                    <Dialog.Title className="nwhm-dlg-title">Our Trusted Partners</Dialog.Title>
                    <Dialog.Description className="nwhm-dlg-desc">
                      Navigate Wealth works with established South African product providers, so you
                      can compare real options side by side.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close className="nwhm-dlg-x" aria-label="Close">
                    <X size={18} strokeWidth={1.75} aria-hidden="true" />
                  </Dialog.Close>
                </div>
                <div className="nwhm-dlg-body">
                  {PROVIDER_GROUPS.map((group) => (
                    <section key={group.title} aria-label={group.title}>
                      <div className="nwhm-dlg-group">
                        <h3>{group.title}</h3>
                        <span className="nw-mono">
                          {pad2(group.providers.length)}{' '}
                          {group.providers.length === 1 ? 'partner' : 'partners'}
                        </span>
                      </div>
                      <ul className="nwhm-dlg-logos">
                        {group.providers.map((p) => (
                          <li key={p.name}>
                            {p.logo ? (
                              <NwLogo src={p.logo} alt={`${p.name} logo`} sizes="110px" />
                            ) : null}
                            <span>{p.name}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
                <div className="nwhm-dlg-foot">
                  <div className="nw-grid-bg" aria-hidden="true" />
                  <div className="nwhm-dlg-foot-copy">
                    <p className="nwhm-dlg-foot-t">Independent. Unbiased. Personal.</p>
                    <p className="nwhm-dlg-foot-p">
                      Our independence means we evaluate solutions across our partners to recommend
                      what suits you.
                    </p>
                    <ul className="nwhm-dlg-chips nw-mono">
                      <li>Free consultation</li>
                      <li>No obligation</li>
                    </ul>
                  </div>
                  <Link
                    className="nw-btn"
                    to={CONSULTATION_PATH}
                    onClick={() => onOpenChange(false)}
                  >
                    Book a Free Consultation
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                </div>
              </Dialog.Content>
            </Dialog.Overlay>
          </div>
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
