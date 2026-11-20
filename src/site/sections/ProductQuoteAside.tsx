/**
 * ProductQuoteAside — beside the form: why choose the firm (the live page's
 * six points, the partner count among them), the providers the quote
 * compares (the service's list in quote/constants.ts, as the live page's
 * ProviderStrip shows it), and the live TrustBar's four facts.
 */
import { ProviderLogo } from '../../components/shared/ProviderLogo';
import type { QuoteProvider } from '../../components/pages/quote/types';
import { TRUST_INDICATORS } from '../../components/pages/quote/constants';
import { ProductQuoteIcon, type ProductQuoteIconName } from './ProductQuoteIcons';
import '../styles/product-quote.css';

/** The board's icon for each of the live TrustBar's facts. */
const TRUST_ICON: Record<string, ProductQuoteIconName> = {
  Shield: 'shield',
  CheckCircle: 'checkCircle',
  Phone: 'phone',
  Lock: 'lock',
};

interface ProductQuoteAsideProps {
  providers: readonly QuoteProvider[];
}

export function ProductQuoteAside({ providers }: ProductQuoteAsideProps) {
  const count = providers.length;
  const points: { icon: ProductQuoteIconName; label: string; desc: string }[] = [
    {
      icon: 'shield',
      label: 'Independent & Unbiased',
      desc: "We're not tied to any single provider",
    },
    {
      icon: 'users',
      label: `${count > 0 ? count + ' ' : ''}Trusted Partner${count === 1 ? '' : 's'}`,
      desc: 'Compare the best options available',
    },
    {
      icon: 'clock',
      label: '24-Hour Response',
      desc: "We'll contact you within one business day",
    },
  ];
  const checks = [
    { label: 'Free Consultation', desc: 'No cost, no obligation' },
    { label: 'Independent Advice', desc: 'FSCA-authorised, not tied to one provider' },
    { label: 'Your Data is Secure', desc: 'Strict privacy and POPIA compliance' },
  ];

  return (
    <aside className="nwpq-aside">
      <div className="nwpq-card nwpq-why">
        <h3 className="nw-h nwpq-why-title">
          Why Navigate <span className="nwpq-italic">Wealth?</span>
        </h3>
        <ul className="nwpq-why-list">
          {points.map((p) => (
            <li key={p.icon}>
              <span className="nwpq-why-icon">
                <ProductQuoteIcon name={p.icon} size={15} />
              </span>
              <span>
                <span className="nwpq-why-label">{p.label}</span>
                <span className="nwpq-why-desc">{p.desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <ul className="nwpq-checks">
          {checks.map((c) => (
            <li key={c.label}>
              <ProductQuoteIcon name="check" size={16} stroke="#0D1626" />
              <span>
                <span className="nwpq-check-label">{c.label}</span>
                <span className="nwpq-check-desc">{c.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {count > 0 ? (
        <div className="nwpq-card nwpq-providers">
          <div className="nwpq-providers-head">
            <span className="nwpq-providers-label">Providers we compare</span>
            <span className="nw-h nwpq-providers-count">
              {count} partner{count === 1 ? '' : 's'}
            </span>
          </div>
          <ul className="nwpq-logos">
            {providers.map((provider) => (
              <li key={provider.id} className="nwpq-logo" title={provider.name}>
                {provider.logo ? (
                  <ProviderLogo
                    src={provider.logo}
                    alt={`${provider.name} logo`}
                    width={72}
                    height={28}
                    sizes="72px"
                  />
                ) : (
                  <span className="nwpq-logo-name">{provider.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="nwpq-trust">
        {TRUST_INDICATORS.map((item) => (
          <li key={item.label}>
            <ProductQuoteIcon name={TRUST_ICON[item.icon] ?? 'shield'} size={14} stroke="#C5CAD3" />
            {item.label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
