/**
 * "Our Trusted Partners" — the Navigator version of the live ProvidersModal,
 * listing the same roster (PROVIDER_GROUPS). Radix Dialog handles focus
 * trapping, Escape, scroll locking and returning focus to the trigger. The
 * portal lands outside the page's `.nw-site` wrapper, so the dialog carries
 * the class itself.
 */
import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'react-router';
import { ArrowRight, X } from 'lucide-react';
import { PROVIDER_GROUPS } from '../../components/modals/providerGroups';
import { ProviderLogo } from '../../components/shared/ProviderLogo';
import { pad2 } from '../sections/format';
import '../styles/navigator.css';
import '../styles/solutions.css';

export function PartnersDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <div className="nw-site nwsol-dialog">
          <Dialog.Overlay className="nwsol-scrim" />
          <Dialog.Content className="nwsol-dialog-panel">
            <div className="nwsol-dialog-head">
              <div>
                <Dialog.Title className="nwsol-dialog-title">Our Trusted Partners</Dialog.Title>
                <Dialog.Description className="nwsol-dialog-desc">
                  Navigate Wealth works with established South African product providers, so you can
                  compare real options side by side.
                </Dialog.Description>
              </div>
              <Dialog.Close className="nwsol-dialog-x" aria-label="Close">
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="nwsol-dialog-body">
              {PROVIDER_GROUPS.map((group, i) => (
                <section key={group.title} className="nwsol-pgroup" aria-label={group.title}>
                  <div className="nwsol-pgroup-head">
                    <span className="nwsol-pgroup-no nw-mono" aria-hidden="true">
                      {pad2(i + 1)}
                    </span>
                    <h3 className="nwsol-pgroup-t">{group.title}</h3>
                    <span className="nwsol-pgroup-rule" aria-hidden="true" />
                    <span className="nwsol-pgroup-count nw-mono">
                      {group.providers.length}{' '}
                      {group.providers.length === 1 ? 'partner' : 'partners'}
                    </span>
                  </div>
                  <ul className="nwsol-plogos">
                    {group.providers.map((p) => (
                      <li key={p.name} className="nwsol-plogo">
                        {p.logo ? (
                          <ProviderLogo
                            src={p.logo}
                            alt=""
                            width={160}
                            height={80}
                            sizes="110px"
                            className="nwsol-plogo-img"
                          />
                        ) : null}
                        <span className="nwsol-plogo-name">{p.name}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <div className="nwsol-dialog-foot">
              <Dialog.Close className="nw-outline">Close</Dialog.Close>
              <Link className="nw-btn" to="/get-quote">
                Get a Quote
                <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
