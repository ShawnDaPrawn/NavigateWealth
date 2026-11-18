/**
 * ProductSheet — the phone pop-up for one product, from the bottom edge.
 *
 * Built on Radix Dialog for the parts that are easy to get wrong by hand:
 * focus moves in and is trapped, Escape and the scrim close it, the page
 * behind stops scrolling. Focus returns to the product's row on close.
 * The portal lands outside the page's `.nw-site` wrapper, so the sheet
 * carries the class itself.
 */
import { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'react-router';
import { ArrowRight, Check, ChevronRight, X } from 'lucide-react';
import { NwImage } from '../components/NwImage';
import type { ShowcaseProduct } from './ProductShowcase';
import { pad2 } from './format';
import '../styles/navigator.css';
import '../styles/sections.css';

interface ProductSheetProps {
  products: ShowcaseProduct[];
  index: number | null;
  groupLabel: string;
  quoteLink: string;
  consultationLink: string;
  onIndexChange: (index: number | null) => void;
  /** Where focus goes when the sheet closes — the row that opened it. */
  onCloseFocus: () => void;
}

export function ProductSheet({
  products,
  index,
  groupLabel,
  quoteLink,
  consultationLink,
  onIndexChange,
  onCloseFocus,
}: ProductSheetProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const product = index === null ? null : products[index];
  const count = products.length;

  const goNext = () => {
    if (index === null) return;
    onIndexChange((index + 1) % count);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  return (
    <Dialog.Root open={product !== null} onOpenChange={(open) => !open && onIndexChange(null)}>
      <Dialog.Portal>
        {product && index !== null ? (
          <div className="nw-site nwp-sheet">
            <Dialog.Overlay className="nwp-scrim" />
            <Dialog.Content
              className="nwp-sheet-panel"
              onCloseAutoFocus={(e) => {
                // Opened from a list row, not a Radix Trigger, so Radix has no
                // trigger to return focus to.
                e.preventDefault();
                onCloseFocus();
              }}
            >
              <span className="nwp-grab" aria-hidden="true" />
              <Dialog.Close className="nwp-x" aria-label="Close">
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </Dialog.Close>
              <div className="nwp-sheet-body" ref={bodyRef}>
                <div className="nwp-sheet-hero">
                  <NwImage
                    src={product.image}
                    imageKey={product.imageKey}
                    alt={product.alt}
                    sizes="100vw"
                  />
                  <div className="nwp-sheet-cap">
                    <span className="nwp-sheet-chip">
                      {groupLabel} · {pad2(index + 1)} / {pad2(count)}
                    </span>
                    <Dialog.Title className="nwp-sheet-title">{product.title}</Dialog.Title>
                  </div>
                </div>
                <div className="nwp-sheet-content">
                  <Dialog.Description className="nwp-sheet-lead">
                    {product.description}
                  </Dialog.Description>
                  <p className="nwp-sheet-p">{product.benefitsDescription}</p>
                  <p className="nwp-sheet-eyebrow">What&apos;s included</p>
                  <ul className="nwp-feats">
                    {product.features.map((f) => (
                      <li key={f.title} className="nwp-feat">
                        <div className="nwp-feat-t">{f.title}</div>
                        <div className="nwp-feat-d">{f.description}</div>
                      </li>
                    ))}
                  </ul>
                  <p className="nwp-sheet-eyebrow">Key benefits</p>
                  <ul className="nwp-bens">
                    {product.benefits.map((b) => (
                      <li key={b}>
                        <span className="nwp-tick" aria-hidden="true">
                          <Check size={12} strokeWidth={1.75} />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  {count > 1 ? (
                    <button type="button" className="nwp-sheet-next" onClick={goNext}>
                      <span>
                        <span className="nwp-sheet-nl">Next</span>
                        <span className="nwp-sheet-nt">{products[(index + 1) % count].label}</span>
                      </span>
                      <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="nwp-sheet-foot">
                <Link className="nw-btn" to={quoteLink}>
                  Get a Quote
                  <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                </Link>
                <Link className="nw-outline" to={consultationLink}>
                  Book a Consultation
                </Link>
              </div>
            </Dialog.Content>
          </div>
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
