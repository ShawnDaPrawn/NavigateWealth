/**
 * QuoteContactPartners — the providers the quote compares, from the service's
 * entry in quote/constants.ts (the list the live page's ProviderStrip shows),
 * with their count. Logos come from the bundled provider registry through
 * ProviderLogo; a provider without one is named instead, as on the live page.
 */
import { ProviderLogo } from '../../components/shared/ProviderLogo';
import type { QuoteProvider } from '../../components/pages/quote/types';
import '../styles/quote-contact.css';

interface QuoteContactPartnersProps {
  providers: readonly QuoteProvider[];
}

export function QuoteContactPartners({ providers }: QuoteContactPartnersProps) {
  if (providers.length === 0) return null;
  const count = providers.length;
  return (
    <div className="nwqc-partners">
      <div className="nwqc-partners-head">
        <span className="nwqc-partners-label">Compared across our partners</span>
        <span className="nw-h nwqc-partners-count">
          {count} partner{count === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="nwqc-logos">
        {providers.map((provider) => (
          <li key={provider.id} className="nwqc-logo" title={provider.name}>
            {provider.logo ? (
              <ProviderLogo
                src={provider.logo}
                alt={`${provider.name} logo`}
                width={64}
                height={32}
                sizes="84px"
              />
            ) : (
              <span className="nwqc-logo-name">{provider.name}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
