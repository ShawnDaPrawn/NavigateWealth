/**
 * ProductShowcase — one group of products (e.g. "For Individuals").
 *
 * Desktop: a tab strip over one panel per product. Every panel is rendered
 * and the inactive ones carry `hidden`, so all the product copy is in the
 * document for search engines and the browser's find-in-page, not only the
 * first tab's. Tabs follow the WAI-ARIA pattern: arrow keys, Home and End.
 *
 * Phones (≤760px): a tappable list; each row opens the product in a sheet.
 */
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { NwImage } from '../components/NwImage';
import { SectionHead } from './SectionHead';
import { ProductSheet } from './ProductSheet';
import { ServiceIcon, type ServiceIconName } from './serviceIcons';
import { pad2 } from './format';
import '../styles/sections.css';

/** The service boards' three layouts (see pages/serviceBoards.ts). */
type ShowcaseLayout = 'standard' | 'jump' | 'risk';

/** What the phone list calls the products, per layout. */
const LIST_NOUN: Record<ShowcaseLayout, [string, string]> = {
  standard: ['solution', 'solutions'],
  jump: ['service', 'services'],
  risk: ['cover option', 'cover options'],
};

export interface ShowcaseProduct {
  id: string;
  label: string;
  title: string;
  description: string;
  benefitsDescription: string;
  features: { title: string; description: string }[];
  benefits: string[];
  image: string;
  imageKey?: string;
  alt: string;
}

interface ProductShowcaseProps {
  id: string;
  /**
   * `standard`: tabs under the heading with a position counter and a "Next"
   * button. `jump` and `risk`: tabs beside the heading, no counter or "Next".
   */
  layout?: ShowcaseLayout;
  /** Omit for an unnumbered kicker (the risk board). */
  index?: string;
  kicker: string;
  title: string;
  subtitle: string;
  /** Group name for the phone sheet, e.g. "For individuals". */
  groupLabel: string;
  tone: 'white' | 'paper';
  /** Put the picture on the right (the business group does). */
  flip?: boolean;
  chipLabel: string;
  chipIcon: ServiceIconName;
  /** Width of the heading beside the tabs (`jump`). */
  headWidth?: number;
  /** Horizontal tab padding (`jump`). */
  tabPad?: number;
  products: ShowcaseProduct[];
  quoteLink: string;
  consultationLink: string;
  ariaLabel?: string;
}

