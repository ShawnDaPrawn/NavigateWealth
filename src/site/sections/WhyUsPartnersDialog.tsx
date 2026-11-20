/**
 * WhyUsPartnersDialog — "Our Trusted Partners", the provider list behind the
 * "Why Us?" hero's "View Our Partners" button, laid out as the WhyUs board
 * draws it: numbered service groups, a logo tile per provider, Close and
 * "Get a Quote" in the footer.
 *
 * Radix underneath: focus is trapped while it is open, Escape and a click on
 * the dimmed page close it, and focus returns to the button that opened it.
 * The dialog portals to <body>, outside the page's `.nw-site` wrapper, so the
 * portal carries its own `nw-site` class for the scoped styles to apply.
 */
import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ProviderLogo } from '../../components/shared/ProviderLogo';
import type { ProviderGroup } from '../../components/shared/providerGroups';
import { ArrowIcon, CloseIcon } from './WhyUsIcons';
import { pad2 } from './format';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/why-us.css';

interface WhyUsPartnersDialogProps {
  groups: readonly ProviderGroup[];
  quoteLink: string;
  /** The button that opens the dialog. */
  children: ReactNode;
}

function partnerCount(n: number): string {
  return `${n} ${n === 1 ? 'partner' : 'partners'}`;
}

export function WhyUsPartnersDialog({ groups, quoteLink, children }: WhyUsPartnersDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <div className="nw-site nw-base nwwu-portal">
          <Dialog.Overlay className="nwwu-dlg-overlay">
            <Dialog.Content className="nwwu-dlg">
              <div className="nwwu-dlg-head">
                <div>
                  <Dialog.Title className="nwwu-dlg-title">Our Trusted Partners</Dialog.Title>
                  <Dialog.Description className="nwwu-dlg-desc">
                    Navigate Wealth works with established South African product providers, so you
                    can compare real options side by side.
                  </Dialog.Description>
                </div>
                <Dialog.Close className="nwwu-dlg-x" aria-label="Close">
                  <CloseIcon size={18} />
                </Dialog.Close>
              </div>
              <div className="nwwu-dlg-body">
                {groups.map((group, i) => (
                  <section
                    key={group.id}
                    className="nwwu-dlg-group"
                    aria-labelledby={`nwwu-dlg-${group.id}`}
                  >
                    <div className="nwwu-dlg-ghead">
                      <span className="nw-mono nwwu-dlg-no" aria-hidden="true">
                        {pad2(i + 1)}
                      </span>
                      <h3 id={`nwwu-dlg-${group.id}`} className="nwwu-dlg-gt">
                        {group.title}
                      </h3>
                      <span className="nwwu-dlg-rule" aria-hidden="true" />
                      <span className="nw-mono nwwu-dlg-count">
                        {partnerCount(group.providers.length)}
                      </span>
                    </div>
                    <ul className="nwwu-dlg-grid">
                      {group.providers.map((p) => (
                        <li key={p.name} className="nwwu-plogo">
                          {p.logo ? (
                            <ProviderLogo
                              src={p.logo}
                              alt=""
                              width={110}
                              height={55}
                              sizes="110px"
                            />
                          ) : null}
                          <span className="nwwu-plogo-name">{p.name}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <div className="nwwu-dlg-foot">
                <Dialog.Close className="nwwu-out">Close</Dialog.Close>
                <Link className="nw-btn nwwu-dlg-quote" to={quoteLink}>
                  Get a Quote <ArrowIcon size={16} />
                </Link>
              </div>
            </Dialog.Content>
          </Dialog.Overlay>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
