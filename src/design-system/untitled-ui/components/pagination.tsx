/**
 * Untitled UI v8.0 "Pagination", "_Pagination number base" and
 * "Pagination dot group".
 *
 * Figma variants → props:
 *   Type   Page default | Card minimal (right aligned)   → type: 'page' | 'card'
 *   Shape  Square | Circle                              → shape
 *   Pagination dot group  Style Dot | Line, Size md | lg, Framed
 *                                                       → PaginationDots props
 * The other card layouts (button group, advanced with page select) and the
 * carousel image are not exported yet.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import { ArrowLeft, ArrowRight } from '../icons/icons';
import { Button } from './button';
import { paginationRange } from './pagination-range';

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  /** The current page, 1-based. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  type?: 'page' | 'card';
  shape?: 'square' | 'circle';
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  type = 'page',
  shape = 'square',
  className,
  'aria-label': ariaLabel = 'Pagination',
  ...props
}: PaginationProps) {
  const go = (p: number) => {
    if (p >= 1 && p <= pageCount && p !== page) onPageChange(p);
  };
  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  if (type === 'card') {
    return (
      <nav
        className={clsx('uui-pagination', className)}
        data-type="card"
        aria-label={ariaLabel}
        {...props}
      >
        <p className="uui-pagination__details" aria-live="polite">
          Page {page} of {pageCount}
        </p>
        <div className="uui-pagination__actions">
          <Button hierarchy="secondary" size="sm" disabled={atStart} onClick={() => go(page - 1)}>
            Previous
          </Button>
          <Button hierarchy="secondary" size="sm" disabled={atEnd} onClick={() => go(page + 1)}>
            Next
          </Button>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className={clsx('uui-pagination', className)}
      data-type="page"
      data-shape={shape}
      aria-label={ariaLabel}
      {...props}
    >
      <div className="uui-pagination__edge">
        <Button
          hierarchy="link-gray"
          size="sm"
          iconLeading={ArrowLeft}
          disabled={atStart}
          onClick={() => go(page - 1)}
        >
          Previous
        </Button>
      </div>
      <ol className="uui-pagination__numbers">
        {paginationRange(page, pageCount).map((p, i) => (
          <li key={p === 'ellipsis' ? `e${i}` : p}>
            {p === 'ellipsis' ? (
              <span className="uui-pagination__number" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                type="button"
                className="uui-pagination__number"
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => go(p)}
              >
                {p}
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="uui-pagination__edge" data-end="true">
        <Button
          hierarchy="link-gray"
          size="sm"
          iconTrailing={ArrowRight}
          disabled={atEnd}
          onClick={() => go(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

export interface PaginationDotsProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  count: number;
  /** The current dot, 0-based. */
  current: number;
  onChange?: (index: number) => void;
  size?: 'md' | 'lg';
  variant?: 'dot' | 'line';
  /** The white translucent pill behind the dots, for use over images. */
  framed?: boolean;
  /** Accessible name of each dot; defaults to "Slide N". */
  getLabel?: (index: number) => string;
}

export function PaginationDots({
  count,
  current,
  onChange,
  size = 'md',
  variant = 'dot',
  framed = false,
  getLabel = (i) => `Slide ${i + 1}`,
  className,
  ...props
}: PaginationDotsProps) {
  const common = {
    className: clsx('uui-pagination-dots', className),
    'data-size': size,
    'data-variant': variant,
    'data-framed': framed || undefined,
  };
  // Without onChange the dots only show position: one image, no dead buttons.
  if (!onChange) {
    return (
      <div role="img" aria-label={`${getLabel(current)} of ${count}`} {...common} {...props}>
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="uui-pagination-dots__dot"
            aria-hidden="true"
            data-current={i === current || undefined}
          />
        ))}
      </div>
    );
  }
  return (
    <div {...common} {...props}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          className="uui-pagination-dots__dot"
          aria-label={getLabel(i)}
          aria-current={i === current ? 'true' : undefined}
          onClick={() => onChange(i)}
        />
      ))}
    </div>
  );
}