export function ProductShowcase({
  id,
  layout = 'standard',
  index,
  kicker,
  title,
  subtitle,
  groupLabel,
  tone,
  flip,
  chipLabel,
  chipIcon,
  headWidth,
  tabPad,
  products,
  quoteLink,
  consultationLink,
  ariaLabel,
}: ProductShowcaseProps) {
  const base = useId();
  const [active, setActive] = useState(0);
  const [sheet, setSheet] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastShown = useRef(0);
  const showSheet = (i: number | null) => {
    if (i !== null) lastShown.current = i;
    setSheet(i);
  };
  const count = products.length;
  const tabId = (i: number) => `${base}-tab-${i}`;
  const panelId = (i: number) => `${base}-panel-${i}`;

  const select = (i: number, focus: boolean) => {
    const next = (i + count) % count;
    setActive(next);
    if (focus) tabRefs.current[next]?.focus({ preventScroll: true });
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: count - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    select(moves[e.key], true);
  };

  if (count === 0) return null;

  const headStyle = {
    ...(headWidth ? { '--nwp-head-w': `${headWidth}px` } : null),
    ...(tabPad ? { '--nwp-tab-pad': `${tabPad}px` } : null),
  } as CSSProperties;

  const tablist = (
    <div role="tablist" aria-label={ariaLabel ?? title} className="nwp-tabs nwp-desk">
      {products.map((p, i) => (
        <button
          key={p.id}
          ref={(el) => {
            tabRefs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={tabId(i)}
          aria-selected={i === active}
          aria-controls={panelId(i)}
          tabIndex={i === active ? 0 : -1}
          className="nwp-tab"
          onClick={() => select(i, false)}
          onKeyDown={onTabKey}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
  const [one, many] = LIST_NOUN[layout];

  return (
    <section
      id={id}
      aria-label={ariaLabel ?? title}
      className={`nw-sec nwp-sec nwp-sec--${layout} ${tone === 'paper' ? 'nw-sec--paper' : 'nw-sec--white'}`}
      style={headStyle}
    >
      <div className="nw-wrap">
        {layout === 'standard' ? (
          <SectionHead index={index} kicker={kicker} title={title} lead={subtitle} />
        ) : (
          <div className="nwp-headrow">
            <SectionHead
              index={index}
              kicker={kicker}
              title={title}
              lead={subtitle}
              className="nwp-head"
            />
            {tablist}
          </div>
        )}

        {layout === 'standard' ? (
          // On phones the bar's contents hide but the bar keeps its top margin, as drawn.
          <div className="nwp-bar">
            {tablist}
            <span className="nwp-pos nwp-desk nw-mono" aria-hidden="true">
              {pad2(active + 1)} / {pad2(count)}
            </span>
          </div>
        ) : null}

        {products.map((p, i) => {
          const next = products[(i + 1) % count];
          return (
            <div
              key={p.id}
              role="tabpanel"
              id={panelId(i)}
              aria-labelledby={tabId(i)}
              hidden={i !== active}
              className={`nwp-panel nwp-desk nw-in${flip ? ' nwp-panel--flip' : ''}`}
            >
              <div className="nwp-media">
                <NwImage
                  src={p.image}
                  imageKey={p.imageKey}
                  alt={p.alt}
                  sizes="(min-width: 1320px) 640px, (min-width: 900px) 48vw, 100vw"
                  hiddenBelow={760}
                />
                <div className="nwp-cap">
                  <span className="nwp-chip">
                    <ServiceIcon name={chipIcon} size={13} />
                    {chipLabel}
                  </span>
                  <h3 className="nwp-title">{p.title}</h3>
                  <p className="nwp-desc">{p.description}</p>
                </div>
              </div>
              <div className="nwp-copy">
                <p className="nwp-body">{p.benefitsDescription}</p>
                <ul className="nwp-feats">
                  {p.features.map((f) => (
                    <li key={f.title} className="nwp-feat">
                      <div className="nwp-feat-t">{f.title}</div>
                      <div className="nwp-feat-d">{f.description}</div>
                    </li>
                  ))}
                </ul>
                <ul className="nwp-bens" aria-label={`${p.title} benefits`}>
                  {p.benefits.map((b) => (
                    <li key={b}>
                      <span className="nwp-tick" aria-hidden="true">
                        <ServiceIcon name="check" size={13} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="nwp-actions">
                  <Link className="nw-btn" to={quoteLink}>
                    Get a Quote
                    <ServiceIcon name="arrowRight" size={16} />
                  </Link>
                  {count > 1 && layout === 'standard' ? (
                    <button type="button" className="nwp-next" onClick={() => select(i + 1, true)}>
                      Next: <span>{next.label}</span>
                      <ServiceIcon name="chevronRight" size={15} />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        <div className="nwp-list">
          <div className="nwp-list-head nw-mono" aria-hidden="true">
            <span>
              {count} {count === 1 ? one : many}
            </span>
            <span>Tap to read more</span>
          </div>
          <ul className="nwp-rows">
            {products.map((p, i) => (
              <li key={p.id}>
                <button
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  type="button"
                  className="nwp-row"
                  aria-haspopup="dialog"
                  onClick={() => showSheet(i)}
                >
                  <span className="nwp-thumb" aria-hidden="true">
                    <NwImage src={p.image} imageKey={p.imageKey} alt="" sizes="52px" />
                  </span>
                  <span className="nwp-row-txt">
                    <span className="nwp-row-t">{p.label}</span>
                    <span className="nwp-row-d">{p.description}</span>
                  </span>
                  <span className="nwp-chev" aria-hidden="true">
                    <ServiceIcon name="chevronRight" size={15} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ProductSheet
        products={products}
        index={sheet}
        groupLabel={groupLabel}
        quoteLink={quoteLink}
        consultationLink={consultationLink}
        onIndexChange={showSheet}
        onCloseFocus={() => rowRefs.current[lastShown.current]?.focus()}
      />
    </section>
  );
}
