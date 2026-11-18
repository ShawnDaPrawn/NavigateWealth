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
import { useId, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import { NwImage } from '../components/NwImage';
import { SectionHead } from './SectionHead';
import { ProductSheet } from './ProductSheet';
import { pad2 } from './format';
import '../styles/sections.css';

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
  index: string;
  kicker: string;
  title: string;
  subtitle: string;
  /** Group name for the phone sheet, e.g. "For individuals". */
  groupLabel: string;
  tone: 'white' | 'paper';
  /** Put the picture on the right (the business group does). */
  flip?: boolean;
  chipLabel: string;
  chipIcon: ComponentType<{ className?: string }>;
  products: ShowcaseProduct[];
  quoteLink: string;
  consultationLink: string;
  ariaLabel?: string;
}

export function ProductShowcase({
  id,
  index,
  kicker,
  title,
  subtitle,
  groupLabel,
  tone,
  flip,
  chipLabel,
  chipIcon: ChipIcon,
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

  return (
    <section
      id={id}
      aria-label={ariaLabel ?? title}
      className={`nw-sec ${tone === 'paper' ? 'nw-sec--paper' : 'nw-sec--white'}`}
    >
      <div className="nw-wrap">
        <SectionHead index={index} kicker={kicker} title={title} lead={subtitle} />

        <div className="nwp-bar nwp-desk">
          <div role="tablist" aria-label={ariaLabel ?? title} className="nwp-tabs">
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
          <span className="nwp-pos nw-mono" aria-hidden="true">
            {pad2(active + 1)} / {pad2(count)}
          </span>
        </div>

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
                    <span className="nwp-chip-icon" aria-hidden="true">
                      <ChipIcon />
                    </span>
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
                        <Check size={13} strokeWidth={1.75} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="nwp-actions">
                  <Link className="nw-btn" to={quoteLink}>
                    Get a Quote
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                  {count > 1 ? (
                    <button type="button" className="nwp-next" onClick={() => select(i + 1, true)}>
                      Next: {next.label}
                      <ChevronRight size={15} strokeWidth={1.75} aria-hidden="true" />
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
              {count} {count === 1 ? 'solution' : 'solutions'}
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
                    <ChevronRight size={15} strokeWidth={1.75} />
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
